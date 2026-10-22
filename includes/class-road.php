<?php
/**
 * The learning road: five camps along the road from each town's east gate to its boss
 * (📺 video → 🎵 song → 📖 story → 🃏 the day's review cards → ✍️ write), walked once a day.
 * Each camp opens a Sawa Lens feature inside the game; finishing one opens the next.
 * The study itself is counted by Sawa Lens (XP, study minutes, the tracker log); the road adds
 * a few coins, a bonus for the whole road, and a line in the feed.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Road {

	/** key => [icon, name]. The order is the order along the road. */
	const STATIONS = array(
		'video' => array( '📺', 'Video' ),
		'song'  => array( '🎵', 'Song' ),
		'story' => array( '📖', 'Story' ),
		'cards' => array( '🃏', 'Cards' ),
		'write' => array( '✍️', 'Write' ),
	);
	const STATION_COINS = 5;
	const ROAD_COINS    = 25;
	const ROAD_XP       = 20;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		register_rest_route( Sawa_Tracker_Rest::NS, '/world/road', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'done_rest' ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
	}

	/** Sawa Lens is there and open for this student (the road needs it). */
	private static function lens( $uid ) {
		return class_exists( 'Sawa_Lens_App' ) && class_exists( 'Sawa_Lens_Auth' ) && Sawa_Lens_Auth::allowed( $uid ) && Sawa_Lens_App::is_open_for( $uid );
	}

	/** The camps this student can use today (a camp without content is left out of the road). */
	public static function available( $uid ) {
		if ( ! self::lens( $uid ) ) {
			return array();
		}
		$has_lessons = class_exists( 'Sawa_Lens_Lessons' ) && count( Sawa_Lens_Lessons::all( true ) ) > 0;
		$on          = array(
			'video' => (bool) apply_filters( 'sawa_tracker_road_video', $has_lessons, $uid ),
			'song'  => (bool) apply_filters( 'sawa_tracker_road_song', class_exists( 'Sawa_Lens_Songs' ) && Sawa_Lens_Songs::allowed( $uid ), $uid ),
			'story' => class_exists( 'Sawa_Lens_Readers' ) && Sawa_Lens_Readers::allowed( $uid ),
			'cards' => class_exists( 'Sawa_Lens_Review' ),
			'write' => class_exists( 'Sawa_Lens_AI' ),
		);
		return array_keys( array_filter( $on ) );
	}

	private static function today_done( $uid ) {
		$r = Sawa_Tracker_Game::m( $uid, 'road', array() );
		return is_array( $r ) && ( $r['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (array) ( $r['done'] ?? array() ) : array();
	}

	/** Today's road for the game: every camp with its state (done / open / locked), and the one to go to next. */
	public static function state( $uid ) {
		$keys = self::available( $uid );
		$done = self::today_done( $uid );
		$out  = array();
		$next = '';
		foreach ( $keys as $k ) {
			$is = in_array( $k, $done, true );
			if ( ! $is && ! $next ) {
				$next = $k;
			}
			$out[] = array(
				'k'     => $k,
				'icon'  => self::STATIONS[ $k ][0],
				'name'  => self::STATIONS[ $k ][1],
				'state' => $is ? 'done' : ( $next === $k ? 'open' : 'locked' ),
			);
		}
		return array(
			'stations' => $out,
			'next'     => $next,
			'done'     => count( array_intersect( $keys, $done ) ),
			'total'    => count( $keys ),
			'complete' => $keys && ! $next,
		);
	}

	/** A camp finished: the next one opens. Doing a camp again later the same day is fine (it still counts as study). */
	public static function done_rest( WP_REST_Request $r ) {
		$uid = get_current_user_id();
		$k   = sanitize_key( (string) $r->get_param( 'station' ) );
		$st  = self::state( $uid );
		$all = wp_list_pluck( $st['stations'], 'state', 'k' );
		if ( ! isset( $all[ $k ] ) ) {
			return new WP_Error( 'road', 'This camp is not on your road today.', array( 'status' => 400 ) );
		}
		if ( 'done' === $all[ $k ] ) {
			return array( 'coins' => 0, 'complete' => false, 'road' => $st );
		}
		if ( 'locked' === $all[ $k ] ) {
			return new WP_Error( 'road', 'Finish the ' . self::STATIONS[ $st['next'] ][1] . ' camp first: it is the next one on your road.', array( 'status' => 400 ) );
		}
		if ( 'story' === $k && class_exists( 'Sawa_Lens_Readers' ) && ! Sawa_Lens_Readers::read_today( $uid ) ) {
			return new WP_Error( 'road', 'Finish reading the story first (the quick check at the end).', array( 'status' => 400 ) );
		}
		$done   = self::today_done( $uid );
		$done[] = $k;
		Sawa_Tracker_Game::set( $uid, 'road', array( 'day' => Sawa_Tracker_Game::today(), 'done' => array_values( array_unique( $done ) ), 't' => Sawa_Tracker_World::at( $uid ) ) );
		Sawa_Tracker_Raids::add_coins( $uid, self::STATION_COINS, 'road' );
		$coins = self::STATION_COINS;
		$st    = self::state( $uid );
		$out   = array( 'coins' => $coins, 'complete' => $st['complete'], 'road' => $st );
		if ( $st['complete'] ) {
			Sawa_Tracker_Raids::add_coins( $uid, self::ROAD_COINS, 'road' );
			Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
			$out['coins']  += self::ROAD_COINS;
			$out['elixirs'] = 1;
			$out['xp']      = class_exists( 'Sawa_Tracker_XP' ) ? (int) Sawa_Tracker_XP::award( $uid, self::ROAD_XP, 'road' ) : 0;
			$town           = Sawa_Tracker_World::TOWNS[ Sawa_Tracker_World::at( $uid ) ];
			Sawa_Tracker_Game::event( $uid, 'road', null, array( 'town' => $town[0], 'icons' => implode( '', wp_list_pluck( $st['stations'], 'icon' ) ), 'n' => $st['total'] ) );
			Sawa_Tracker_Game::set( $uid, 'road_days', (int) Sawa_Tracker_Game::m( $uid, 'road_days', 0 ) + 1 );
		}
		$out['world'] = Sawa_Tracker_World::state( $uid );
		return $out;
	}
}
