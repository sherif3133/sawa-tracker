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
	/** The weekly chapters (one a week, in turn), and what walking the whole road on 3, 5 and 7 days of the week gives: [coins, elixirs, title]. */
	const CHAPTERS = array(
		array( 'The Spice Caravan', 'Merchants carry pepper and cinnamon west. Walk the road with them: every camp you finish moves the caravan.' ),
		array( 'Lanterns on the Road', 'The lantern festival is coming. Light the road: every camp you finish is one more lantern.' ),
		array( 'The Lost Map', 'A traveller lost the old map of the Silk Road. Every camp you finish finds one more piece of it.' ),
		array( 'The Silk Market', 'The great silk market opens at the end of the week. Every camp you finish brings one more roll of silk.' ),
		array( 'Storm in the Desert', 'A sandstorm is coming. Travellers who study together get through it: every camp builds a shelter.' ),
		array( 'The Poets of the Road', 'Poets from every town meet this week. Every camp you finish gives them one more word for their poems.' ),
		array( 'The Wells of the Road', 'The wells on the road are drying up. Every camp you finish digs a little deeper.' ),
		array( 'The Ambassador', 'An ambassador travels west to make peace. Every camp you finish keeps the road safe for her.' ),
	);
	const TIERS = array(
		3 => array( 30, 0, '' ),
		5 => array( 50, 1, 'Road Walker' ),
		7 => array( 100, 1, 'Pilgrim of the Silk Road' ),
	);
	const GROUP_MIN   = 40; // camps the community needs at least in a week
	const GROUP_EACH  = 12; // more camps for each student who walked the road last week
	const GROUP_COINS = 30;
	const GROUP_NEED  = 3;  // your own camps this week to share the reward

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 20 );
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
			'chapter'  => $keys ? self::chapter( $uid ) : null,
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
		$group = self::group_add( $uid );
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
			$out['week'] = self::week_day( $uid );
		}
		if ( $group ) {
			$out['group'] = $group;
		}
		$out['road']  = self::state( $uid );
		$out['world'] = Sawa_Tracker_World::state( $uid );
		return $out;
	}

	/* ------------------------------------------------------------------ the weekly chapter */

	private static function chapter_no() {
		$n = (int) floor( ( strtotime( Sawa_Tracker_Game::week_start() ) - strtotime( '2026-10-17' ) ) / WEEK_IN_SECONDS ) + 1;
		return max( 1, $n );
	}

	private static function week( $uid ) {
		$w = Sawa_Tracker_Game::m( $uid, 'road_wk', array() );
		return is_array( $w ) && ( $w['wk'] ?? '' ) === Sawa_Tracker_Game::week_start() ? $w : array( 'wk' => Sawa_Tracker_Game::week_start(), 'days' => array(), 'camps' => 0 );
	}

	/** This week's chapter: your road days, the 3 / 5 / 7-day rewards, and the community goal. */
	public static function chapter( $uid ) {
		$n     = self::chapter_no();
		$c     = self::CHAPTERS[ ( $n - 1 ) % count( self::CHAPTERS ) ];
		$w     = self::week( $uid );
		$days  = count( $w['days'] );
		$tiers = array();
		foreach ( self::TIERS as $d => $t ) {
			$tiers[] = array( 'days' => $d, 'coins' => $t[0], 'elixirs' => $t[1], 'title' => $t[2], 'got' => $days >= $d );
		}
		$g = self::group();
		return array(
			'n'     => $n,
			'title' => $c[0],
			'text'  => $c[1],
			'days'  => $days,
			'today' => in_array( Sawa_Tracker_Game::today(), $w['days'], true ),
			'tiers' => $tiers,
			'group' => array( 'camps' => (int) $g['camps'], 'target' => (int) $g['target'], 'people' => count( $g['people'] ), 'reached' => ! empty( $g['reached'] ), 'mine' => (int) ( $g['people'][ $uid ] ?? 0 ), 'need' => self::GROUP_NEED, 'coins' => self::GROUP_COINS ),
		);
	}

	/** The whole road walked today: one more day in this week's chapter (rewards at 3, 5 and 7 days). */
	private static function week_day( $uid ) {
		$w   = self::week( $uid );
		$day = Sawa_Tracker_Game::today();
		if ( in_array( $day, $w['days'], true ) ) {
			return null;
		}
		$w['days'][] = $day;
		Sawa_Tracker_Game::set( $uid, 'road_wk', $w );
		$n = count( $w['days'] );
		if ( ! isset( self::TIERS[ $n ] ) ) {
			return array( 'days' => $n );
		}
		$t = self::TIERS[ $n ];
		Sawa_Tracker_Raids::add_coins( $uid, $t[0], 'road' );
		if ( $t[1] ) {
			Sawa_Tracker_RPG::add_elixirs( $uid, $t[1] );
		}
		if ( $t[2] ) {
			$wd = Sawa_Tracker_World::get( $uid );
			if ( ! in_array( $t[2], $wd['titles'], true ) ) {
				$wd['titles'][] = $t[2];
				Sawa_Tracker_World::save( $uid, $wd );
			}
			Sawa_Tracker_Game::event( $uid, 'road_week', null, array( 'days' => $n, 'title' => $t[2], 'chapter' => self::CHAPTERS[ ( self::chapter_no() - 1 ) % count( self::CHAPTERS ) ][0] ) );
		}
		return array( 'days' => $n, 'coins' => $t[0], 'elixirs' => $t[1], 'title' => $t[2] );
	}

	/* ------------------------------------------------------------------ the community goal: camps finished together this week */

	private static function group() {
		$g  = get_option( 'sawa_tr_road_group', array() );
		$wk = Sawa_Tracker_Game::week_start();
		if ( ! is_array( $g ) || ( $g['wk'] ?? '' ) !== $wk ) {
			$last = is_array( $g ) ? count( (array) ( $g['people'] ?? array() ) ) : 0;
			$g    = array( 'wk' => $wk, 'camps' => 0, 'people' => array(), 'paid' => array(), 'reached' => false, 'target' => max( self::GROUP_MIN, self::GROUP_EACH * $last ) );
			update_option( 'sawa_tr_road_group', $g, false );
		}
		return $g;
	}

	/** One more camp for the community. Once the goal is reached, everyone with 3+ camps this week gets coins and an elixir (those who get there later too). */
	private static function group_add( $uid ) {
		$g                   = self::group();
		$g['camps']          = (int) $g['camps'] + 1;
		$g['people'][ $uid ] = (int) ( $g['people'][ $uid ] ?? 0 ) + 1;
		$out                 = null;
		if ( ! $g['reached'] && $g['camps'] >= $g['target'] ) {
			$g['reached'] = true;
			Sawa_Tracker_Game::event( $uid, 'road_group', null, array( 'camps' => $g['camps'], 'people' => count( $g['people'] ) ) );
			$out = array( 'reached' => true );
		}
		if ( $g['reached'] ) {
			foreach ( $g['people'] as $id => $n ) {
				if ( $n >= self::GROUP_NEED && ! in_array( (int) $id, $g['paid'], true ) ) {
					$g['paid'][] = (int) $id;
					Sawa_Tracker_Raids::add_coins( (int) $id, self::GROUP_COINS, 'road' );
					Sawa_Tracker_RPG::add_elixirs( (int) $id, 1 );
					if ( (int) $id === $uid ) {
						$out = array( 'reached' => true, 'paid' => true, 'coins' => self::GROUP_COINS );
					}
				}
			}
		}
		update_option( 'sawa_tr_road_group', $g, false );
		$w          = self::week( $uid );
		$w['camps'] = (int) ( $w['camps'] ?? 0 ) + 1;
		Sawa_Tracker_Game::set( $uid, 'road_wk', $w );
		return $out;
	}

	/* ------------------------------------------------------------------ admin: where every student is on the map */

	public static function menu() {
		add_submenu_page( 'sawa-tracker', 'Silk Road map', 'Silk Road map', 'manage_options', 'sawa-tracker-map', array( __CLASS__, 'page' ) );
	}

	/** Everyone who walked the Silk Road in the last 14 days: their town, the camp they are at, today's road and this week's chapter. */
	public static function rows() {
		global $wpdb;
		$rows = (array) $wpdb->get_results( $wpdb->prepare( "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s", 'sawa_wpos' ), ARRAY_A ); // phpcs:ignore
		$out  = array();
		$day  = Sawa_Tracker_Game::today();
		foreach ( $rows as $r ) {
			$p   = maybe_unserialize( $r['meta_value'] );
			$uid = (int) $r['user_id'];
			if ( ! is_array( $p ) || time() - (int) ( $p['at'] ?? 0 ) > 14 * DAY_IN_SECONDS || ! Sawa_Tracker_Game::is_member( $uid ) ) {
				continue;
			}
			$road  = Sawa_Tracker_Game::m( $uid, 'road', array() );
			$wk    = self::week( $uid );
			$ago   = time() - (int) $p['at'];
			$st    = (string) ( $p['st'] ?? '' );
			$out[] = array(
				'id'    => $uid,
				'name'  => (string) get_the_author_meta( 'display_name', $uid ),
				'town'  => (int) $p['t'],
				'ago'   => $ago,
				'at'    => $ago < 120 && isset( self::STATIONS[ $st ] ) ? $st : '',
				'zone'  => (int) $p['x'] > 36 * 16 ? 'road' : 'town',
				'done'  => is_array( $road ) && ( $road['day'] ?? '' ) === $day ? (array) $road['done'] : array(),
				'days'  => count( $wk['days'] ),
				'camps' => (int) ( $wk['camps'] ?? 0 ),
			);
		}
		usort( $out, function ( $a, $b ) { return $a['ago'] <=> $b['ago']; } );
		return $out;
	}

	public static function page() {
		$rows = self::rows();
		$ch   = self::chapter( get_current_user_id() );
		$ago  = function ( $s ) { return $s < 120 ? 'now' : ( $s < 3600 ? round( $s / 60 ) . ' min ago' : ( $s < DAY_IN_SECONDS ? round( $s / 3600 ) . ' h ago' : round( $s / DAY_IN_SECONDS ) . ' days ago' ) ); };
		$all  = count( array_filter( $rows, function ( $r ) { return count( $r['done'] ) >= count( self::STATIONS ); } ) );
		echo '<div class="wrap"><h1>Silk Road map</h1>';
		echo '<p>Where every student is on the Silk Road (last 14 days): their town, the camp they are at right now, today\'s learning road and this week\'s chapter. Refresh the page to update.</p>';
		echo '<p><b>Chapter ' . (int) $ch['n'] . ': ' . esc_html( $ch['title'] ) . '</b> · Community goal: ' . (int) $ch['group']['camps'] . ' / ' . (int) $ch['group']['target'] . ' camps by ' . (int) $ch['group']['people'] . ' students' . ( $ch['group']['reached'] ? ' ✅ reached' : '' ) . ' · ' . (int) $all . ' walked the whole road today.</p>';
		echo '<style>.srm{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.srm section{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:10px 12px}.srm h2{margin:0 0 8px;font-size:15px}.srm ul{margin:0}.srm li{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #f0f0f1;padding:5px 0;margin:0}.srm small{color:#646970}.srm .now{color:#15803d;font-weight:600}</style><div class="srm">';
		foreach ( Sawa_Tracker_World::TOWNS as $t => $town ) {
			$here = array_values( array_filter( $rows, function ( $r ) use ( $t ) { return $r['town'] === $t; } ) );
			echo '<section><h2>' . esc_html( $town[1] . ' ' . $town[0] . ' · ' . $town[2] ) . ' <small>(' . count( $here ) . ')</small></h2><ul>';
			foreach ( $here as $r ) {
				$icons = implode( '', array_map( function ( $k ) { return self::STATIONS[ $k ][0]; }, array_values( array_intersect( array_keys( self::STATIONS ), $r['done'] ) ) ) );
				$where = $r['at'] ? '<span class="now">' . esc_html( self::STATIONS[ $r['at'] ][0] . ' at the ' . strtolower( self::STATIONS[ $r['at'] ][1] ) . ' camp now' ) . '</span>' : esc_html( ( 'road' === $r['zone'] ? 'on the road' : 'in town' ) . ' · ' . $ago( $r['ago'] ) );
				echo '<li><span><b>' . esc_html( $r['name'] ) . '</b><br><small>' . $where . '</small></span><small style="text-align:right">' . ( $icons ? esc_html( 'today ' . $icons ) : 'no camp today' ) . '<br>week: ' . (int) $r['days'] . ' road days · ' . (int) $r['camps'] . ' camps</small></li>';
			}
			echo $here ? '' : '<li><small>Nobody here.</small></li>';
			echo '</ul></section>';
		}
		echo '</div></div>';
	}
}
