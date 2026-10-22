<?php
/**
 * Wounds: a Silk Road hero who doesn't study gets hurt, and the clan feels it.
 *
 * - Every full day without studying takes a quarter of the hero's health away (their highest health drops). After
 *   4 days they have fallen and can't fight. Studying again ends it: from that day the wound is gone and health
 *   comes back as usual.
 * - Clanmates can help a little, once a day each, with mana (which only comes from studying): a heal gives back a
 *   tenth of the health (a quarter from a Healer), at most two heals a day. A fallen hero needs two revives from
 *   different clanmates (a Healer's revive counts twice) and comes back at half health.
 * - While a clanmate is badly hurt (2+ days) or fallen, everyone else in the clan has one fight less a day (two
 *   with two or more hurt clanmates). Nobody progresses as fast when someone is missing. Clanmates gone for more than
 *   two weeks count as away and don't slow the clan down.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Wounds {

	const PER_DAY     = 0.25;
	const FALL_DAYS   = 4;
	const HEAL        = 0.10;
	const HEAL_HEALER = 0.25;
	const HEALS_DAY   = 2;
	const HEAL_MANA   = 20;
	const REVIVE_MANA = 30;
	const AWAY_DAYS   = 14; // after two weeks without studying a clanmate counts as away

	private static $cache = array();

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		foreach ( array( array( '/clan/heal', 'heal' ), array( '/clan/revive', 'revive' ) ) as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => 'POST', 'callback' => array( __CLASS__, $r[1] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	/** The last day this student studied (or the day before they joined). */
	private static function last_day( $uid ) {
		global $wpdb;
		$d = $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(day) FROM ' . Sawa_Tracker_Game::table( 'days' ) . ' WHERE user_id = %d AND minutes > 0', $uid ) ); // phpcs:ignore
		if ( ! $d ) {
			$u = get_userdata( $uid );
			$d = Sawa_Tracker_Game::add_days( $u ? wp_date( 'Y-m-d', strtotime( $u->user_registered . ' UTC' ) ) : Sawa_Tracker_Game::today(), -1 );
		}
		return $d;
	}

	/** Full days without studying (today doesn't count until it is over). */
	public static function missed( $uid ) {
		if ( ! isset( self::$cache[ $uid ] ) ) {
			$last  = self::last_day( $uid );
			$days  = (int) round( ( strtotime( Sawa_Tracker_Game::today() ) - strtotime( $last ) ) / DAY_IN_SECONDS );
			self::$cache[ $uid ] = array( 'last' => $last, 'missed' => max( 0, $days - 1 ) );
		}
		return self::$cache[ $uid ];
	}

	/** Care from clanmates since the last study day: [heal share, revive count, who, heals today]. */
	private static function care( $uid ) {
		$m    = self::missed( $uid );
		$c    = Sawa_Tracker_Game::m( $uid, 'wcare', array() );
		$c    = is_array( $c ) && ( $c['since'] ?? '' ) === $m['last'] ? $c : array( 'since' => $m['last'], 'heal' => 0, 'revive' => 0, 'by' => array(), 'day' => '', 'n' => 0 );
		if ( $c['day'] !== Sawa_Tracker_Game::today() ) {
			$c['day'] = Sawa_Tracker_Game::today();
			$c['n']   = 0;
			$c['by']  = array();
		}
		return $c;
	}

	/** This hero's wound: level (days, max 4), the share of health they can have, fallen. */
	public static function of( $uid ) {
		$m      = self::missed( $uid );
		$lv     = min( self::FALL_DAYS, $m['missed'] );
		$c      = self::care( $uid );
		$revive = $c['revive'] >= 2 ? 0.5 : 0;
		$cap    = min( 1, max( $revive, 1 - self::PER_DAY * $lv ) + (float) $c['heal'] );
		return array( 'level' => $lv, 'days' => $m['missed'], 'cap' => round( $cap, 2 ), 'fallen' => $lv >= self::FALL_DAYS && $cap <= 0, 'revives' => (int) $c['revive'], 'heals' => (int) $c['n'] );
	}

	/** The most health this hero can have right now. */
	public static function cap( $uid, $max ) {
		$w = self::of( $uid );
		return (int) floor( $max * $w['cap'] );
	}

	/** Clanmates who are hurt (for the game: they lie at the inn, and you can help). */
	public static function clan( $uid ) {
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		if ( ! $clan ) {
			return array();
		}
		$out = array();
		foreach ( Sawa_Tracker_Social::clan_members( $clan ) as $m ) {
			if ( (int) $m === (int) $uid || ! Sawa_Tracker_Game::is_member( (int) $m ) ) {
				continue;
			}
			$w = self::of( (int) $m );
			if ( $w['level'] < 1 || $w['days'] > self::AWAY_DAYS ) { // gone for weeks: away, not hurting the clan
				continue;
			}
			$c     = self::care( (int) $m );
			$out[] = array( 'id' => (int) $m, 'name' => Sawa_Tracker_Game::person( (int) $m )['name'], 'avatar' => Sawa_Tracker_Play::avatar( (int) $m ), 'wound' => $w, 'helped' => in_array( (int) $uid, array_map( 'intval', (array) $c['by'] ), true ) );
		}
		return $out;
	}

	/** One fight less a day for every clanmate who is badly hurt or fallen (at most two). */
	public static function penalty( $uid ) {
		return min( 2, count( array_filter( self::clan( $uid ), function ( $c ) { return $c['wound']['level'] >= 2; } ) ) );
	}

	private static function check( $uid, $to ) {
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		if ( ! $clan || Sawa_Tracker_Social::clan_of( $to ) !== $clan || $to === $uid ) {
			return new WP_Error( 'clan', 'You can only help travellers in your own clan.', array( 'status' => 400 ) );
		}
		$c = self::care( $to );
		if ( in_array( $uid, array_map( 'intval', (array) $c['by'] ), true ) ) {
			return new WP_Error( 'clan', 'You already helped them today. Send them a message instead!', array( 'status' => 400 ) );
		}
		return $c;
	}

	public static function heal( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$to  = (int) $r->get_param( 'user' );
		$c   = self::check( $uid, $to );
		if ( is_wp_error( $c ) ) {
			return $c;
		}
		$w = self::of( $to );
		if ( $w['level'] < 1 || $w['fallen'] ) {
			return new WP_Error( 'clan', $w['fallen'] ? 'They have fallen: they need a revive.' : 'They are not hurt.', array( 'status' => 400 ) );
		}
		if ( $c['n'] >= self::HEALS_DAY ) {
			return new WP_Error( 'clan', 'They had 2 heals today. Only studying can heal them more!', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Hero::mana( $uid ) < self::HEAL_MANA ) {
			return new WP_Error( 'mana', 'Not enough mana (20 💧). Study a little to get more.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Hero::add_mana( $uid, -self::HEAL_MANA );
		$pct       = 'healer' === Sawa_Tracker_Combat::role( $uid ) ? self::HEAL_HEALER : self::HEAL;
		$c['heal'] = (float) $c['heal'] + $pct;
		$c['n']    = (int) $c['n'] + 1;
		$c['by'][] = $uid;
		Sawa_Tracker_Game::set( $to, 'wcare', $c );
		self::$cache = array();
		$max = Sawa_Tracker_Hero::max_hp( $to );
		Sawa_Tracker_Hero::set_hp( $to, Sawa_Tracker_Hero::hp( $to ) + (int) round( $pct * $max ) );
		Sawa_Tracker_Game::event( $uid, 'clan_heal', $to, array( 'pct' => (int) round( 100 * $pct ) ) );
		return array( 'ok' => true, 'pct' => (int) round( 100 * $pct ), 'clan' => self::clan( $uid ), 'mana' => Sawa_Tracker_Hero::mana( $uid ) );
	}

	public static function revive( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$to  = (int) $r->get_param( 'user' );
		$c   = self::check( $uid, $to );
		if ( is_wp_error( $c ) ) {
			return $c;
		}
		if ( ! self::of( $to )['fallen'] ) {
			return new WP_Error( 'clan', 'They have not fallen. A heal is enough.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Hero::mana( $uid ) < self::REVIVE_MANA ) {
			return new WP_Error( 'mana', 'Not enough mana (30 💧). Study a little to get more.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Hero::add_mana( $uid, -self::REVIVE_MANA );
		$c['revive'] = (int) $c['revive'] + ( 'healer' === Sawa_Tracker_Combat::role( $uid ) ? 2 : 1 );
		$c['by'][]   = $uid;
		Sawa_Tracker_Game::set( $to, 'wcare', $c );
		self::$cache = array();
		$back = $c['revive'] >= 2;
		if ( $back ) {
			Sawa_Tracker_Hero::set_hp( $to, (int) round( 0.5 * Sawa_Tracker_Hero::max_hp( $to ) ) );
		}
		Sawa_Tracker_Game::event( $uid, 'clan_revive', $to, array( 'back' => $back ) );
		return array( 'ok' => true, 'back' => $back, 'clan' => self::clan( $uid ), 'mana' => Sawa_Tracker_Hero::mana( $uid ) );
	}
}
