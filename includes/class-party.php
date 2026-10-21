<?php
/**
 * Parties: 2–4 students who play the Silk Road together.
 *
 * - A party chat (a chat room only the party sees).
 * - Party boss: the party starts a big boss with shared HP; for 48 hours every member hits it with 5-question
 *   English battles (3 hits a day). When it falls, everyone who hit it gets the loot.
 * - Weekly goal: answer 40 battle questions correctly per member, together, this week.
 * - Live battle: when the party is online together, one member starts it, the others join in a 25-second lobby,
 *   then everyone gets the same 8 questions at the same moment (15 seconds each) and sees who got each one.
 *   It works with short polling, so it needs nothing beyond WordPress.
 *
 * Every member writes only their own data (damage, live answers), so members acting at once never overwrite
 * each other; the shared party record changes only on rare actions (invites, joining, starting a boss).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Party {

	const MAX          = 4;
	const BOSSES       = array( array( 'Bandit King', '🤴' ), array( 'Sand Kraken', '🦑' ), array( 'Bone Dragon', '🦴' ), array( 'Mamluk Warlord', '⚔️' ), array( 'Ghost Caravan', '👻' ) );
	const BOSS_HP      = 220; // per member
	const BOSS_HOURS   = 48;
	const HITS_PER_DAY = 3;
	const LIVE_PER_DAY = 3;
	const LIVE_Q       = 8;
	const LIVE_SECS    = 15;
	const LOBBY        = 25;
	const WEEK_GOAL    = 40; // right answers per member

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		$routes = array(
			array( '/party', 'GET', 'state_rest' ),
			array( '/party/candidates', 'GET', 'candidates' ),
			array( '/party/create', 'POST', 'create' ),
			array( '/party/invite', 'POST', 'invite' ),
			array( '/party/join', 'POST', 'join' ),
			array( '/party/decline', 'POST', 'decline' ),
			array( '/party/leave', 'POST', 'leave' ),
			array( '/party/kick', 'POST', 'kick' ),
			array( '/party/boss', 'POST', 'boss_start' ),
			array( '/party/hit', 'POST', 'hit' ),
			array( '/party/weekly', 'POST', 'weekly_claim' ),
			array( '/party/live', 'GET', 'live_rest' ),
			array( '/party/live/start', 'POST', 'live_start' ),
			array( '/party/live/join', 'POST', 'live_join' ),
			array( '/party/live/answer', 'POST', 'live_answer' ),
		);
		foreach ( $routes as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => $r[1], 'callback' => array( __CLASS__, $r[2] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	/* ------------------------------------------------------------------ storage */

	public static function get( $pid ) {
		$p = $pid ? get_option( 'sawa_tr_party_' . (int) $pid ) : null;
		return is_array( $p ) ? $p : null;
	}

	private static function save( $p ) {
		update_option( 'sawa_tr_party_' . (int) $p['id'], $p, false );
	}

	/** The student's party id (0 if none). */
	public static function of( $uid ) {
		$pid = (int) Sawa_Tracker_Game::m( $uid, 'party', 0 );
		$p   = self::get( $pid );
		return $p && in_array( (int) $uid, $p['members'], true ) ? $pid : 0;
	}

	private static function mine( $uid ) {
		$p = self::get( self::of( $uid ) );
		return $p ? $p : new WP_Error( 'party', 'You are not in a party.', array( 'status' => 400 ) );
	}

	private static function room_add( $p, $uid ) {
		global $wpdb;
		$wpdb->replace( Sawa_Tracker_Social::t( 'room_members' ), array( 'room_id' => (int) $p['room'], 'user_id' => (int) $uid, 'joined_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
	}

	private static function room_remove( $p, $uid ) {
		global $wpdb;
		$wpdb->delete( Sawa_Tracker_Social::t( 'room_members' ), array( 'room_id' => (int) $p['room'], 'user_id' => (int) $uid ) ); // phpcs:ignore
	}

	private static function invites_of( $uid ) {
		$v = Sawa_Tracker_Game::m( $uid, 'party_invites', array() );
		return array_values( array_filter( array_map( 'intval', is_array( $v ) ? $v : array() ), array( __CLASS__, 'get' ) ) );
	}

	/* ------------------------------------------------------------------ output */

	public static function state( $uid ) {
		$p       = self::get( self::of( $uid ) );
		$invites = array();
		foreach ( self::invites_of( $uid ) as $pid ) {
			$x = self::get( $pid );
			if ( $x && count( $x['members'] ) < self::MAX ) {
				$invites[] = array( 'id' => $pid, 'name' => $x['name'], 'members' => array_map( array( 'Sawa_Tracker_Game', 'person' ), $x['members'] ) );
			}
		}
		if ( ! $p ) {
			return array( 'party' => null, 'invites' => $invites, 'max' => self::MAX );
		}
		$members = array();
		foreach ( $p['members'] as $m ) {
			$rpg       = Sawa_Tracker_RPG::get( $m );
			$w         = Sawa_Tracker_World::get( $m );
			$members[] = Sawa_Tracker_Game::person( $m ) + array(
				'job'    => $rpg['job'],
				'town'   => Sawa_Tracker_World::TOWNS[ $w['at'] ][0],
				'weapon' => (int) round( 100 * Sawa_Tracker_RPG::slot_bonus( $rpg, 'weapon' ) ),
				'title'  => (string) ( end( $w['titles'] ) ? end( $w['titles'] ) : '' ),
				'week'   => (int) ( $w['wk']['c']['right'] ?? 0 ),
				'leader' => (int) $p['leader'] === $m,
			);
		}
		$goal = self::WEEK_GOAL * count( $p['members'] );
		$done = array_sum( array_column( $members, 'week' ) );
		return array(
			'party'   => array(
				'id'      => (int) $p['id'],
				'name'    => $p['name'],
				'room'    => (int) $p['room'],
				'leader'  => (int) $p['leader'],
				'members' => $members,
				'invited' => array_map( array( 'Sawa_Tracker_Game', 'person' ), array_keys( (array) $p['invites'] ) ),
				'boss'    => self::boss_out( $p, $uid ),
				'weekly'  => array( 'goal' => $goal, 'count' => (int) min( $goal, $done ), 'claimed' => Sawa_Tracker_Game::m( $uid, 'party_week', '' ) === Sawa_Tracker_Game::week_start(), 'reward' => '40 🪙 + 1 ⚗' ),
				'live'    => self::live_out( $p, $uid ),
			),
			'invites' => $invites,
			'max'     => self::MAX,
		);
	}

	/* ------------------------------------------------------------------ party management */

	private static function uid() {
		return get_current_user_id();
	}

	public static function state_rest() {
		return self::state( self::uid() );
	}

	/** Members to invite: your clan first, not in a party yet. */
	public static function candidates() {
		$uid  = self::uid();
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		$out  = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $m ) {
			if ( $m === $uid || self::of( $m ) ) {
				continue;
			}
			$out[] = Sawa_Tracker_Game::person( $m ) + array( 'mate' => $clan && Sawa_Tracker_Social::clan_of( $m ) === $clan, 'town' => Sawa_Tracker_World::TOWNS[ max( 1, min( 6, (int) Sawa_Tracker_Game::m( $m, 'town', 1 ) ) ) ][0] );
		}
		usort( $out, function ( $a, $b ) { return array( ! $a['mate'], $a['name'] ) <=> array( ! $b['mate'], $b['name'] ); } );
		return array( 'people' => array_slice( $out, 0, 60 ) );
	}

	public static function create( WP_REST_Request $r ) {
		global $wpdb;
		$uid = self::uid();
		if ( self::of( $uid ) ) {
			return new WP_Error( 'party', 'Leave your party first.', array( 'status' => 400 ) );
		}
		$name = trim( Sawa_Tracker_Social::filter_words( sanitize_text_field( (string) $r->get_param( 'name' ) ) ) );
		$name = '' !== $name ? mb_substr( $name, 0, 30 ) : Sawa_Tracker_Game::person( $uid )['name'] . '\'s party';
		$pid  = (int) get_option( 'sawa_tr_party_next', 1 );
		update_option( 'sawa_tr_party_next', $pid + 1, false );
		$wpdb->insert( Sawa_Tracker_Social::t( 'rooms' ), array( 'type' => 'party', 'name' => '⚔️ ' . $name, 'created_by' => $uid, 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
		$p = array( 'id' => $pid, 'name' => $name, 'leader' => $uid, 'members' => array( $uid ), 'invites' => array(), 'room' => (int) $wpdb->insert_id, 'created' => time(), 'boss' => null, 'live' => null, 'lives' => array() );
		add_option( 'sawa_tr_party_' . $pid, $p, '', 'no' );
		self::room_add( $p, $uid );
		Sawa_Tracker_Game::set( $uid, 'party', $pid );
		return self::state( $uid );
	}

	public static function invite( WP_REST_Request $r ) {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$to = (int) $r->get_param( 'user' );
		if ( count( $p['members'] ) >= self::MAX ) {
			return new WP_Error( 'party', 'Your party is full (4 players).', array( 'status' => 400 ) );
		}
		if ( $to === $uid || ! Sawa_Tracker_Game::is_member( $to ) || self::of( $to ) ) {
			return new WP_Error( 'party', 'This student can\'t join right now.', array( 'status' => 400 ) );
		}
		$p['invites'][ $to ] = time();
		self::save( $p );
		$inv = self::invites_of( $to );
		if ( ! in_array( (int) $p['id'], $inv, true ) ) {
			$inv[] = (int) $p['id'];
			Sawa_Tracker_Game::set( $to, 'party_invites', $inv );
			Sawa_Tracker_Game::event( $uid, 'party_invite', $to, array( 'party' => (int) $p['id'], 'name' => $p['name'] ) );
		}
		return self::state( $uid );
	}

	public static function join( WP_REST_Request $r ) {
		$uid = self::uid();
		$pid = (int) $r->get_param( 'party' );
		$p   = self::get( $pid );
		if ( self::of( $uid ) ) {
			return new WP_Error( 'party', 'Leave your party first.', array( 'status' => 400 ) );
		}
		if ( ! $p || ! isset( $p['invites'][ $uid ] ) ) {
			return new WP_Error( 'party', 'This invitation has expired.', array( 'status' => 400 ) );
		}
		if ( count( $p['members'] ) >= self::MAX ) {
			return new WP_Error( 'party', 'This party is full.', array( 'status' => 400 ) );
		}
		unset( $p['invites'][ $uid ] );
		$p['members'][] = $uid;
		self::save( $p );
		self::room_add( $p, $uid );
		Sawa_Tracker_Game::set( $uid, 'party', $pid );
		Sawa_Tracker_Game::set( $uid, 'party_invites', array_values( array_diff( self::invites_of( $uid ), array( $pid ) ) ) );
		return self::state( $uid );
	}

	public static function decline( WP_REST_Request $r ) {
		$uid = self::uid();
		$pid = (int) $r->get_param( 'party' );
		$p   = self::get( $pid );
		if ( $p ) {
			unset( $p['invites'][ $uid ] );
			self::save( $p );
		}
		Sawa_Tracker_Game::set( $uid, 'party_invites', array_values( array_diff( self::invites_of( $uid ), array( $pid ) ) ) );
		return self::state( $uid );
	}

	private static function remove( $p, $uid ) {
		$p['members'] = array_values( array_diff( $p['members'], array( (int) $uid ) ) );
		self::room_remove( $p, $uid );
		Sawa_Tracker_Game::set( $uid, 'party', 0 );
		if ( ! $p['members'] ) {
			global $wpdb;
			$wpdb->delete( Sawa_Tracker_Social::t( 'messages' ), array( 'room_id' => (int) $p['room'] ) ); // phpcs:ignore
			$wpdb->delete( Sawa_Tracker_Social::t( 'rooms' ), array( 'id' => (int) $p['room'] ) ); // phpcs:ignore
			delete_option( 'sawa_tr_party_' . (int) $p['id'] );
			return;
		}
		if ( (int) $p['leader'] === (int) $uid ) {
			$p['leader'] = $p['members'][0];
		}
		self::save( $p );
	}

	public static function leave() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		self::remove( $p, $uid );
		return self::state( $uid );
	}

	public static function kick( WP_REST_Request $r ) {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$who = (int) $r->get_param( 'user' );
		if ( (int) $p['leader'] !== $uid || $who === $uid || ! in_array( $who, $p['members'], true ) ) {
			return new WP_Error( 'party', 'Only the leader can remove players.', array( 'status' => 403 ) );
		}
		self::remove( $p, $who );
		return self::state( $uid );
	}

	/* ------------------------------------------------------------------ party boss */

	private static function boss_key( $p ) {
		return ! empty( $p['boss'] ) ? $p['id'] . '-' . $p['boss']['started'] : '';
	}

	/** One member's damage on the current boss and hits today. */
	private static function dmg( $uid, $key ) {
		$d   = Sawa_Tracker_Game::m( $uid, 'pboss', array() );
		$d   = is_array( $d ) && ( $d['k'] ?? '' ) === $key ? $d : array( 'k' => $key, 'd' => 0, 'day' => '', 'hits' => 0 );
		if ( $d['day'] !== Sawa_Tracker_Game::today() ) {
			$d['day']  = Sawa_Tracker_Game::today();
			$d['hits'] = 0;
		}
		return $d;
	}

	private static function boss_out( $p, $uid ) {
		$b = $p['boss'] ?? null;
		if ( ! $b ) {
			return null;
		}
		$key   = self::boss_key( $p );
		$total = 0;
		$top   = array();
		foreach ( $p['members'] as $m ) {
			$d      = self::dmg( $m, $key );
			$total += (int) $d['d'];
			$top[]  = array( 'name' => Sawa_Tracker_Game::person( $m )['name'], 'damage' => (int) $d['d'] );
		}
		usort( $top, function ( $a, $b ) { return $b['damage'] <=> $a['damage']; } );
		$down = $total >= (int) $b['hp'];
		if ( $down ) {
			self::boss_payout( $p, $key, $b );
		}
		$me = self::dmg( $uid, $key );
		return array(
			'name'     => $b['name'],
			'icon'     => $b['icon'],
			'hp'       => (int) $b['hp'],
			'damage'   => (int) min( $total, $b['hp'] ),
			'down'     => $down,
			'failed'   => ! $down && time() > (int) $b['ends'],
			'ends'     => (int) $b['ends'],
			'hitsLeft' => max( 0, self::HITS_PER_DAY - (int) $me['hits'] ),
			'top'      => $top,
		);
	}

	/** Pays every member who hit the boss, once (the option works as a lock). */
	private static function boss_payout( $p, $key, $b ) {
		if ( ! add_option( 'sawa_tr_pbpaid_' . $key, time(), '', 'no' ) ) {
			return;
		}
		foreach ( $p['members'] as $m ) {
			if ( (int) self::dmg( $m, $key )['d'] > 0 ) {
				Sawa_Tracker_Raids::add_coins( $m, 40 );
				Sawa_Tracker_RPG::add_elixirs( $m, 2 );
				Sawa_Tracker_Game::event( 0, 'party_win', $m, array( 'boss' => $b['name'], 'party' => $p['name'], 'coins' => 40, 'elixirs' => 2 ) );
			}
		}
		Sawa_Tracker_Game::event( (int) $p['leader'], 'party_down', null, array( 'boss' => $b['name'], 'party' => $p['name'] ) );
	}

	public static function boss_start() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$cur = self::boss_out( $p, $uid );
		if ( $cur && ! $cur['down'] && ! $cur['failed'] ) {
			return new WP_Error( 'party', 'Your party is already fighting a boss.', array( 'status' => 400 ) );
		}
		$pick      = self::BOSSES[ wp_rand( 0, count( self::BOSSES ) - 1 ) ];
		$p['boss'] = array( 'name' => $pick[0], 'icon' => $pick[1], 'hp' => self::BOSS_HP * count( $p['members'] ), 'started' => time(), 'ends' => time() + self::BOSS_HOURS * HOUR_IN_SECONDS, 'by' => $uid );
		self::save( $p );
		foreach ( $p['members'] as $m ) {
			if ( $m !== $uid ) {
				Sawa_Tracker_Game::event( $uid, 'party_boss', $m, array( 'boss' => $pick[0] ) );
			}
		}
		return self::state( $uid );
	}

	public static function hit() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$b = self::boss_out( $p, $uid );
		if ( ! $b || $b['down'] || $b['failed'] ) {
			return new WP_Error( 'party', 'No boss to fight. Start one!', array( 'status' => 400 ) );
		}
		$key = self::boss_key( $p );
		$d   = self::dmg( $uid, $key );
		if ( (int) $d['hits'] >= self::HITS_PER_DAY ) {
			return new WP_Error( 'party', 'You used your 3 hits today. Your party can still hit it!', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 5, array( 'weak' => true, 'own' => true ) );
		if ( count( $qs ) < 5 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		++$d['hits'];
		Sawa_Tracker_Game::set( $uid, 'pboss', $d );
		return Sawa_Tracker_World::battle_start( $uid, 'pboss', $qs, array( 'name' => $b['name'], 'icon' => $b['icon'], 'hp' => $b['hp'] - $b['damage'] ), array( 'key' => $key ) );
	}

	/** After a party-boss battle: the attack is the damage. */
	public static function after_hit( $uid, $battle, $attack, $right ) {
		$p = self::get( self::of( $uid ) );
		if ( ! $p || self::boss_key( $p ) !== $battle['meta']['key'] ) {
			return array( 'damage' => 0 );
		}
		$d      = self::dmg( $uid, $battle['meta']['key'] );
		$d['d'] = (int) $d['d'] + $attack;
		Sawa_Tracker_Game::set( $uid, 'pboss', $d );
		Sawa_Tracker_World::progress( $uid, 'pboss' );
		$b = self::boss_out( $p, $uid );
		return array( 'damage' => $attack, 'won' => $b['down'], 'boss' => $b, 'coins' => $b['down'] ? 40 : 0, 'elixirs' => $b['down'] ? 2 : 0 );
	}

	public static function weekly_claim() {
		$uid = self::uid();
		$s   = self::state( $uid );
		if ( ! $s['party'] ) {
			return new WP_Error( 'party', 'You are not in a party.', array( 'status' => 400 ) );
		}
		$wk = $s['party']['weekly'];
		if ( $wk['claimed'] || $wk['count'] < $wk['goal'] ) {
			return new WP_Error( 'party', 'Not finished yet.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Game::set( $uid, 'party_week', Sawa_Tracker_Game::week_start() );
		Sawa_Tracker_Raids::add_coins( $uid, 40 );
		Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
		return self::state( $uid );
	}

	/* ------------------------------------------------------------------ live battle */

	private static function live_end( $l ) {
		return (int) $l['t0'] + self::LIVE_Q * self::LIVE_SECS;
	}

	/** A member's answers in this live battle, or null if they didn't join. */
	private static function live_me( $uid, $lid ) {
		$v = Sawa_Tracker_Game::m( $uid, 'plive', array() );
		return is_array( $v ) && ( $v['id'] ?? '' ) === $lid ? $v : null;
	}

	private static function live_out( $p, $uid ) {
		$l = $p['live'] ?? null;
		if ( ! $l || time() > self::live_end( $l ) + 10 * MINUTE_IN_SECONDS ) {
			$day = $p['lives']['day'] ?? '';
			return array( 'id' => '', 'left' => self::LIVE_PER_DAY - ( Sawa_Tracker_Game::today() === $day ? (int) $p['lives']['n'] : 0 ) );
		}
		$now   = time();
		$cur   = (int) floor( ( $now - (int) $l['t0'] ) / self::LIVE_SECS ); // < 0 lobby, ≥ LIVE_Q ended
		$shown = max( 0, min( self::LIVE_Q, $cur ) ); // questions already revealed
		$joined = array();
		$dmg    = 0;
		foreach ( $p['members'] as $m ) {
			$a = self::live_me( $m, $l['id'] );
			if ( ! $a ) {
				continue;
			}
			$per    = (int) round( 20 * ( 1 + Sawa_Tracker_RPG::slot_bonus( Sawa_Tracker_RPG::get( $m ), 'weapon' ) ) );
			$right  = 0;
			$marks  = array();
			for ( $i = 0; $i < $shown; $i++ ) {
				$ok      = isset( $a['a'][ $i ] ) && (int) $a['a'][ $i ] === (int) $l['qs'][ $i ]['answer'];
				$right  += $ok ? 1 : 0;
				$marks[] = isset( $a['a'][ $i ] ) ? ( $ok ? 1 : 0 ) : -1;
			}
			$dmg     += $right * $per;
			$joined[] = Sawa_Tracker_Game::person( $m ) + array( 'right' => $right, 'marks' => $marks, 'answered' => $cur >= 0 && $cur < self::LIVE_Q && isset( $a['a'][ $cur ] ), 'answers' => count( (array) $a['a'] ) );
		}
		$hp    = max( 1, count( $joined ) ) * self::LIVE_Q * 12; // 60% right answers without gear
		$mine  = self::live_me( $uid, $l['id'] );
		$out   = array(
			'id'      => $l['id'],
			'foe'     => $l['foe'],
			'phase'   => $cur < 0 ? 'lobby' : ( $cur < self::LIVE_Q ? 'question' : 'end' ),
			'now'     => $now,
			't0'      => (int) $l['t0'],
			'secs'    => self::LIVE_SECS,
			'n'       => self::LIVE_Q,
			'i'       => $cur,
			'joined'  => $joined,
			'in'      => (bool) $mine,
			'hp'      => $hp,
			'damage'  => (int) min( $dmg, $hp ),
			'by'      => Sawa_Tracker_Game::person( (int) $l['by'] )['name'],
		);
		if ( $cur >= 0 && $cur < self::LIVE_Q ) {
			$q          = $l['qs'][ $cur ];
			$out['q']   = array( 'q' => $q['q'], 'options' => $q['options'], 'point' => $q['point'] ?? '', 'src' => $q['src'] ?? '', 'mine' => $mine && isset( $mine['a'][ $cur ] ) ? (int) $mine['a'][ $cur ] : null );
			$out['left'] = (int) $l['t0'] + ( $cur + 1 ) * self::LIVE_SECS - $now;
		}
		if ( $shown > 0 ) {
			$prev        = $l['qs'][ $shown - 1 ];
			$out['last'] = array( 'q' => $prev['q'], 'right' => $prev['options'][ $prev['answer'] ] ?? '', 'mine' => $mine && isset( $mine['a'][ $shown - 1 ] ) ? (int) $mine['a'][ $shown - 1 ] === (int) $prev['answer'] : null );
		}
		if ( 'end' === $out['phase'] ) {
			$out['won'] = $dmg >= $hp;
			self::live_payout( $p, $l, $out['won'] );
			$out['reward'] = $mine && $mine['a'] ? ( $out['won'] ? '+25 🪙 + 1 ⚗' : '+5 🪙' ) : '';
		}
		return $out;
	}

	private static function live_payout( $p, $l, $won ) {
		if ( ! add_option( 'sawa_tr_lvpaid_' . $l['id'], time(), '', 'no' ) ) {
			return;
		}
		foreach ( $p['members'] as $m ) {
			$a = self::live_me( $m, $l['id'] );
			if ( ! $a || ! $a['a'] ) {
				continue;
			}
			$right = 0;
			foreach ( (array) $a['a'] as $i => $c ) {
				$right += (int) $c === (int) $l['qs'][ $i ]['answer'] ? 1 : 0;
			}
			Sawa_Tracker_World::progress( $m, 'right', $right );
			Sawa_Tracker_Raids::add_coins( $m, $won ? 25 : 5 );
			if ( $won ) {
				Sawa_Tracker_RPG::add_elixirs( $m, 1 );
			}
		}
		if ( $won ) {
			Sawa_Tracker_Game::event( (int) $l['by'], 'party_down', null, array( 'boss' => $l['foe']['name'], 'party' => $p['name'], 'live' => true ) );
		}
	}

	public static function live_rest() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		return is_wp_error( $p ) ? $p : array( 'live' => self::live_out( $p, $uid ) );
	}

	public static function live_start() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		if ( ! empty( $p['live'] ) && time() < self::live_end( $p['live'] ) ) {
			return new WP_Error( 'party', 'A live battle is already on. Join it!', array( 'status' => 400 ) );
		}
		$day = Sawa_Tracker_Game::today();
		$n   = ( $p['lives']['day'] ?? '' ) === $day ? (int) $p['lives']['n'] : 0;
		if ( $n >= self::LIVE_PER_DAY ) {
			return new WP_Error( 'party', 'Your party had 3 live battles today. Come back tomorrow!', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, self::LIVE_Q, array( 'own' => $p['members'] ) ); // words the whole party is learning
		if ( count( $qs ) < self::LIVE_Q ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		$pick       = self::BOSSES[ wp_rand( 0, count( self::BOSSES ) - 1 ) ];
		$p['live']  = array( 'id' => wp_generate_password( 12, false ), 't0' => time() + self::LOBBY, 'by' => $uid, 'foe' => array( 'name' => $pick[0], 'icon' => $pick[1] ), 'qs' => array_values( $qs ) );
		$p['lives'] = array( 'day' => $day, 'n' => $n + 1 );
		self::save( $p );
		Sawa_Tracker_Game::set( $uid, 'plive', array( 'id' => $p['live']['id'], 'a' => array() ) );
		foreach ( $p['members'] as $m ) {
			if ( $m !== $uid ) {
				Sawa_Tracker_Game::event( $uid, 'party_live', $m, array( 'party' => $p['name'] ) );
			}
		}
		return array( 'live' => self::live_out( $p, $uid ) );
	}

	public static function live_join() {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$l = $p['live'] ?? null;
		if ( ! $l || time() >= (int) $l['t0'] ) {
			return new WP_Error( 'party', 'Too late — this battle has started. Catch the next one!', array( 'status' => 400 ) );
		}
		if ( ! self::live_me( $uid, $l['id'] ) ) {
			Sawa_Tracker_Game::set( $uid, 'plive', array( 'id' => $l['id'], 'a' => array() ) );
		}
		return array( 'live' => self::live_out( $p, $uid ) );
	}

	public static function live_answer( WP_REST_Request $r ) {
		$uid = self::uid();
		$p   = self::mine( $uid );
		if ( is_wp_error( $p ) ) {
			return $p;
		}
		$l = $p['live'] ?? null;
		$a = $l ? self::live_me( $uid, $l['id'] ) : null;
		if ( ! $a ) {
			return new WP_Error( 'party', 'You are not in this battle.', array( 'status' => 400 ) );
		}
		$i   = (int) $r->get_param( 'i' );
		$cur = (int) floor( ( time() - (int) $l['t0'] ) / self::LIVE_SECS );
		if ( $i === $cur && $cur >= 0 && $cur < self::LIVE_Q && ! isset( $a['a'][ $i ] ) ) {
			$a['a'][ $i ] = (int) $r->get_param( 'choice' );
			Sawa_Tracker_Game::set( $uid, 'plive', $a );
		}
		return array( 'live' => self::live_out( $p, $uid ) );
	}
}
