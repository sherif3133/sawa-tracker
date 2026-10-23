<?php
/**
 * Accountability partners: a clan of up to 5 (the student + 4 partners), as Sherif asks in Skool.
 *
 * - New students start alone and pick "Find partners for me" (the default: matched by study hour, then level
 *   within one step, then time zone, with someone a little ahead in each clan) or "I'll find them myself"
 *   (the "looking for partners" list: first name, level, last active, days active in the last 14; never email).
 * - Partners are clanmates. A full clan (5) takes nobody new; older, bigger clans keep everyone.
 * - Around 8 pm in a student's own time zone, if the app has seen no study from them today (a Log, any Sawa Lens
 *   study, 10+ review cards), each partner gets one bell with a one-tap friendly nudge. Skipped on their rest day,
 *   while they paused nudges (3 days), and after a week away (that's the quiet list's job). Studying again tells
 *   the partners "back 🎉". Partners who didn't open the bell get one email digest a day.
 * - Only app members (approved / paying accounts) take part.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Partners {

	const CAP        = 5;
	const NUDGE_HOUR = 20;
	const AWAY_DAYS  = 7;
	const PAUSE_DAYS = 3;
	const CEFR       = array( 1 => 'A1', 2 => 'A2', 3 => 'B1', 4 => 'B2', 5 => 'C1', 6 => 'C2' );

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'sawa_tr_logged', array( __CLASS__, 'studied' ) );
		add_action( 'sawa_lens_activity', array( __CLASS__, 'lens_activity' ), 10, 3 );
		add_action( 'sawa_tr_hourly', array( __CLASS__, 'hourly' ) );
	}

	private static function route( $path, $method, $cb ) {
		register_rest_route(
			Sawa_Tracker_Rest::NS,
			$path,
			array(
				'methods'             => $method,
				'callback'            => array( __CLASS__, $cb ),
				'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ),
			)
		);
	}

	public static function routes() {
		self::route( '/partners', 'GET', 'rest_state' );
		self::route( '/partners/match', 'POST', 'rest_match' );
		self::route( '/partners/looking', 'GET', 'rest_looking' );
		self::route( '/partners/invite', 'POST', 'rest_invite' );
		self::route( '/partners/accept', 'POST', 'rest_accept' );
		self::route( '/partners/decline', 'POST', 'rest_decline' );
		self::route( '/partners/leave', 'POST', 'rest_leave' );
		self::route( '/partners/nudge', 'POST', 'rest_nudge' );
		self::route( '/partners/settings', 'POST', 'rest_settings' );
	}

	private static function err( $en, $ar, $status = 400 ) {
		return new WP_Error( 'partners', class_exists( 'Sawa_Lang' ) ? Sawa_Lang::pick( $en, $ar ) : $en, array( 'status' => $status ) );
	}

	/* ------------------------------------------------------------------ the student */

	public static function tz( $uid ) {
		$z = (string) Sawa_Tracker_Game::m( $uid, 'tz', '' );
		if ( $z ) {
			try {
				return new DateTimeZone( $z );
			} catch ( Exception $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement
			}
		}
		return wp_timezone();
	}

	/** The student's own clock right now. */
	private static function local( $uid, $ts = null ) {
		return ( new DateTimeImmutable( '@' . ( $ts ?? time() ) ) )->setTimezone( self::tz( $uid ) );
	}

	/** Level 1–6 (A1–C2) from Sawa Lens (the learner's level or placement test), A2 when unknown. */
	public static function level( $uid ) {
		$l = (int) get_user_meta( $uid, 'sawa_lens_level', true );
		if ( $l < 1 || $l > 6 ) {
			$p = (array) get_user_meta( $uid, 'sawa_lens_placement', true );
			$l = (int) ( $p['levelNum'] ?? 0 );
		}
		return $l >= 1 && $l <= 6 ? $l : 2;
	}

	/** The last time the app saw this student study (unix time), 0 if never. */
	public static function last_study( $uid ) {
		$t = (int) Sawa_Tracker_Game::m( $uid, 'studied_at', 0 );
		if ( ! $t ) {
			global $wpdb;
			$d = $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(created_at) FROM ' . Sawa_Tracker_Game::table( 'logs' ) . ' WHERE user_id = %d', $uid ) ); // phpcs:ignore
			$t = $d ? ( new DateTimeImmutable( $d, wp_timezone() ) )->getTimestamp() : 0;
		}
		return $t;
	}

	/** Studied today, by the student's own clock (or by the tracker's day, which also counts). */
	public static function studied_today( $uid ) {
		$t = self::last_study( $uid );
		if ( $t && self::local( $uid, $t )->format( 'Y-m-d' ) === self::local( $uid )->format( 'Y-m-d' ) ) {
			return true;
		}
		return Sawa_Tracker_Game::live( $uid )['studiedToday'];
	}

	/** Days with study in the last 14 (tracker days). */
	public static function active_days( $uid ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . Sawa_Tracker_Game::table( 'days' ) . ' WHERE user_id = %d AND day > %s AND minutes > 0', $uid, Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -14 ) ) ); // phpcs:ignore
	}

	/** The hour (UTC, 0–23) this student usually studies, from their own logs of the last 30 days. */
	public static function study_hour( $uid ) {
		global $wpdb;
		$rows = $wpdb->get_col( $wpdb->prepare( 'SELECT created_at FROM ' . Sawa_Tracker_Game::table( 'logs' ) . " WHERE user_id = %d AND day > %s AND notes NOT LIKE 'Auto%%' ORDER BY id DESC LIMIT 40", $uid, Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -30 ) ) ); // phpcs:ignore
		$hrs  = array();
		foreach ( $rows as $r ) {
			$hrs[] = (int) ( new DateTimeImmutable( $r, wp_timezone() ) )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'G' );
		}
		if ( ! $hrs ) {
			$h = Sawa_Tracker_Game::m( $uid, 'remind_hour', '' );
			$h = '' === $h ? self::NUDGE_HOUR - 1 : (int) $h;
			return (int) self::local( $uid )->setTime( $h, 0 )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'G' );
		}
		sort( $hrs );
		return $hrs[ (int) floor( count( $hrs ) / 2 ) ];
	}

	private static function first_name( $uid ) {
		$u = get_userdata( $uid );
		if ( ! $u ) {
			return '';
		}
		return $u->first_name ? $u->first_name : (string) strtok( $u->display_name, ' ' );
	}

	/** Partners = the other members of the student's clan. */
	public static function partners( $uid ) {
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		return $clan ? array_values( array_diff( Sawa_Tracker_Social::clan_members( $clan ), array( (int) $uid ) ) ) : array();
	}

	private static function room( $clan_id ) {
		return $clan_id ? count( Sawa_Tracker_Social::clan_members( $clan_id ) ) < self::CAP : true;
	}

	/* ------------------------------------------------------------------ study seen */

	/** Called on every tracker log (by hand or automatic). */
	public static function studied( $uid ) {
		$uid = (int) $uid;
		Sawa_Tracker_Game::set( $uid, 'studied_at', time() );
		if ( Sawa_Tracker_Game::m( $uid, 'quiet_open', '' ) ) {
			delete_user_meta( $uid, 'sawa_quiet_open' );
			foreach ( self::partners( $uid ) as $p ) {
				Sawa_Tracker_Game::event( $uid, 'partner_back', $p, array( 'name' => self::first_name( $uid ) ) );
			}
		}
	}

	/** Sawa Lens study (Today steps, practice, checked texts, road camps…) counts at once; review cards from 10 a day. */
	public static function lens_activity( $uid, $kind, $times = 1 ) {
		$uid = (int) $uid;
		if ( 'saved' === $kind ) {
			return;
		}
		if ( 'card' === $kind ) {
			$day = self::local( $uid )->format( 'Y-m-d' );
			$c   = (array) Sawa_Tracker_Game::m( $uid, 'cards_day', array() );
			$n   = ( ( $c['day'] ?? '' ) === $day ? (int) $c['n'] : 0 ) + max( 1, (int) $times );
			Sawa_Tracker_Game::set( $uid, 'cards_day', array( 'day' => $day, 'n' => $n ) );
			if ( $n < 10 ) {
				return;
			}
		}
		self::studied( $uid );
	}

	/* ------------------------------------------------------------------ matching */

	/** How well two students fit (lower is better): study hour first, then level, then time zone. */
	private static function fit( $a, $b ) {
		$h  = abs( $a['hour'] - $b['hour'] );
		$h  = min( $h, 24 - $h );
		$lv = abs( $a['level'] - $b['level'] );
		$tz = abs( $a['off'] - $b['off'] ) / 3600;
		return $h * 3 + ( $lv > 1 ? 40 : $lv * 2 ) + min( $tz, 12 ) * 0.5;
	}

	private static function profile( $uid ) {
		return array(
			'id'    => (int) $uid,
			'hour'  => self::study_hour( $uid ),
			'level' => self::level( $uid ),
			'off'   => self::local( $uid )->getOffset(),
		);
	}

	/** Score for adding $p to a group: average fit, minus a little when it brings someone a step ahead. */
	private static function group_fit( $p, $group ) {
		$s   = 0;
		$top = 0;
		foreach ( $group as $g ) {
			$s  += self::fit( $p, $g );
			$top = max( $top, $g['level'] );
		}
		$s = $s / max( 1, count( $group ) );
		if ( $p['level'] === $top + 1 ) {
			$s -= 2;
		}
		return $s;
	}

	/**
	 * Matches everyone waiting in the pool: into an open partner clan that fits, or with each other in a new clan.
	 * Returns the ids that were placed.
	 */
	public static function match_pool() {
		$pool = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $uid ) {
			if ( Sawa_Tracker_Game::m( $uid, 'looking', '' ) && ! Sawa_Tracker_Social::clan_of( $uid ) ) {
				$pool[ $uid ] = (int) Sawa_Tracker_Game::m( $uid, 'looking', 0 );
			} elseif ( Sawa_Tracker_Game::m( $uid, 'looking', '' ) ) {
				delete_user_meta( $uid, 'sawa_looking' );
			}
		}
		if ( ! $pool ) {
			return array();
		}
		asort( $pool ); // longest waiting first
		$profiles = array();
		foreach ( array_keys( $pool ) as $uid ) {
			$profiles[ $uid ] = self::profile( $uid );
		}
		// Open partner clans (made by matching or by students) with room.
		$open = array();
		foreach ( Sawa_Tracker_Social::clans() as $c ) {
			$m = Sawa_Tracker_Social::clan_members( (int) $c['id'] );
			if ( $m && count( $m ) < self::CAP && get_option( 'sawa_tr_pclan_' . (int) $c['id'] ) ) {
				$open[ (int) $c['id'] ] = array_map( array( __CLASS__, 'profile' ), $m );
			}
		}
		$placed = array();
		foreach ( array_keys( $pool ) as $uid ) {
			if ( in_array( $uid, $placed, true ) ) {
				continue;
			}
			$me   = $profiles[ $uid ];
			$best = null;
			$bs   = 30; // worse than this isn't a match: wait for someone better
			foreach ( $open as $cid => $g ) {
				$s = self::group_fit( $me, $g ) - ( count( $g ) * 0.5 ); // fill clans that already started
				if ( count( $g ) < self::CAP && $s < $bs ) {
					$bs   = $s;
					$best = array( 'clan', $cid );
				}
			}
			foreach ( $profiles as $oid => $o ) {
				if ( $oid === $uid || in_array( $oid, $placed, true ) ) {
					continue;
				}
				$s = self::fit( $me, $o ) + 1;
				if ( $s < $bs ) {
					$bs   = $s;
					$best = array( 'mate', $oid );
				}
			}
			if ( ! $best ) {
				continue;
			}
			if ( 'clan' === $best[0] ) {
				$cid = $best[1];
				self::join( $uid, $cid, 'partner_matched' );
				$open[ $cid ][] = $me;
				$placed[]       = $uid;
			} else {
				$cid = self::new_clan( array( $uid, $best[1] ) );
				$open[ $cid ] = array( $me, $profiles[ $best[1] ] );
				$placed[]     = $uid;
				$placed[]     = $best[1];
			}
		}
		return $placed;
	}

	/** A new partner clan with these students in it. */
	private static function new_clan( $ids ) {
		$cid = Sawa_Tracker_Social::create_clan();
		update_option( 'sawa_tr_pclan_' . $cid, 1, false );
		foreach ( $ids as $id ) {
			self::join( (int) $id, $cid, 'partner_matched' );
		}
		return $cid;
	}

	/** Puts a student in a clan and tells the others. */
	private static function join( $uid, $cid, $type = 'partner_joined' ) {
		$others = Sawa_Tracker_Social::clan_members( $cid );
		Sawa_Tracker_Social::set_clan( $uid, $cid );
		delete_user_meta( $uid, 'sawa_looking' );
		delete_user_meta( $uid, 'sawa_partner_invites' );
		$c = Sawa_Tracker_Social::clan( $cid );
		foreach ( $others as $o ) {
			Sawa_Tracker_Game::event( $uid, $type, $o, array( 'clan' => $c['name'] ?? '' ) );
			Sawa_Tracker_Game::event( $o, $type, $uid, array( 'clan' => $c['name'] ?? '' ) ); // and the newcomer meets each of them
		}
		Sawa_Tracker_Game::bust_boards();
	}

	/* ------------------------------------------------------------------ the nightly nudge */

	public static function hourly() {
		self::match_pool();
		foreach ( Sawa_Tracker_Game::member_ids() as $uid ) {
			self::maybe_quiet( $uid );
		}
		if ( (int) wp_date( 'G' ) === 21 && get_option( 'sawa_tr_pdigest' ) !== Sawa_Tracker_Game::today() ) {
			update_option( 'sawa_tr_pdigest', Sawa_Tracker_Game::today(), false );
			self::digest();
		}
	}

	/** At ~8 pm their time: no study today → one bell to each partner. Returns the partners told. */
	public static function maybe_quiet( $uid, $force = false ) {
		$partners = self::partners( $uid );
		if ( ! $partners ) {
			return array();
		}
		$now = self::local( $uid );
		$day = $now->format( 'Y-m-d' );
		if ( ! $force && (int) $now->format( 'G' ) !== self::NUDGE_HOUR ) {
			return array();
		}
		if ( Sawa_Tracker_Game::m( $uid, 'quiet_day', '' ) === $day ) {
			return array();
		}
		$rest = Sawa_Tracker_Game::m( $uid, 'rest_day', '' );
		if ( '' !== $rest && (int) $rest === (int) $now->format( 'w' ) ) {
			return array();
		}
		if ( (string) Sawa_Tracker_Game::m( $uid, 'nudge_pause', '' ) >= $day ) {
			return array();
		}
		$last = self::last_study( $uid );
		if ( ! $last || time() - $last > self::AWAY_DAYS * DAY_IN_SECONDS || self::studied_today( $uid ) ) {
			return array();
		}
		Sawa_Tracker_Game::set( $uid, 'quiet_day', $day );
		Sawa_Tracker_Game::set( $uid, 'quiet_open', 1 );
		foreach ( $partners as $p ) {
			Sawa_Tracker_Game::event( $uid, 'partner_quiet', $p, array( 'name' => self::first_name( $uid ) ) );
		}
		return $partners;
	}

	/** One email a day for partners who haven't opened their bell since a "not yet today" came in. */
	public static function digest() {
		global $wpdb;
		$t    = Sawa_Tracker_Game::table( 'events' );
		$from = wp_date( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, user_id, target_id FROM $t WHERE type = 'partner_quiet' AND created_at >= %s", $from ), ARRAY_A ); // phpcs:ignore
		$by   = array();
		foreach ( $rows as $r ) {
			if ( (int) $r['id'] > (int) Sawa_Tracker_Game::m( (int) $r['target_id'], 'seen', 0 ) ) {
				$by[ (int) $r['target_id'] ][] = (int) $r['user_id'];
			}
		}
		$page = home_url( '/app/' );
		foreach ( $by as $to => $who ) {
			$u = get_userdata( $to );
			if ( ! $u || ! Sawa_Tracker_Game::is_member( $to ) ) {
				continue;
			}
			$names = implode( ', ', array_unique( array_map( array( __CLASS__, 'first_name' ), $who ) ) );
			$ar    = 'ar' === get_user_meta( $to, 'sawa_lang', true );
			wp_mail(
				$u->user_email,
				$ar ? 'شركاءك محتاجين تشجيعك النهارده' : 'Your partners could use a friendly nudge',
				$ar
					? sprintf( "أهلًا يا %s،\n\n%s لسه مذاكروش النهارده. رسالة صغيرة منك ممكن تفرق.\n\nابعتلهم تشجيع بضغطة واحدة: %s\n\nسوا انجليش", self::first_name( $to ), $names, $page )
					: sprintf( "Hi %s,\n\n%s hasn't studied yet today. A small message from you can make the difference.\n\nSend a nudge with one tap: %s\n\nSawa English", self::first_name( $to ), $names, $page )
			);
		}
	}

	/* ------------------------------------------------------------------ REST */

	public static function state( $uid ) {
		$clan     = Sawa_Tracker_Social::clan_of( $uid );
		$today    = array();
		foreach ( self::partners( $uid ) as $p ) {
			$person  = Sawa_Tracker_Game::person( $p );
			$today[] = array(
				'id'     => $p,
				'name'   => self::first_name( $p ),
				'avatar' => $person['avatar'] ?? '',
				'today'  => self::studied_today( $p ),
			);
		}
		$invites = array();
		foreach ( (array) Sawa_Tracker_Game::m( $uid, 'partner_invites', array() ) as $from => $at ) {
			if ( Sawa_Tracker_Game::is_member( (int) $from ) ) {
				$fc        = Sawa_Tracker_Social::clan_of( (int) $from );
				$invites[] = array(
					'id'   => (int) $from,
					'name' => self::first_name( (int) $from ),
					'size' => $fc ? count( Sawa_Tracker_Social::clan_members( $fc ) ) : 1,
				);
			}
		}
		$sent = array();
		foreach ( (array) Sawa_Tracker_Game::m( $uid, 'partner_sent', array() ) as $to => $at ) {
			$sent[] = (int) $to;
		}
		return array(
			'clan'     => $clan,
			'size'     => $clan ? count( Sawa_Tracker_Social::clan_members( $clan ) ) : 1,
			'cap'      => self::CAP,
			'partners' => $today,
			'invites'  => $invites,
			'looking'  => (bool) Sawa_Tracker_Game::m( $uid, 'looking', '' ),
			'hidden'   => (bool) Sawa_Tracker_Game::m( $uid, 'partner_hide', '' ),
			'restDay'  => (string) Sawa_Tracker_Game::m( $uid, 'rest_day', '' ),
			'pause'    => (string) Sawa_Tracker_Game::m( $uid, 'nudge_pause', '' ),
			'tz'       => (string) Sawa_Tracker_Game::m( $uid, 'tz', '' ),
			'sent'     => $sent,
			'nudged'   => (array) ( ( (array) Sawa_Tracker_Game::m( $uid, 'nudged', array() ) )[ Sawa_Tracker_Game::today() ] ?? array() ),
		);
	}

	public static function rest_state() {
		return self::state( get_current_user_id() );
	}

	/** "Find partners for me": join the pool and match now if someone fits. */
	public static function rest_match() {
		$uid = get_current_user_id();
		if ( Sawa_Tracker_Social::clan_of( $uid ) ) {
			return self::err( 'You already have partners.', 'إنت عندك شركاء بالفعل.' );
		}
		Sawa_Tracker_Game::set( $uid, 'looking', time() );
		self::match_pool();
		return self::state( $uid );
	}

	/** Members with fewer than 4 partners who chose to appear: most active first. ?q= searches by name. */
	public static function rest_looking( WP_REST_Request $r ) {
		$uid  = get_current_user_id();
		$mine = Sawa_Tracker_Social::clan_of( $uid );
		$q    = mb_strtolower( trim( (string) $r->get_param( 'q' ) ) );
		$out  = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $id ) {
			if ( $id === $uid || Sawa_Tracker_Game::m( $id, 'partner_hide', '' ) ) {
				continue;
			}
			$c = Sawa_Tracker_Social::clan_of( $id );
			if ( ( $mine && $c === $mine ) || ! self::room( $c ) ) {
				continue;
			}
			$name = self::first_name( $id );
			if ( '' !== $q && false === mb_strpos( mb_strtolower( get_userdata( $id )->display_name ), $q ) ) {
				continue;
			}
			$last  = self::last_study( $id );
			$out[] = array(
				'id'       => $id,
				'name'     => $name,
				'avatar'   => (string) Sawa_Tracker_Game::m( $id, 'avatar' ),
				'level'    => self::CEFR[ self::level( $id ) ],
				'last'     => $last ? gmdate( 'c', $last ) : '',
				'days14'   => self::active_days( $id ),
				'partners' => $c ? count( Sawa_Tracker_Social::clan_members( $c ) ) - 1 : 0,
			);
		}
		usort(
			$out,
			function ( $a, $b ) {
				return $b['days14'] <=> $a['days14'] ?: strcmp( $b['last'], $a['last'] );
			}
		);
		return array( 'people' => array_slice( $out, 0, 60 ) );
	}

	/** Can these two end up in one clan of 5? Returns the clan id to use (0 = a new one) or an error. */
	private static function target( $a, $b ) {
		$ca = Sawa_Tracker_Social::clan_of( $a );
		$cb = Sawa_Tracker_Social::clan_of( $b );
		if ( $ca && $cb ) {
			return $ca === $cb ? self::err( 'You are already partners.', 'إنتوا شركاء بالفعل.' ) : self::err( 'You both have partners already. One of you can leave their clan first.', 'إنتوا الاتنين عندكم شركاء. واحد فيكم يسيب الكلان بتاعه الأول.' );
		}
		$c = $ca ? $ca : $cb;
		if ( $c && ! self::room( $c ) ) {
			return self::err( 'That clan is full (5 of 5).', 'الكلان ده كامل (٥ من ٥).' );
		}
		return $c;
	}

	public static function rest_invite( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$to  = (int) $r->get_param( 'id' );
		if ( ! $to || $to === $uid || ! Sawa_Tracker_Game::is_member( $to ) ) {
			return self::err( 'This student can\'t get partners in the app yet.', 'الطالب ده لسه مينفعش يبقى له شركاء في الأبلكيشن.' );
		}
		$c = self::target( $uid, $to );
		if ( is_wp_error( $c ) ) {
			return $c;
		}
		$inv = (array) Sawa_Tracker_Game::m( $to, 'partner_invites', array() );
		if ( ! isset( $inv[ $uid ] ) ) {
			$inv[ $uid ] = time();
			Sawa_Tracker_Game::set( $to, 'partner_invites', $inv );
			Sawa_Tracker_Game::event( $uid, 'partner_invite', $to, array() );
		}
		$sent        = (array) Sawa_Tracker_Game::m( $uid, 'partner_sent', array() );
		$sent[ $to ] = time();
		Sawa_Tracker_Game::set( $uid, 'partner_sent', $sent );
		return self::state( $uid );
	}

	private static function drop_invite( $uid, $from ) {
		$inv = (array) Sawa_Tracker_Game::m( $uid, 'partner_invites', array() );
		unset( $inv[ $from ] );
		Sawa_Tracker_Game::set( $uid, 'partner_invites', $inv );
		$sent = (array) Sawa_Tracker_Game::m( $from, 'partner_sent', array() );
		unset( $sent[ $uid ] );
		Sawa_Tracker_Game::set( $from, 'partner_sent', $sent );
	}

	public static function rest_accept( WP_REST_Request $r ) {
		$uid  = get_current_user_id();
		$from = (int) $r->get_param( 'id' );
		$inv  = (array) Sawa_Tracker_Game::m( $uid, 'partner_invites', array() );
		if ( ! isset( $inv[ $from ] ) || ! Sawa_Tracker_Game::is_member( $from ) ) {
			return self::err( 'This invite is no longer open.', 'الدعوة دي مبقتش متاحة.' );
		}
		$c = self::target( $uid, $from );
		self::drop_invite( $uid, $from );
		if ( is_wp_error( $c ) ) {
			return $c;
		}
		if ( ! $c ) {
			self::new_clan( array( $from, $uid ) );
		} elseif ( Sawa_Tracker_Social::clan_of( $from ) === $c ) {
			self::join( $uid, $c );
		} else {
			self::join( $from, $c );
		}
		return self::state( $uid );
	}

	public static function rest_decline( WP_REST_Request $r ) {
		self::drop_invite( get_current_user_id(), (int) $r->get_param( 'id' ) );
		return self::state( get_current_user_id() );
	}

	public static function rest_leave() {
		$uid  = get_current_user_id();
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		if ( $clan ) {
			Sawa_Tracker_Social::set_clan( $uid, 0 );
			delete_user_meta( $uid, 'sawa_quiet_open' );
			Sawa_Tracker_Game::bust_boards();
		}
		return self::state( $uid );
	}

	/** A one-tap friendly nudge (template 0–2) to a partner who hasn't studied today. Once a day per partner. */
	public static function rest_nudge( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$to  = (int) $r->get_param( 'id' );
		$t   = max( 0, min( 2, (int) $r->get_param( 't' ) ) );
		if ( ! in_array( $to, self::partners( $uid ), true ) ) {
			return self::err( 'You can nudge your partners only.', 'تقدر تبعت تشجيع لشركاءك بس.' );
		}
		$day = Sawa_Tracker_Game::today();
		$n   = (array) Sawa_Tracker_Game::m( $uid, 'nudged', array() );
		$n   = array( $day => (array) ( $n[ $day ] ?? array() ) );
		if ( in_array( $to, $n[ $day ], true ) ) {
			return self::err( 'You already sent them a nudge today.', 'إنت بعتله تشجيع النهارده بالفعل.' );
		}
		$n[ $day ][] = $to;
		Sawa_Tracker_Game::set( $uid, 'nudged', $n );
		Sawa_Tracker_Game::event( $uid, 'partner_nudge', $to, array( 't' => $t ) );
		return self::state( $uid );
	}

	/** Time zone (from the browser), appear in the list, rest day (0–6 or ''), pause nudges for 3 days. */
	public static function rest_settings( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$tz  = (string) $r->get_param( 'tz' );
		if ( '' !== $tz && in_array( $tz, timezone_identifiers_list(), true ) ) {
			Sawa_Tracker_Game::set( $uid, 'tz', $tz );
		}
		if ( null !== $r->get_param( 'hidden' ) ) {
			$r->get_param( 'hidden' ) ? Sawa_Tracker_Game::set( $uid, 'partner_hide', 1 ) : delete_user_meta( $uid, 'sawa_partner_hide' );
		}
		if ( null !== $r->get_param( 'restDay' ) ) {
			$d = (string) $r->get_param( 'restDay' );
			'' === $d ? delete_user_meta( $uid, 'sawa_rest_day' ) : Sawa_Tracker_Game::set( $uid, 'rest_day', max( 0, min( 6, (int) $d ) ) );
		}
		if ( null !== $r->get_param( 'pause' ) ) {
			$r->get_param( 'pause' ) ? Sawa_Tracker_Game::set( $uid, 'nudge_pause', self::local( $uid )->modify( '+' . ( self::PAUSE_DAYS - 1 ) . ' days' )->format( 'Y-m-d' ) ) : delete_user_meta( $uid, 'sawa_nudge_pause' );
		}
		if ( $r->get_param( 'stopLooking' ) ) {
			delete_user_meta( $uid, 'sawa_looking' );
		}
		return self::state( $uid );
	}
}
