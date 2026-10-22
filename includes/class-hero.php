<?php
/**
 * The Silk Road character: level, health, mana and arena rank.
 *
 * - Level comes from XP (everything learned and written in English). Each level raises max health and mana, gives
 *   coins, and unlocks gear grades, titles and an aura other players can see.
 * - Health (❤: 70 at level 1, +8 a level) is lost when a monster hits you after a wrong answer. It comes back slowly by itself and quickly by
 *   reviewing word cards (resting at the inn). At 0 you are knocked out and wake up at the inn.
 * - Mana (💧) is earned only by studying today (cards, plan steps, practice, writing and speaking) and is spent
 *   on battle skills.
 * - Arena rating goes up and down with shadow duels (Elo), and sets the arena rank shown next to your name.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Hero {

	const MAX_LEVEL = 50;
	const TITLES    = array( 1 => 'Traveller', 5 => 'Wanderer', 10 => 'Caravan Guard', 15 => 'Silk Merchant', 20 => 'Desert Knight', 25 => 'Road Master', 30 => 'Sultan of Words', 40 => 'Legend of the Road' );
	const RANKS     = array( 0 => 'Bronze', 1050 => 'Silver', 1150 => 'Gold', 1300 => 'Platinum', 1450 => 'Diamond', 1650 => 'Legend' );
	/** Mana for studying: [per action, daily cap]. */
	const MANA_FOR  = array( 'card' => array( 2, 60 ), 'practice' => array( 10, 40 ), 'use' => array( 3, 30 ), 'plan' => array( 8, 32 ), 'perfect' => array( 15, 15 ), 'scan' => array( 5, 15 ), 'saved' => array( 1, 20 ) );
	/** Battle skills: [name, mana, what it does]. */
	const SKILLS    = array(
		'focus' => array( 'Focus', 10, 'Removes one wrong answer.' ),
		'hint'  => array( 'Insight', 10, 'Shows a hint.' ),
		'power' => array( 'Power strike', 15, 'Your next right answer hits twice as hard.' ),
		'heal'  => array( 'Second breath', 20, 'Heals 40% of your health.' ),
	);

	public static function init() {
		add_action( 'sawa_tracker_xp', array( __CLASS__, 'check_level' ), 10, 2 );
	}

	/** XP needed to reach a level: 50 × L × (L − 1) (level 2 = 100, 5 = 1,000, 10 = 4,500, 20 = 19,000). */
	public static function xp_for( $level ) {
		return 50 * $level * ( $level - 1 );
	}

	public static function level_of( $xp ) {
		$l = 1;
		while ( $l < self::MAX_LEVEL && $xp >= self::xp_for( $l + 1 ) ) {
			$l++;
		}
		return $l;
	}

	public static function level( $uid ) {
		return self::level_of( class_exists( 'Sawa_Tracker_XP' ) ? Sawa_Tracker_XP::total( $uid ) : 0 );
	}

	public static function title( $level ) {
		$t = 'Traveller';
		foreach ( self::TITLES as $l => $name ) {
			if ( $level >= $l ) {
				$t = $name;
			}
		}
		return $t;
	}

	public static function rank( $rating ) {
		$r = 'Bronze';
		foreach ( self::RANKS as $min => $name ) {
			if ( $rating >= $min ) {
				$r = $name;
			}
		}
		return $r;
	}

	private static function raw( $uid ) {
		$h = Sawa_Tracker_Game::m( $uid, 'hero', array() );
		$h = ( is_array( $h ) ? $h : array() ) + array( 'season' => '' );
		if ( isset( $h['rating'] ) && $h['season'] !== wp_date( 'Y-m' ) ) {
			$h['rating'] = (int) round( 1000 + ( $h['rating'] - 1000 ) / 2 ); // a new arena season
		}
		$h['season'] = wp_date( 'Y-m' );
		return $h + array( 'hp' => null, 'hpAt' => time(), 'mana' => 20, 'manaDay' => array(), 'rating' => 1000, 'duels' => array( 'won' => 0, 'lost' => 0 ), 'lv' => 0, 'kills' => 0, 'bosses' => 0 );
	}

	private static function save( $uid, $h ) {
		Sawa_Tracker_Game::set( $uid, 'hero', $h );
	}

	public static function max_hp( $uid, $level = null ) {
		$level = $level ? $level : self::level( $uid );
		return 70 + 8 * ( $level - 1 ) + (int) round( 100 * Sawa_Tracker_RPG::slot_bonus( Sawa_Tracker_RPG::get( $uid ), 'armor' ) );
	}

	public static function max_mana( $level ) {
		return 50 + 5 * ( $level - 1 );
	}

	/** Health right now: 1 point a minute comes back by itself. */
	public static function hp( $uid ) {
		$h   = self::raw( $uid );
		$max = self::max_hp( $uid );
		$cap = class_exists( 'Sawa_Tracker_Wounds' ) ? Sawa_Tracker_Wounds::cap( $uid, $max ) : $max; // days without studying hurt
		if ( null === $h['hp'] ) {
			return $cap;
		}
		return (int) min( $cap, $h['hp'] + floor( ( time() - (int) $h['hpAt'] ) / 60 ) );
	}

	public static function set_hp( $uid, $hp ) {
		$h         = self::raw( $uid );
		$h['hp']   = (int) max( 0, min( self::max_hp( $uid ), $hp ) );
		$h['hpAt'] = time();
		self::save( $uid, $h );
	}

	public static function mana( $uid ) {
		$h = self::raw( $uid );
		return (int) min( self::max_mana( self::level( $uid ) ), $h['mana'] );
	}

	public static function add_mana( $uid, $n ) {
		$h         = self::raw( $uid );
		$h['mana'] = (int) max( 0, min( self::max_mana( self::level( $uid ) ), (int) $h['mana'] + $n ) );
		self::save( $uid, $h );
		return $h['mana'];
	}

	/** Studying gives mana (with a daily cap per kind) and reviewing cards heals. Called from World::progress. */
	public static function studied( $uid, $kind, $n ) {
		if ( 'card' === $kind ) {
			self::set_hp( $uid, self::hp( $uid ) + 5 * $n );
		}
		if ( ! isset( self::MANA_FOR[ $kind ] ) ) {
			return;
		}
		$h   = self::raw( $uid );
		$day = Sawa_Tracker_Game::today();
		$got = ( $h['manaDay']['day'] ?? '' ) === $day ? (array) ( $h['manaDay']['got'] ?? array() ) : array();
		$add = min( self::MANA_FOR[ $kind ][0] * $n, self::MANA_FOR[ $kind ][1] - (int) ( $got[ $kind ] ?? 0 ) );
		if ( $add <= 0 ) {
			return;
		}
		$got[ $kind ]  = (int) ( $got[ $kind ] ?? 0 ) + $add;
		$h['manaDay']  = array( 'day' => $day, 'got' => $got );
		$h['mana']     = (int) min( self::max_mana( self::level( $uid ) ), (int) $h['mana'] + $add );
		self::save( $uid, $h );
	}

	/** Level ups: coins, a feed post and a notification. Runs after every XP award. */
	public static function check_level( $uid, $n = 0 ) {
		$h  = self::raw( $uid );
		$lv = self::level( $uid );
		if ( ! $h['lv'] ) {
			$h['lv'] = $lv; // first time: no rewards for the past
			self::save( $uid, $h );
			return;
		}
		if ( $lv <= (int) $h['lv'] ) {
			return;
		}
		for ( $l = (int) $h['lv'] + 1; $l <= $lv; $l++ ) {
			Sawa_Tracker_Raids::add_coins( $uid, 10 * $l );
			if ( 0 === $l % 5 ) {
				Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
			}
		}
		$h['lv']   = $lv;
		$h['hp']   = null; // full health on a level up
		$h['mana'] = self::max_mana( $lv );
		self::save( $uid, $h );
		Sawa_Tracker_Game::event( $uid, 'hero_level', null, array( 'level' => $lv, 'title' => self::title( $lv ) ) );
	}

	public static function duel_result( $uid, $vs, $won ) {
		$a  = self::raw( $uid );
		$b  = self::raw( $vs );
		$ea = 1 / ( 1 + pow( 10, ( $b['rating'] - $a['rating'] ) / 400 ) );
		$d  = (int) round( 32 * ( ( $won ? 1 : 0 ) - $ea ) );
		$a['rating']                         = max( 600, (int) $a['rating'] + $d );
		$a['duels'][ $won ? 'won' : 'lost' ] = (int) ( $a['duels'][ $won ? 'won' : 'lost' ] ?? 0 ) + 1;
		self::save( $uid, $a );
		return $d;
	}

	public static function count( $uid, $what ) {
		$h          = self::raw( $uid );
		$h[ $what ] = (int) ( $h[ $what ] ?? 0 ) + 1;
		self::save( $uid, $h );
	}

	/** Everything shown over a character and in the HUD. */
	public static function sheet( $uid ) {
		$h  = self::raw( $uid );
		$xp = class_exists( 'Sawa_Tracker_XP' ) ? Sawa_Tracker_XP::total( $uid ) : 0;
		$lv = self::level_of( $xp );
		return array(
			'level'    => $lv,
			'xp'       => $xp,
			'xpFrom'   => self::xp_for( $lv ),
			'xpNext'   => $lv < self::MAX_LEVEL ? self::xp_for( $lv + 1 ) : $xp,
			'hp'       => self::hp( $uid ),
			'hpMax'    => self::max_hp( $uid, $lv ),
			'mana'     => (int) min( self::max_mana( $lv ), $h['mana'] ),
			'manaMax'  => self::max_mana( $lv ),
			'title'    => self::title( $lv ),
			'rating'   => (int) $h['rating'],
			'rank'     => self::rank( (int) $h['rating'] ),
			'duels'    => $h['duels'],
			'kills'    => (int) $h['kills'],
			'bosses'   => (int) $h['bosses'],
			'aura'     => $lv >= 30 ? 'jade' : ( $lv >= 20 ? 'gold' : ( $lv >= 10 ? 'silver' : '' ) ),
		);
	}

	/** The weekly Silk Road report: who learned and fought most this week (also as a Skool post). */
	public static function report() {
		global $wpdb;
		$from = Sawa_Tracker_Game::week_start();
		$rows = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $m ) {
			$rows[] = Sawa_Tracker_Game::person( $m ) + array( 'week' => (int) Sawa_Tracker_XP::week( $m ), 'level' => self::level( $m ), 'words' => (int) apply_filters( 'sawa_tracker_words_since', 0, $m, $from ) );
		}
		$top = function ( $key, $n ) use ( $rows ) { usort( $rows, function ( $a, $b ) use ( $key ) { return $b[ $key ] <=> $a[ $key ]; } ); return array_values( array_filter( array_slice( $rows, 0, $n ), function ( $r ) use ( $key ) { return $r[ $key ] > 0; } ) ); };
		$t      = Sawa_Tracker_Game::table( 'events' );
		$evs    = $wpdb->get_results( $wpdb->prepare( "SELECT user_id, type, data FROM $t WHERE type IN ('hero_level','town','party_down','coop_built') AND created_at >= %s ORDER BY id DESC LIMIT 40", $from . ' 00:00:00' ), ARRAY_A ); // phpcs:ignore
		$moments = array();
		foreach ( (array) $evs as $e ) {
			$d = json_decode( $e['data'], true );
			$n = Sawa_Tracker_Game::person( (int) $e['user_id'] )['name'];
			$moments[] = 'coop_built' === $e['type'] ? 'The community built the caravanserai together (' . (int) $d['builders'] . ' builders)' : ( 'hero_level' === $e['type'] ? $n . ' reached level ' . $d['level'] . ' (' . $d['title'] . ')' : ( 'town' === $e['type'] ? $n . ' defeated the ' . $d['boss'] . ' in ' . $d['town'] : 'The party ' . $d['party'] . ' defeated the ' . $d['boss'] ) );
		}
		return array( 'xp' => $top( 'week', 5 ), 'words' => $top( 'words', 3 ), 'moments' => array_slice( $moments, 0, 8 ), 'from' => $from );
	}

	/** The rankings: level, this week's XP, arena rating. */
	public static function ranks( $uid ) {
		$rows = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $m ) {
			$s      = self::sheet( $m );
			$rows[] = Sawa_Tracker_Game::person( $m ) + array( 'level' => $s['level'], 'xp' => $s['xp'], 'week' => (int) Sawa_Tracker_XP::week( $m ), 'rating' => $s['rating'], 'rank' => $s['rank'], 'title' => $s['title'], 'aura' => $s['aura'] );
		}
		$out = array();
		foreach ( array( 'level' => 'xp', 'week' => 'week', 'arena' => 'rating' ) as $board => $key ) {
			usort( $rows, function ( $a, $b ) use ( $key ) { return $b[ $key ] <=> $a[ $key ]; } );
			$me  = array_search( $uid, array_column( $rows, 'id' ), true );
			$out[ $board ] = array( 'top' => array_slice( $rows, 0, 20 ), 'me' => false === $me ? null : $me + 1 );
		}
		return $out;
	}
}
