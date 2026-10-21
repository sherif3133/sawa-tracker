<?php
/**
 * Raids: a friendly fight between students (and clans), won with English.
 *
 * Coins (🪙) are the loot. Students earn them by learning (Sawa Lens pays them for plan steps, a perfect day,
 * quiz answers and mastered skills). To raid, you win a 5-question English battle at your level; if your attack
 * beats the defender's defence you take up to 15% of their unprotected coins. Defence comes from doing English
 * today (plan steps, perfect day = 12 h raid-proof, streak armour). Raids never touch XP, streaks or learning data.
 *
 * Fair play: 3 raids a day (+ free revenge), max 2 lost raids a day per defender and 6 h protection after each,
 * the first 20 coins are always safe, and anyone can switch on peace mode.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Raids {

	const RAIDS_PER_DAY = 3;
	const SAFE_COINS    = 20;
	const MAX_LOOT      = 50;
	const SHOP          = array(
		'shield' => array( 40, '12-hour shield' ),
		'freeze' => array( 80, 'Streak freeze' ),
	);

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		foreach ( array( array( '/raids', 'GET', 'state' ), array( '/raids/find', 'POST', 'find' ), array( '/raids/start', 'POST', 'start' ), array( '/raids/answer', 'POST', 'answer' ), array( '/raids/shop', 'POST', 'shop' ), array( '/raids/peace', 'POST', 'peace' ) ) as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => $r[1], 'callback' => array( __CLASS__, $r[2] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	/* ------------------------------------------------------------------ coins */

	public static function coins( $uid ) {
		return (int) Sawa_Tracker_Game::m( $uid, 'coins', 0 );
	}

	/** Adds (or with a negative $n removes) coins. */
	public static function add_coins( $uid, $n, $reason = '' ) {
		$n = (int) $n;
		if ( ! $n || ! $uid ) {
			return 0;
		}
		Sawa_Tracker_Game::set( $uid, 'coins', max( 0, self::coins( $uid ) + $n ) );
		return $n;
	}

	private static function st( $uid ) {
		$s   = Sawa_Tracker_Game::m( $uid, 'raid', array() );
		$s   = is_array( $s ) ? $s : array();
		$day = Sawa_Tracker_Game::today();
		if ( ( $s['day'] ?? '' ) !== $day ) {
			$s = array( 'day' => $day, 'used' => 0, 'lost' => 0 ) + array_intersect_key( $s, array_flip( array( 'shield_until', 'peace', 'revenge' ) ) );
		}
		return $s + array( 'used' => 0, 'lost' => 0, 'shield_until' => 0, 'peace' => false, 'revenge' => array() );
	}

	private static function save_st( $uid, $s ) {
		Sawa_Tracker_Game::set( $uid, 'raid', $s );
	}

	/* ------------------------------------------------------------------ defence */

	/** Defence 0–100 from today's English: plan steps, a perfect day, the streak and the Healer's bonus. */
	public static function defence( $uid ) {
		$plan  = get_user_meta( $uid, 'sawa_lens_plan', true );
		$steps = is_array( $plan ) && ( $plan['day'] ?? '' ) === Sawa_Tracker_Game::today() ? count( (array) ( $plan['items'] ?? array() ) ) : 0;
		$live  = Sawa_Tracker_Game::live( $uid );
		$d     = 20 + $steps * 10 + min( 14, (int) $live['streak'] ) * 2 + ( $live['studiedToday'] ? 5 : 0 );
		if ( 'healer' === Sawa_Tracker_Game::m( $uid, 'class' ) ) {
			$d = (int) round( $d * 1.1 );
		}
		return min( 95, $d );
	}

	/** Raid-proof right now? (shield bought or earned, or a perfect day) */
	public static function shielded( $uid ) {
		$s = self::st( $uid );
		if ( (int) $s['shield_until'] > time() ) {
			return (int) $s['shield_until'];
		}
		$plan = get_user_meta( $uid, 'sawa_lens_plan', true );
		if ( is_array( $plan ) && ! empty( $plan['bonus'] ) && ( $plan['day'] ?? '' ) === Sawa_Tracker_Game::today() ) {
			return ( new DateTime( 'tomorrow', wp_timezone() ) )->getTimestamp(); // perfect day: safe until midnight
		}
		return 0;
	}

	private static function lootable( $uid ) {
		return max( 0, self::coins( $uid ) - self::SAFE_COINS );
	}

	/* ------------------------------------------------------------------ REST */

	private static function uid() {
		return get_current_user_id();
	}

	public static function state() {
		global $wpdb;
		$uid = self::uid();
		$s   = self::st( $uid );
		$t   = Sawa_Tracker_Game::table( 'events' );
		$log = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE type = 'raid' AND ( user_id = %d OR target_id = %d ) ORDER BY id DESC LIMIT 12", $uid, $uid ), ARRAY_A ); // phpcs:ignore
		$rev = array();
		foreach ( (array) $s['revenge'] as $id ) {
			$rev[] = Sawa_Tracker_Game::person( (int) $id );
		}
		return array(
			'coins'     => self::coins( $uid ),
			'safe'      => self::SAFE_COINS,
			'defence'   => self::defence( $uid ),
			'shield'    => self::shielded( $uid ),
			'raidsLeft' => max( 0, self::RAIDS_PER_DAY - (int) $s['used'] ),
			'peace'     => ! empty( $s['peace'] ),
			'revenge'   => $rev,
			'class'     => (string) Sawa_Tracker_Game::m( $uid, 'class' ),
			'shop'      => self::SHOP,
			'freezes'   => (int) Sawa_Tracker_Game::m( $uid, 'freezes', 0 ),
			'log'       => array_map( array( 'Sawa_Tracker_Rest', 'event_out' ), (array) $log ),
			'clanWar'   => self::clan_war(),
			'canBattle' => (bool) apply_filters( 'sawa_tracker_battle_ready', false ),
		);
	}

	/** This week's raid loot per clan. */
	public static function clan_war() {
		global $wpdb;
		$t    = Sawa_Tracker_Game::table( 'events' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT user_id, data FROM $t WHERE type = 'raid' AND created_at >= %s", Sawa_Tracker_Game::week_start() . ' 00:00:00' ), ARRAY_A ); // phpcs:ignore
		$by   = array();
		foreach ( (array) $rows as $r ) {
			$d    = json_decode( $r['data'], true );
			$clan = Sawa_Tracker_Social::clan_of( (int) $r['user_id'] );
			if ( ! $clan || empty( $d['won'] ) ) {
				continue;
			}
			$by[ $clan ] = ( $by[ $clan ] ?? 0 ) + (int) $d['loot'];
		}
		arsort( $by );
		$out = array();
		foreach ( array_slice( $by, 0, 8, true ) as $id => $loot ) {
			$c     = Sawa_Tracker_Social::clan( $id );
			$out[] = array( 'name' => $c ? $c['name'] : '?', 'emoji' => $c ? $c['emoji'] : '', 'loot' => $loot );
		}
		return $out;
	}

	/** Three opponents at a similar level, from other clans, who can be raided now. */
	public static function find() {
		$uid  = self::uid();
		$s    = self::st( $uid );
		if ( ! empty( $s['peace'] ) ) {
			return new WP_Error( 'peace', 'Peace mode is on. Switch it off to raid.', array( 'status' => 400 ) );
		}
		$mine = Sawa_Tracker_Social::clan_of( $uid );
		$myxp = class_exists( 'Sawa_Tracker_XP' ) ? Sawa_Tracker_XP::total( $uid ) : 0;
		$cand = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $id ) {
			if ( $id === $uid || '' === Sawa_Tracker_Game::m( $id, 'class' ) ) {
				continue;
			}
			$o = self::st( $id );
			if ( ! empty( $o['peace'] ) || (int) $o['lost'] >= 2 || self::shielded( $id ) || self::lootable( $id ) < 1 ) {
				continue;
			}
			if ( $mine && Sawa_Tracker_Social::clan_of( $id ) === $mine ) {
				continue; // never your own clan
			}
			$xp     = class_exists( 'Sawa_Tracker_XP' ) ? Sawa_Tracker_XP::total( $id ) : 0;
			$cand[] = array( 'id' => $id, 'gap' => abs( $xp - $myxp ) );
		}
		usort( $cand, function ( $a, $b ) { return $a['gap'] <=> $b['gap']; } );
		$cand = array_slice( $cand, 0, 8 );
		shuffle( $cand );
		$out = array();
		foreach ( array_slice( $cand, 0, 3 ) as $c ) {
			$clan  = Sawa_Tracker_Social::clan_of( $c['id'] );
			$cl    = $clan ? Sawa_Tracker_Social::clan( $clan ) : null;
			$out[] = Sawa_Tracker_Game::person( $c['id'] ) + array(
				'defence' => self::defence( $c['id'] ),
				'loot'    => min( self::MAX_LOOT, (int) ceil( self::lootable( $c['id'] ) * 0.15 ) ),
				'clan'    => $cl ? $cl['emoji'] . ' ' . $cl['name'] : '',
			);
		}
		return array( 'opponents' => $out );
	}

	public static function start( WP_REST_Request $r ) {
		$uid    = self::uid();
		$target = (int) $r->get_param( 'target' );
		$s      = self::st( $uid );
		$rev    = in_array( $target, array_map( 'intval', (array) $s['revenge'] ), true );
		if ( ! empty( $s['peace'] ) ) {
			return new WP_Error( 'peace', 'Peace mode is on.', array( 'status' => 400 ) );
		}
		if ( ! $rev && (int) $s['used'] >= self::RAIDS_PER_DAY ) {
			return new WP_Error( 'limit', 'No raids left today. Come back tomorrow!', array( 'status' => 400 ) );
		}
		if ( $target === $uid || ! Sawa_Tracker_Game::is_member( $target ) ) {
			return new WP_Error( 'target', 'Choose an opponent.', array( 'status' => 400 ) );
		}
		$o = self::st( $target );
		if ( ! empty( $o['peace'] ) || self::shielded( $target ) || (int) $o['lost'] >= 2 ) {
			return new WP_Error( 'target', 'This student is protected right now. Pick another.', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 5 );
		if ( count( $qs ) < 5 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		$id = wp_generate_password( 20, false );
		set_transient( 'sawa_tr_battle_' . $id, array( 'uid' => $uid, 'target' => $target, 'rev' => $rev, 'answers' => array_column( $qs, 'answer' ), 'qs' => $qs, 't' => time() ), 15 * MINUTE_IN_SECONDS );
		return array(
			'battle'    => $id,
			'questions' => array_map( function ( $q ) { return array( 'q' => $q['q'], 'options' => $q['options'] ); }, $qs ),
			'seconds'   => 20,
			'defender'  => Sawa_Tracker_Game::person( $target ) + array( 'defence' => self::defence( $target ) ),
		);
	}

	public static function answer( WP_REST_Request $r ) {
		$uid = self::uid();
		$b   = get_transient( 'sawa_tr_battle_' . sanitize_key( (string) $r->get_param( 'battle' ) ) );
		if ( ! is_array( $b ) || (int) $b['uid'] !== $uid ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		delete_transient( 'sawa_tr_battle_' . sanitize_key( (string) $r->get_param( 'battle' ) ) );
		$ans   = array_values( (array) $r->get_param( 'answers' ) );
		$right = 0;
		$fb    = array();
		foreach ( $b['answers'] as $i => $a ) {
			$ok = isset( $ans[ $i ] ) && (int) $ans[ $i ] === (int) $a;
			$right += $ok ? 1 : 0;
			$fb[]   = array( 'ok' => $ok, 'answer' => (int) $a, 'q' => $b['qs'][ $i ]['q'], 'right' => $b['qs'][ $i ]['options'][ $a ] ?? '' );
		}
		$target = (int) $b['target'];
		$attack = $right * 20 + ( 'warrior' === Sawa_Tracker_Game::m( $uid, 'class' ) ? 10 : 0 );
		$def    = self::defence( $target );
		$won    = $attack > $def && ! self::shielded( $target );
		$loot   = 0;
		$s      = self::st( $uid );
		if ( $b['rev'] ) {
			$s['revenge'] = array_values( array_diff( array_map( 'intval', (array) $s['revenge'] ), array( $target ) ) );
		} else {
			$s['used'] = (int) $s['used'] + 1;
		}
		if ( $won ) {
			$loot = min( self::MAX_LOOT, (int) ceil( self::lootable( $target ) * 0.15 ) );
			self::add_coins( $target, -$loot );
			self::add_coins( $uid, $loot );
			$o                 = self::st( $target );
			$o['lost']         = (int) $o['lost'] + 1;
			$o['shield_until'] = time() + 6 * HOUR_IN_SECONDS;
			$o['revenge']      = array_values( array_unique( array_merge( array_map( 'intval', (array) $o['revenge'] ), array( $uid ) ) ) );
			self::save_st( $target, $o );
		}
		self::add_coins( $uid, 2 + $right ); // everyone who fights with English earns something
		self::save_st( $uid, $s );
		// The defender sees it in their notifications (bell).
		Sawa_Tracker_Game::event( $uid, 'raid', $target, array( 'won' => $won, 'loot' => $loot, 'right' => $right ) );
		return array(
			'won'     => $won,
			'right'   => $right,
			'attack'  => $attack,
			'defence' => $def,
			'loot'    => $loot,
			'bonus'   => 2 + $right,
			'review'  => $fb,
		) + self::state();
	}

	public static function shop( WP_REST_Request $r ) {
		$uid  = self::uid();
		$item = sanitize_key( (string) $r->get_param( 'item' ) );
		if ( ! isset( self::SHOP[ $item ] ) ) {
			return new WP_Error( 'item', 'Unknown item.', array( 'status' => 400 ) );
		}
		$cost = self::SHOP[ $item ][0];
		if ( self::coins( $uid ) < $cost ) {
			return new WP_Error( 'coins', 'Not enough coins yet.', array( 'status' => 400 ) );
		}
		if ( 'freeze' === $item && (int) Sawa_Tracker_Game::m( $uid, 'freezes', 0 ) >= 3 ) {
			return new WP_Error( 'max', 'You already have 3 streak freezes.', array( 'status' => 400 ) );
		}
		self::add_coins( $uid, -$cost );
		if ( 'shield' === $item ) {
			$s                 = self::st( $uid );
			$s['shield_until'] = max( time(), (int) $s['shield_until'] ) + 12 * HOUR_IN_SECONDS;
			self::save_st( $uid, $s );
		} else {
			Sawa_Tracker_Game::set( $uid, 'freezes', (int) Sawa_Tracker_Game::m( $uid, 'freezes', 0 ) + 1 );
		}
		return self::state();
	}

	public static function peace( WP_REST_Request $r ) {
		$uid        = self::uid();
		$s          = self::st( $uid );
		$s['peace'] = (bool) $r->get_param( 'on' );
		self::save_st( $uid, $s );
		return self::state();
	}
}
