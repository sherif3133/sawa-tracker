<?php
/**
 * The Silk Road world: six towns from Chang'an to Constantinople, one per English level (A1–C2).
 *
 * Solo play: monster fights (English questions, mostly on the student's weakest open skill points), a story
 * quest chain in every town (monsters → a learning task → the town's boss, a short check at the town's level),
 * and daily + weekly quests that mix learning with fighting. The next town opens when the boss falls — or
 * straight away up to the level the level test gave. Fights use stamina: 5 a day plus one for every step of
 * today's plan, so playing never replaces studying.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_World {

	/** [name, icon, CEFR, monsters [[name, icon] × 3], boss [name, icon]] */
	const TOWNS = array(
		1 => array( 'Chang\'an', '🏯', 'A1', array( array( 'Paper Tiger', '🐯' ), array( 'Lantern Ghost', '🏮' ), array( 'Rice Rat', '🐀' ) ), array( 'Jade Dragon', '🐉' ) ),
		2 => array( 'Dunhuang', '🏜️', 'A2', array( array( 'Sand Scorpion', '🦂' ), array( 'Dune Bandit', '🥷' ), array( 'Cave Bat', '🦇' ) ), array( 'Desert Wyrm', '🐍' ) ),
		3 => array( 'Kashgar', '🕌', 'B1', array( array( 'Mountain Wolf', '🐺' ), array( 'Stone Golem', '🗿' ), array( 'Bazaar Trickster', '🎭' ) ), array( 'Snow Leopard King', '🐆' ) ),
		4 => array( 'Samarkand', '🏛️', 'B2', array( array( 'Night Assassin', '🗡️' ), array( 'Fire Djinn', '🔥' ), array( 'Iron Boar', '🐗' ) ), array( 'Shadow Khan', '👤' ) ),
		5 => array( 'Baghdad', '🌙', 'C1', array( array( 'Roc Chick', '🦅' ), array( 'Brass Automaton', '⚙️' ), array( 'Riddling Sphinx', '🦁' ) ), array( 'Grand Vizier', '🧙' ) ),
		6 => array( 'Constantinople', '🏰', 'C2', array( array( 'Varangian Guard', '🛡️' ), array( 'Fire Drake', '🐲' ), array( 'Hippodrome Champion', '🏇' ) ), array( 'Iron Emperor', '👑' ) ),
	);
	/** The middle step of every town's story is a learning task: [kind, n, text]. */
	const STORY_TASK = array(
		1 => array( 'card', 20, 'Review 20 word cards' ),
		2 => array( 'practice', 3, 'Finish 3 skill-tree practice sets' ),
		3 => array( 'use', 10, 'Write or speak English 10 times (chat, Write or Speak)' ),
		4 => array( 'perfect', 2, 'Have 2 perfect days' ),
		5 => array( 'mastered', 2, 'Master 2 skill points' ),
		6 => array( 'use', 15, 'Write or speak English 15 times' ),
	);
	/** Daily quests: one learning, one battle, one more — picked per student per day. [kind, n, text] */
	const DAILY_LEARN  = array(
		'card'     => array( 'card', 20, 'Review 20 word cards' ),
		'practice' => array( 'practice', 1, 'Finish a skill-tree practice set' ),
		'use'      => array( 'use', 3, 'Write or speak English 3 times' ),
		'plan'     => array( 'plan', 3, 'Finish 3 steps of today\'s plan' ),
	);
	const DAILY_FIGHT  = array(
		'monster' => array( 'monster', 3, 'Defeat 3 monsters' ),
		'right'   => array( 'right', 10, 'Answer 10 battle questions correctly' ),
		'pboss'   => array( 'pboss', 1, 'Hit your party boss' ),
		'raid'    => array( 'raid', 1, 'Win a raid' ),
		'hunt'    => array( 'hunt', 1, 'Catch a thief' ),
	);
	const WEEKLY       = array(
		'monster'  => array( 'monster', 15, 'Defeat 15 monsters' ),
		'perfect'  => array( 'perfect', 3, 'Have 3 perfect days' ),
		'mastered' => array( 'mastered', 1, 'Master a skill point' ),
	);
	/** Where the app takes the student to do a quest step. */
	const GO           = array( 'monster' => 'map', 'boss' => 'map', 'card' => 'review', 'practice' => 'skills', 'use' => 'chat', 'perfect' => 'today', 'mastered' => 'skills' );
	const STAMINA      = 5;
	const BOSS_TRIES   = 3;
	const DAILY_COINS  = 15;
	const WEEKLY_COINS = 50;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'sawa_lens_activity', function ( $uid, $kind, $times ) { self::progress( $uid, $kind, max( 1, (int) $times ) ); }, 10, 3 );
		add_action( 'sawa_lens_plan_step', function ( $uid, $k ) { self::progress( $uid, 'perfect' === $k ? 'perfect' : 'plan' ); }, 10, 2 );
		add_action( 'sawa_lens_mastered', function ( $uid ) { self::progress( $uid, 'mastered' ); } );
	}

	public static function routes() {
		foreach ( array( array( '/world', 'GET', 'state_rest' ), array( '/world/travel', 'POST', 'travel' ), array( '/world/fight', 'POST', 'fight' ), array( '/world/answer', 'POST', 'answer' ), array( '/world/claim', 'POST', 'claim' ), array( '/world/step', 'POST', 'step' ) ) as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => $r[1], 'callback' => array( __CLASS__, $r[2] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	/* ------------------------------------------------------------------ state */

	public static function get( $uid ) {
		$w    = Sawa_Tracker_Game::m( $uid, 'world', array() );
		$w    = ( is_array( $w ) ? $w : array() ) + array( 'started' => false, 'reached' => 1, 'at' => 1, 'story' => array(), 'beaten' => array(), 'titles' => array(), 'd' => array(), 'wk' => array(), 'f' => array() );
		$day  = Sawa_Tracker_Game::today();
		$week = Sawa_Tracker_Game::week_start();
		if ( ( $w['d']['day'] ?? '' ) !== $day ) {
			$w['d'] = array( 'day' => $day, 'c' => array(), 'claimed' => array() );
		}
		if ( ( $w['wk']['week'] ?? '' ) !== $week ) {
			$w['wk'] = array( 'week' => $week, 'c' => array(), 'claimed' => array() );
		}
		if ( ( $w['f']['day'] ?? '' ) !== $day ) {
			$w['f'] = array( 'day' => $day, 'used' => 0, 'boss' => 0 );
		}
		$level        = Sawa_Tracker_RPG::english( $uid )['level'];
		$w['reached'] = (int) min( 6, max( (int) $w['reached'], $level, $w['beaten'] ? max( $w['beaten'] ) + 1 : 1 ) );
		$w['at']      = (int) min( $w['reached'], max( 1, (int) $w['at'] ) );
		return $w;
	}

	public static function save( $uid, $w ) {
		Sawa_Tracker_Game::set( $uid, 'world', $w );
	}

	public static function at( $uid ) {
		return self::get( $uid )['at'];
	}

	public static function reached( $uid ) {
		return self::get( $uid )['reached'];
	}

	public static function started( $uid ) {
		return ! empty( self::get( $uid )['started'] );
	}

	/** The three steps of a town's story. */
	public static function story_steps( $t ) {
		$town = self::TOWNS[ $t ];
		return array(
			array( 'monster', 3 + $t, 'Defeat ' . ( 3 + $t ) . ' monsters around ' . $town[0] ),
			self::STORY_TASK[ $t ],
			array( 'boss', 1, 'Defeat the ' . $town[4][0] . ' — a short ' . $town[2] . ' English check' ),
		);
	}

	private static function story( $w, $t ) {
		return ( $w['story'][ $t ] ?? array() ) + array( 'step' => in_array( $t, $w['beaten'], true ) ? 3 : 0, 'count' => 0 );
	}

	/** Counts something the student did for the story, daily and weekly quests. */
	public static function progress( $uid, $kind, $n = 1 ) {
		if ( ! $uid || $n <= 0 || ! Sawa_Tracker_Game::is_member( $uid ) ) {
			return;
		}
		$w                     = self::get( $uid );
		$w['d']['c'][ $kind ]  = (int) ( $w['d']['c'][ $kind ] ?? 0 ) + $n;
		$w['wk']['c'][ $kind ] = (int) ( $w['wk']['c'][ $kind ] ?? 0 ) + $n;
		$t                     = $w['at'];
		$st                    = self::story( $w, $t );
		if ( $st['step'] < 2 && self::story_steps( $t )[ $st['step'] ][0] === $kind ) {
			$st['count']       = (int) $st['count'] + $n;
			$w['story'][ $t ]  = $st;
		}
		self::save( $uid, $w );
	}

	/** Fights left today: 5 + one for every step of today's plan (+1 for a perfect day). */
	public static function stamina( $uid, $w = null ) {
		$w     = $w ? $w : self::get( $uid );
		$plan  = get_user_meta( $uid, 'sawa_lens_plan', true );
		$today = is_array( $plan ) && ( $plan['day'] ?? '' ) === Sawa_Tracker_Game::today();
		$max   = self::STAMINA + ( $today ? count( (array) ( $plan['items'] ?? array() ) ) + ( empty( $plan['bonus'] ) ? 0 : 1 ) : 0 );
		return array( 'left' => max( 0, $max - (int) $w['f']['used'] ), 'max' => $max );
	}

	/** Today's three quests for this student. */
	public static function daily( $uid ) {
		$job   = Sawa_Tracker_RPG::job( $uid );
		$fight = array( 'monster', 'right' );
		if ( Sawa_Tracker_Party::of( $uid ) ) {
			$fight[] = 'pboss';
		}
		if ( 'thief' === $job || 'hunter' === $job ) {
			$fight[] = 'thief' === $job ? 'raid' : 'hunt';
		}
		$learn = array_keys( self::DAILY_LEARN );
		$h     = crc32( $uid . '|' . Sawa_Tracker_Game::today() );
		$a     = $learn[ $h % count( $learn ) ];
		$b     = $fight[ ( $h >> 8 ) % count( $fight ) ];
		$rest  = array_values( array_diff( array_merge( $learn, $fight ), array( $a, $b ) ) );
		$c     = $rest[ ( $h >> 16 ) % count( $rest ) ];
		$out   = array();
		foreach ( array( $a, $b, $c ) as $k ) {
			$out[ $k ] = self::DAILY_LEARN[ $k ] ?? self::DAILY_FIGHT[ $k ];
		}
		return $out;
	}

	private static function quest_out( $key, $q, $count, $claimed, $reward ) {
		return array( 'key' => $key, 'text' => $q[2], 'n' => (int) $q[1], 'count' => (int) min( $q[1], $count ), 'done' => $count >= $q[1], 'claimed' => $claimed, 'reward' => $reward );
	}

	public static function state( $uid ) {
		$w = self::get( $uid );
		if ( empty( $w['started'] ) ) {
			$w['started'] = true;
			$w['at']      = $w['reached']; // start in the town of your level
			self::save( $uid, $w );
			Sawa_Tracker_Game::set( $uid, 'town', $w['at'] );
		}
		$towns = array();
		$count = self::travelers();
		foreach ( self::TOWNS as $t => $x ) {
			$towns[] = array( 'id' => $t, 'name' => $x[0], 'icon' => $x[1], 'level' => $x[2], 'open' => $t <= $w['reached'], 'beaten' => in_array( $t, $w['beaten'], true ), 'travelers' => (int) ( $count[ $t ] ?? 0 ) );
		}
		$t     = $w['at'];
		$town  = self::TOWNS[ $t ];
		$st    = self::story( $w, $t );
		$steps = array();
		foreach ( self::story_steps( $t ) as $i => $s ) {
			$steps[] = array( 'go' => self::GO[ $s[0] ] ?? '', 'text' => $s[2], 'n' => $s[1], 'count' => $i < $st['step'] ? $s[1] : ( $i === $st['step'] ? (int) min( $s[1], $st['count'] ) : 0 ), 'state' => $i < $st['step'] ? 'done' : ( $i === $st['step'] ? ( $st['count'] >= $s[1] && $i < 2 ? 'claim' : 'now' ) : 'later' ), 'reward' => self::story_reward( $t, $i ) );
		}
		$daily = array();
		foreach ( self::daily( $uid ) as $k => $q ) {
			$daily[] = self::quest_out( 'd:' . $k, $q, (int) ( $w['d']['c'][ $q[0] ] ?? 0 ), in_array( $k, $w['d']['claimed'], true ), self::DAILY_COINS . ' 🪙' );
		}
		$weekly = array();
		foreach ( self::WEEKLY as $k => $q ) {
			$weekly[] = self::quest_out( 'w:' . $k, $q, (int) ( $w['wk']['c'][ $q[0] ] ?? 0 ), in_array( $k, $w['wk']['claimed'], true ), self::WEEKLY_COINS . ' 🪙 + 1 ⚗' );
		}
		$rpg = Sawa_Tracker_RPG::get( $uid );
		return array(
			'towns'    => $towns,
			'at'       => $t,
			'reached'  => $w['reached'],
			'town'     => array(
				'id'       => $t,
				'name'     => $town[0],
				'icon'     => $town[1],
				'level'    => $town[2],
				'monsters' => array_map( function ( $m ) use ( $t ) { return array( 'name' => $m[0], 'icon' => $m[1], 'hp' => self::monster_hp( $t ) ); }, $town[3] ),
				'boss'     => array( 'name' => $town[4][0], 'icon' => $town[4][1], 'hp' => self::boss_hp( $t ), 'ready' => 2 === $st['step'], 'beaten' => in_array( $t, $w['beaten'], true ), 'tries' => max( 0, self::BOSS_TRIES - (int) $w['f']['boss'] ) ),
				'people'   => self::people_at( $t, $uid ),
				'room'     => self::town_room( $t ),
			),
			'story'    => $steps,
			'daily'    => $daily,
			'dailyAll' => count( $w['d']['claimed'] ) >= 3,
			'weekly'   => $weekly,
			'stamina'  => self::stamina( $uid, $w ),
			'coins'    => Sawa_Tracker_Raids::coins( $uid ),
			'elixirs'  => (int) $rpg['elixirs'],
			'weapon'   => (int) round( 100 * Sawa_Tracker_RPG::slot_bonus( $rpg, 'weapon' ) ),
			'job'      => $rpg['job'],
			'titles'   => array_values( (array) $w['titles'] ),
			'avatar'   => Sawa_Tracker_Play::avatar( $uid ),
			'pos'      => self::last_pos( $uid, $t ),
			'words'    => (int) apply_filters( 'sawa_tracker_word_count', 0, $uid ),
			'party'    => Sawa_Tracker_Party::of( $uid ),
			'ready'    => (bool) apply_filters( 'sawa_tracker_battle_ready', false ),
		);
	}

	/** Where the student last stood in this town (the game puts them back there). */
	public static function last_pos( $uid, $t ) {
		$p = Sawa_Tracker_Game::m( $uid, 'wpos', array() );
		return is_array( $p ) && (int) ( $p['t'] ?? 0 ) === (int) $t && $p['x'] > 0 ? array( 'x' => (int) $p['x'], 'y' => (int) $p['y'], 'd' => (int) $p['d'] ) : null;
	}

	public static function monster_hp( $t ) {
		return (int) round( 60 * ( 1 + 0.05 * ( $t - 1 ) ) );
	}

	public static function boss_hp( $t ) {
		return (int) round( 90 * ( 1 + 0.04 * ( $t - 1 ) ) );
	}

	private static function story_reward( $t, $i ) {
		return array( 10 * $t . ' 🪙', 15 * $t . ' 🪙 + 1 ⚗', 30 * $t . ' 🪙 + 2 ⚗ + a title' )[ $i ];
	}

	/** How many students are in each town. */
	public static function travelers() {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT meta_value t, COUNT(*) n FROM {$wpdb->usermeta} WHERE meta_key = %s GROUP BY meta_value", 'sawa_town' ), ARRAY_A ); // phpcs:ignore
		return wp_list_pluck( (array) $rows, 'n', 't' );
	}

	private static function people_at( $t, $uid ) {
		global $wpdb;
		$ids = $wpdb->get_col( $wpdb->prepare( "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value = %s AND user_id <> %d ORDER BY umeta_id DESC LIMIT 12", 'sawa_town', (string) $t, $uid ) ); // phpcs:ignore
		$out = array();
		foreach ( $ids as $id ) {
			if ( Sawa_Tracker_Game::is_member( (int) $id ) ) {
				$out[] = Sawa_Tracker_Game::person( (int) $id ) + array( 'job' => Sawa_Tracker_RPG::job( (int) $id ) );
			}
		}
		return array_slice( $out, 0, 8 );
	}

	/** Every town has its own chat room for the students who reached it. */
	public static function town_room( $t ) {
		global $wpdb;
		$rooms = Sawa_Tracker_Social::t( 'rooms' );
		$id    = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $rooms WHERE type = 'town' AND clan_id = %d", $t ) ); // phpcs:ignore
		if ( ! $id && isset( self::TOWNS[ $t ] ) ) {
			$wpdb->insert( $rooms, array( 'type' => 'town', 'clan_id' => $t, 'name' => self::TOWNS[ $t ][1] . ' ' . self::TOWNS[ $t ][0], 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
			$id = (int) $wpdb->insert_id;
		}
		return $id;
	}

	/* ------------------------------------------------------------------ battles (shared with the party boss) */

	/** Saves a battle for 15 minutes and returns what the student sees (no answers). */
	public static function battle_start( $uid, $kind, $qs, $foe, $meta = array() ) {
		$id = wp_generate_password( 20, false );
		set_transient( 'sawa_tr_wb_' . $id, array( 'uid' => $uid, 'kind' => $kind, 'qs' => $qs, 'foe' => $foe, 'meta' => $meta, 't' => time() ), 15 * MINUTE_IN_SECONDS );
		return array(
			'battle'    => $id,
			'kind'      => $kind,
			'foe'       => $foe,
			'questions' => array_map( function ( $q ) { return array( 'q' => $q['q'], 'options' => $q['options'], 'point' => $q['point'] ?? '', 'src' => $q['src'] ?? '' ); }, $qs ),
			'seconds'   => 20 + ( Sawa_Tracker_RPG::skill_on( $uid, 'eagle_eye' ) ? 5 : 0 ),
		);
	}

	private static function uid() {
		return get_current_user_id();
	}

	public static function state_rest() {
		return self::state( self::uid() );
	}

	public static function travel( WP_REST_Request $r ) {
		$uid = self::uid();
		$t   = (int) $r->get_param( 'town' );
		$w   = self::get( $uid );
		if ( ! isset( self::TOWNS[ $t ] ) || $t > $w['reached'] ) {
			return new WP_Error( 'town', 'Defeat the boss of the town before it to travel there — or take the level test.', array( 'status' => 400 ) );
		}
		$w['at'] = $t;
		self::save( $uid, $w );
		Sawa_Tracker_Game::set( $uid, 'town', $t );
		return self::state( $uid );
	}

	public static function fight( WP_REST_Request $r ) {
		$uid  = self::uid();
		$kind = 'boss' === $r->get_param( 'kind' ) ? 'boss' : 'monster';
		$w    = self::get( $uid );
		$t    = $w['at'];
		$town = self::TOWNS[ $t ];
		if ( 'boss' === $kind ) {
			$st = self::story( $w, $t );
			if ( 2 !== $st['step'] ) {
				return new WP_Error( 'boss', in_array( $t, $w['beaten'], true ) ? 'You already defeated this boss. Travel on!' : 'Finish the first two steps of this town\'s story first.', array( 'status' => 400 ) );
			}
			if ( (int) $w['f']['boss'] >= self::BOSS_TRIES ) {
				return new WP_Error( 'boss', 'No boss tries left today. Train on monsters and come back tomorrow!', array( 'status' => 400 ) );
			}
			$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 6, array( 'level' => $t ) );
			$foe = array( 'name' => $town[4][0], 'icon' => $town[4][1], 'hp' => self::boss_hp( $t ), 'boss' => true );
			$w['f']['boss'] = (int) $w['f']['boss'] + 1;
		} else {
			if ( self::stamina( $uid, $w )['left'] < 1 ) {
				return new WP_Error( 'stamina', 'No stamina left. Every step of today\'s plan gives you one more fight!', array( 'status' => 400 ) );
			}
			$m   = $town[3][ min( 2, max( 0, (int) $r->get_param( 'm' ) ) ) ];
			$qs  = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 5, array( 'level' => $t, 'weak' => true, 'own' => true ) );
			$foe = array( 'name' => $m[0], 'icon' => $m[1], 'hp' => self::monster_hp( $t ) );
			$w['f']['used'] = (int) $w['f']['used'] + 1;
		}
		if ( count( $qs ) < ( 'boss' === $kind ? 6 : 5 ) ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		self::save( $uid, $w );
		return self::battle_start( $uid, $kind, $qs, $foe, array( 'town' => $t ) );
	}

	/**
	 * One answer at a time (the walkable game animates every hit): saves the pick for question i, in order,
	 * and says whether it was right. The final /world/answer then uses the saved picks.
	 */
	public static function step( WP_REST_Request $r ) {
		$uid = self::uid();
		$key = 'sawa_tr_wb_' . sanitize_key( (string) $r->get_param( 'battle' ) );
		$b   = get_transient( $key );
		if ( ! is_array( $b ) || (int) $b['uid'] !== $uid ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		$i    = (int) $r->get_param( 'i' );
		$picks = (array) ( $b['picks'] ?? array() );
		if ( $i !== count( $picks ) || ! isset( $b['qs'][ $i ] ) ) {
			return new WP_Error( 'battle', 'Answer the questions in order.', array( 'status' => 400 ) );
		}
		$q          = $b['qs'][ $i ];
		$picks[]    = (int) $r->get_param( 'choice' );
		$b['picks'] = $picks;
		set_transient( $key, $b, 15 * MINUTE_IN_SECONDS );
		return array( 'correct' => (int) $q['answer'] === end( $picks ), 'right' => $q['options'][ $q['answer'] ] ?? '', 'why' => $q['why'] ?? '', 'per' => (int) round( 20 * ( 1 + Sawa_Tracker_RPG::slot_bonus( Sawa_Tracker_RPG::get( $uid ), 'weapon' ) ) ) );
	}

	public static function answer( WP_REST_Request $r ) {
		$uid = self::uid();
		$key = 'sawa_tr_wb_' . sanitize_key( (string) $r->get_param( 'battle' ) );
		$b   = get_transient( $key );
		if ( ! is_array( $b ) || (int) $b['uid'] !== $uid ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		delete_transient( $key );
		$ans = isset( $b['picks'] ) ? array_values( $b['picks'] ) : array_values( (array) $r->get_param( 'answers' ) );
		$fb  = array();
		foreach ( $b['qs'] as $i => $q ) {
			$ok   = isset( $ans[ $i ] ) && (int) $ans[ $i ] === (int) $q['answer'];
			$fb[] = array( 'ok' => $ok, 'q' => $q['q'], 'right' => $q['options'][ $q['answer'] ] ?? '', 'point' => $q['point'] ?? '', 'why' => $q['why'] ?? '' );
			if ( ! $ok && ! empty( $q['card'] ) && (int) ( $q['user'] ?? 0 ) === $uid ) {
				do_action( 'sawa_tracker_missed_card', $uid, $q['card'] ); // the word comes back in today's review
				$missed = ( $missed ?? 0 ) + 1;
			}
		}
		$oks    = array_column( $fb, 'ok' );
		$right  = count( array_filter( $oks ) );
		$attack = Sawa_Tracker_RPG::attack( $uid, $oks );
		$foe    = $b['foe'];
		$out    = array( 'kind' => $b['kind'], 'right' => $right, 'total' => count( $fb ), 'attack' => $attack, 'foe' => $foe, 'review' => $fb, 'coins' => 0, 'elixirs' => 0, 'won' => false, 'missedWords' => $missed ?? 0 );
		self::progress( $uid, 'right', $right );
		Sawa_Tracker_Play::record_accuracy( $uid, $right, count( $fb ) );
		if ( 'duel' === $b['kind'] ) {
			$out = Sawa_Tracker_Play::after_duel( $uid, $b, $attack, $right ) + $out;
		} elseif ( 'pboss' === $b['kind'] ) {
			$out = Sawa_Tracker_Party::after_hit( $uid, $b, $attack, $right ) + $out;
		} else {
			$t          = (int) $b['meta']['town'];
			$out['won'] = $attack >= (int) $foe['hp'];
			if ( 'boss' === $b['kind'] && $out['won'] ) {
				$w = self::get( $uid );
				if ( ! in_array( $t, $w['beaten'], true ) ) {
					$w['beaten'][]    = $t;
					$w['story'][ $t ] = array( 'step' => 3, 'count' => 0 );
					$w['titles'][]    = 'Hero of ' . self::TOWNS[ $t ][0];
					self::save( $uid, $w );
					$out['coins']   = Sawa_Tracker_Raids::add_coins( $uid, 30 * $t );
					$out['elixirs'] = 2;
					Sawa_Tracker_RPG::add_elixirs( $uid, 2 );
					$out['title']   = 'Hero of ' . self::TOWNS[ $t ][0];
					$out['next']    = self::TOWNS[ $t + 1 ][0] ?? '';
					Sawa_Tracker_Game::event( $uid, 'town', null, array( 'boss' => $foe['name'], 'town' => self::TOWNS[ $t ][0], 'next' => $out['next'] ) );
				}
			} elseif ( 'monster' === $b['kind'] ) {
				if ( $out['won'] ) {
					$out['coins'] = Sawa_Tracker_Raids::add_coins( $uid, 3 + $t );
					if ( 1 === wp_rand( 1, 8 ) ) {
						$out['elixirs'] = 1;
						Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
					}
					self::progress( $uid, 'monster' );
				} else {
					$out['coins'] = Sawa_Tracker_Raids::add_coins( $uid, 1 );
				}
			}
		}
		$out['world'] = self::state( $uid );
		return $out;
	}

	public static function claim( WP_REST_Request $r ) {
		$uid = self::uid();
		$q   = (string) $r->get_param( 'quest' );
		$w   = self::get( $uid );
		$got = array( 'coins' => 0, 'elixirs' => 0 );
		if ( 'story' === $q ) {
			$t  = $w['at'];
			$st = self::story( $w, $t );
			$s  = self::story_steps( $t )[ min( 2, $st['step'] ) ];
			if ( $st['step'] > 1 || $st['count'] < $s[1] ) {
				return new WP_Error( 'quest', 'Not finished yet.', array( 'status' => 400 ) );
			}
			$got['coins']     = ( 0 === $st['step'] ? 10 : 15 ) * $t;
			$got['elixirs']   = 0 === $st['step'] ? 0 : 1;
			$w['story'][ $t ] = array( 'step' => $st['step'] + 1, 'count' => 0 );
		} elseif ( preg_match( '/^([dw]):(\w+)$/', $q, $m ) ) {
			$list = 'd' === $m[1] ? self::daily( $uid ) : self::WEEKLY;
			$box  = 'd' === $m[1] ? 'd' : 'wk';
			$def  = $list[ $m[2] ] ?? null;
			if ( ! $def || in_array( $m[2], $w[ $box ]['claimed'], true ) || (int) ( $w[ $box ]['c'][ $def[0] ] ?? 0 ) < $def[1] ) {
				return new WP_Error( 'quest', 'Not finished yet.', array( 'status' => 400 ) );
			}
			$w[ $box ]['claimed'][] = $m[2];
			$got['coins']           = 'd' === $m[1] ? self::DAILY_COINS : self::WEEKLY_COINS;
			$got['elixirs']         = 'wk' === $box || 3 === count( $w['d']['claimed'] ) && 'd' === $box ? 1 : 0; // weekly quests, and all three dailies
		} else {
			return new WP_Error( 'quest', 'Unknown quest.', array( 'status' => 400 ) );
		}
		self::save( $uid, $w );
		$got['coins'] = Sawa_Tracker_Raids::add_coins( $uid, $got['coins'] );
		if ( $got['elixirs'] ) {
			Sawa_Tracker_RPG::add_elixirs( $uid, $got['elixirs'] );
		}
		return array( 'got' => $got, 'world' => self::state( $uid ) );
	}
}
