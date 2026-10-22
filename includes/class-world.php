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

require_once __DIR__ . '/class-combat.php'; // monster and traveller fighting styles
require_once __DIR__ . '/class-wounds.php'; // heroes who don't study get hurt, and the clan feels it

final class Sawa_Tracker_World {

	/** [name, icon, CEFR, monsters [[name, icon] × 3], boss [name, icon]] */
	const TOWNS = array(
		1 => array( 'Chang\'an', '🏯', 'A2−', array( array( 'Paper Tiger', '🐯' ), array( 'Lantern Ghost', '🏮' ), array( 'Rice Rat', '🐀' ) ), array( 'Jade Dragon', '🐉' ) ),
		2 => array( 'Dunhuang', '🏜️', 'A2', array( array( 'Sand Scorpion', '🦂' ), array( 'Dune Bandit', '🥷' ), array( 'Cave Bat', '🦇' ) ), array( 'Desert Wyrm', '🐍' ) ),
		3 => array( 'Kashgar', '🕌', 'A2+', array( array( 'Mountain Wolf', '🐺' ), array( 'Stone Golem', '🗿' ), array( 'Bazaar Trickster', '🎭' ) ), array( 'Snow Leopard King', '🐆' ) ),
		4 => array( 'Samarkand', '🏛️', 'B1−', array( array( 'Night Assassin', '🗡️' ), array( 'Fire Djinn', '🔥' ), array( 'Iron Boar', '🐗' ) ), array( 'Shadow Khan', '👤' ) ),
		5 => array( 'Baghdad', '🌙', 'B1', array( array( 'Roc Chick', '🦅' ), array( 'Brass Automaton', '⚙️' ), array( 'Riddling Sphinx', '🦁' ) ), array( 'Grand Vizier', '🧙' ) ),
		6 => array( 'Constantinople', '🏰', 'B1+', array( array( 'Varangian Guard', '🛡️' ), array( 'Fire Drake', '🐲' ), array( 'Hippodrome Champion', '🏇' ) ), array( 'Iron Emperor', '👑' ) ),
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
		'answer'   => array( 'answer', 1, 'Answer a call for help on the caravan board' ),
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
		'share'    => array( 'share', 1, 'Share your Silk Road card in the Skool community' ),
		'helped'   => array( 'helped', 2, 'Help 2 travellers win a battle' ),
		'reply'    => array( 'reply', 25, 'Reply to 25 messages from other travellers in the chat' ),
	);
	/** Where the app takes the student to do a quest step. */
	const GO           = array( 'answer' => 'caravan', 'helped' => 'caravan', 'monster' => 'map', 'boss' => 'map', 'card' => 'review', 'practice' => 'skills', 'use' => 'chat', 'reply' => 'chat', 'perfect' => 'today', 'mastered' => 'skills' );
	/** The community is A2–B1: the six towns are small steps from early A2 to late B1 (question difficulty). */
	const LEVELS       = array( 1 => 1.7, 2 => 2.0, 3 => 2.35, 4 => 2.7, 5 => 3.0, 6 => 3.35 );
	const STAMINA      = 5;
	const BOSS_TRIES   = 3;
	const DAILY_COINS  = 15;
	const WEEKLY_COINS = 50;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		Sawa_Tracker_Wounds::init();
		add_action( 'sawa_lens_activity', function ( $uid, $kind, $times ) { self::progress( $uid, $kind, max( 1, (int) $times ) ); }, 10, 3 );
		add_action( 'sawa_lens_plan_step', function ( $uid, $k ) { self::progress( $uid, 'perfect' === $k ? 'perfect' : 'plan' ); }, 10, 2 );
		add_action( 'sawa_lens_mastered', function ( $uid ) { self::progress( $uid, 'mastered' ); } );
	}

	public static function routes() {
		foreach ( array( array( '/world', 'GET', 'state_rest' ), array( '/world/travel', 'POST', 'travel' ), array( '/world/fight', 'POST', 'fight' ), array( '/world/answer', 'POST', 'answer' ), array( '/world/claim', 'POST', 'claim' ), array( '/world/step', 'POST', 'step' ), array( '/world/skill', 'POST', 'skill' ), array( '/world/flee', 'POST', 'flee' ), array( '/world/tea', 'POST', 'tea' ), array( '/world/story', 'POST', 'story_gift' ), array( '/world/rematch', 'POST', 'rematch' ), array( '/world/ranks', 'GET', 'ranks' ), array( '/world/report', 'GET', 'report' ), array( '/world/shared', 'POST', 'shared' ) ) as $r ) {
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
		$level        = $level >= 4 ? 6 : ( 3 === $level ? 4 : ( 2 === $level ? 2 : 1 ) ); // level test → first town open
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
		Sawa_Tracker_Hero::studied( $uid, $kind, $n ); // mana and healing from studying
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
		do_action( 'sawa_tracker_progress', $uid, $kind, $n ); // the caravan's materials and guide pairs
	}

	/** Fights left today: 5 + one for every step of today's plan (+1 for a perfect day). */
	public static function stamina( $uid, $w = null ) {
		$w     = $w ? $w : self::get( $uid );
		$plan  = get_user_meta( $uid, 'sawa_lens_plan', true );
		$today = is_array( $plan ) && ( $plan['day'] ?? '' ) === Sawa_Tracker_Game::today();
		$max   = self::STAMINA + ( $today ? count( (array) ( $plan['items'] ?? array() ) ) + ( empty( $plan['bonus'] ) ? 0 : 1 ) : 0 );
		$down = Sawa_Tracker_Wounds::penalty( $uid ); // hurt clanmates slow everyone down
		return array( 'left' => max( 0, $max - $down - (int) $w['f']['used'] ), 'max' => $max - $down, 'clanDown' => $down );
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
				'boss'     => array( 'name' => $town[4][0], 'icon' => $town[4][1], 'hp' => self::boss_hp( $t ), 'ready' => 2 === $st['step'], 'beaten' => in_array( $t, $w['beaten'], true ), 'tries' => max( 0, self::BOSS_TRIES - (int) $w['f']['boss'] ), 'questions' => self::QUESTIONS['boss'], 'rematch' => in_array( $t, $w['beaten'], true ) && ( $w['elite'][ $t ] ?? '' ) !== Sawa_Tracker_Game::week_start() ),
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
			'replyGoal' => Sawa_Tracker_Replies::goal( $uid ),
			'titles'   => array_values( (array) $w['titles'] ),
			'avatar'   => Sawa_Tracker_Play::avatar( $uid ),
			'hero'     => Sawa_Tracker_Hero::sheet( $uid ),
			'pos'      => self::last_pos( $uid, $t ),
			'wound'    => Sawa_Tracker_Wounds::of( $uid ),
			'clanHurt' => Sawa_Tracker_Wounds::clan( $uid ),
			'words'    => (int) apply_filters( 'sawa_tracker_word_count', 0, $uid ),
			'party'    => Sawa_Tracker_Party::of( $uid ),
			'event'    => 2 === self::xp_mult() ? 'Double XP weekend: fights give twice the XP!' : '',
			'ready'    => (bool) apply_filters( 'sawa_tracker_battle_ready', false ),
			'road'     => Sawa_Tracker_Road::state( $uid ), // today's learning road (camps on the way to the boss)
		);
	}

	/** Where the student last stood in this town (the game puts them back there). */
	public static function last_pos( $uid, $t ) {
		$p = Sawa_Tracker_Game::m( $uid, 'wpos', array() );
		return is_array( $p ) && (int) ( $p['t'] ?? 0 ) === (int) $t && $p['x'] > 0 ? array( 'x' => (int) $p['x'], 'y' => (int) $p['y'], 'd' => (int) $p['d'] ) : null;
	}

	public static function monster_hp( $t ) {
		return (int) round( 70 * ( 1 + 0.12 * ( $t - 1 ) ) );
	}

	public static function boss_hp( $t ) {
		return (int) round( 150 * ( 1 + 0.12 * ( $t - 1 ) ) );
	}

	/** Weekend event: double XP from fights on Fridays and Saturdays. */
	public static function xp_mult() {
		return in_array( (int) wp_date( 'w' ), array( 5, 6 ), true ) ? 2 : 1;
	}

	public static function report() {
		return Sawa_Tracker_Hero::report();
	}

	public static function ranks() {
		return Sawa_Tracker_Hero::ranks( get_current_user_id() );
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

	/** The game's chat is the one community chat (one room for everyone, fewer places to look). */
	public static function town_room( $t ) {
		global $wpdb;
		$public = Sawa_Tracker_Social::public_room();
		if ( $public ) {
			return $public;
		}
		$rooms = Sawa_Tracker_Social::t( 'rooms' );
		$id    = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $rooms WHERE type = 'town' AND clan_id = %d", $t ) ); // phpcs:ignore
		if ( ! $id && isset( self::TOWNS[ $t ] ) ) {
			$wpdb->insert( $rooms, array( 'type' => 'town', 'clan_id' => $t, 'name' => self::TOWNS[ $t ][1] . ' ' . self::TOWNS[ $t ][0], 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
			$id = (int) $wpdb->insert_id;
		}
		return $id;
	}

	/* ------------------------------------------------------------------ battles (monsters, bosses, the party boss, shadow duels)
	 * Both sides have health. A right answer hits the foe (faster answers and answer streaks hit harder); a wrong
	 * answer or running out of time lets the foe hit you. The battle ends when one side falls or the questions run
	 * out. Mana skills help: remove a wrong answer, a hint, a double hit, healing. Question types change:
	 * choose, listen and choose, type the missing word, put the words in order. Everything is decided here. */

	/** How many questions a battle has at most. */
	const QUESTIONS = array( 'monster' => 8, 'boss' => 10, 'elite' => 10, 'pboss' => 6, 'duel' => 7, 'support' => 4 );

	/** Turns some questions into other types, so fights are not always "choose an answer". */
	private static function vary( $qs ) {
		foreach ( $qs as $k => $q ) {
			$q['type'] = 'mc';
			$r         = wp_rand( 1, 100 );
			if ( ! empty( $q['card'] ) && 0 === strpos( $q['card'], 'w:' ) && isset( $q['options'][ $q['answer'] ] ) ) {
				$form = $q['options'][ $q['answer'] ];
				if ( $r <= 30 ) { // hear the sentence, pick the word you heard
					$q['type'] = 'listen';
					$q['say']  = str_replace( '___', $form, $q['q'] );
				} elseif ( $r <= 50 && strlen( $form ) >= 3 ) { // type the missing word
					$q['type'] = 'type';
					$q['text'] = $form;
				}
			} elseif ( false !== strpos( $q['q'], '___' ) && isset( $q['options'][ $q['answer'] ] ) && preg_match( "/^[A-Za-z']{2,}$/", $q['options'][ $q['answer'] ] ) && $r <= 40 ) {
				// grammar questions with a one-word gap: sometimes heard, sometimes typed
				$form = $q['options'][ $q['answer'] ];
				if ( $r <= 20 ) {
					$q['type'] = 'listen';
					$q['say']  = str_replace( '___', $form, preg_replace( '/^\([A-C][12]-\d+\)\s*/', '', $q['q'] ) );
				} else {
					$q['type'] = 'type';
					$q['text'] = $form;
				}
			} elseif ( 'Your own mistake' === ( $q['point'] ?? '' ) && $r <= 50 ) {
				$fixed = $q['options'][ $q['answer'] ] ?? '';
				$words = preg_split( '/\s+/', trim( $fixed ) );
				if ( count( $words ) >= 3 && count( $words ) <= 10 ) { // put your own corrected sentence in order
					$q['type']   = 'order';
					$q['text']   = $fixed;
					$tokens      = $words;
					for ( $n = 0; $n < 5 && $tokens === $words; $n++ ) {
						shuffle( $tokens );
					}
					$q['tokens'] = $tokens;
					$q['q']      = 'Put your sentence in the right order.';
				}
			}
			$qs[ $k ] = $q;
		}
		return $qs;
	}

	private static function norm( $s ) {
		return trim( preg_replace( '/\s+/', ' ', strtolower( preg_replace( "/[^\\p{L}\\p{N}'\\s]/u", '', (string) $s ) ) ) );
	}

	/** Saves a battle for 20 minutes and returns what the student sees (no answers). */
	public static function battle_start( $uid, $kind, $qs, $foe, $meta = array() ) {
		$t     = self::at( $uid );
		$rpg   = Sawa_Tracker_RPG::get( $uid );
		$lv    = Sawa_Tracker_Hero::level( $uid );
		$qs    = self::vary( array_slice( array_values( $qs ), 0, self::QUESTIONS[ $kind ] ?? 8 ) );
		$foe   = $foe + array( 'atk' => 10 + 3 * $t, 'boss' => false ); // about 4–5 mistakes before a knock-out
		$foe['hpMax'] = (int) $foe['hp'];
		$foe['style'] = empty( $foe['shadow'] ) ? Sawa_Tracker_Combat::foe_style( $foe['name'] ) : null; // how it attacks
		$me    = array(
			'hp'    => Sawa_Tracker_Hero::hp( $uid ),
			'hpMax' => Sawa_Tracker_Hero::max_hp( $uid, $lv ),
			'atk'   => (int) round( 20 * ( 1 + Sawa_Tracker_RPG::slot_bonus( $rpg, 'weapon' ) ) ) + 2 * intdiv( $lv, 5 ) + ( 'warrior' === Sawa_Tracker_Game::m( $uid, 'class' ) ? 2 : 0 ),
			'armor' => min( 0.5, Sawa_Tracker_RPG::slot_bonus( $rpg, 'armor' ) + ( Sawa_Tracker_RPG::skill_on( $uid, 'iron_skin' ) ? 0.1 : 0 ) ),
		);
		$secs  = 20 + ( Sawa_Tracker_RPG::skill_on( $uid, 'eagle_eye' ) ? 5 : 0 );
		$id    = wp_generate_password( 20, false );
		$me['soft']   = 1 === $t; // gentle in the first town only
		$me['noKo']   = 1 === $t;
		$me['styles'] = Sawa_Tracker_Combat::my_styles( $uid );
		$state = array( 'picks' => array(), 'combo' => 0, 'best' => 0, 'dealt' => 0, 'taken' => 0, 'right' => 0, 'power' => false, 'used' => array(), 'sw' => false, 'phase' => 1, 'done' => false );
		if ( ! empty( $meta['support'] ) ) { // allies from a call for help
			Sawa_Tracker_Combat::apply_support( $foe, $me, $state, $meta['support'] );
		}
		set_transient( 'sawa_tr_wb_' . $id, array( 'uid' => $uid, 'kind' => $kind, 'qs' => $qs, 'foe' => $foe, 'me' => $me, 'st' => $state, 'meta' => $meta, 'secs' => $secs, 't' => time() ), 20 * MINUTE_IN_SECONDS );
		$skills = array();
		foreach ( Sawa_Tracker_Hero::SKILLS as $sid => $s ) {
			$skills[] = array( 'id' => $sid, 'name' => $s[0], 'cost' => $s[1], 'text' => $s[2] );
		}
		return array(
			'battle'    => $id,
			'kind'      => $kind,
			'foe'       => $foe,
			'me'        => $me + array( 'mana' => Sawa_Tracker_Hero::mana( $uid ), 'manaMax' => Sawa_Tracker_Hero::max_mana( $lv ), 'level' => $lv ),
			'skills'    => $skills,
			'questions' => array_map(
				function ( $q ) {
					$o = array( 'type' => $q['type'], 'q' => 'listen' === $q['type'] ? 'Listen. Which word do you hear?' : $q['q'], 'point' => $q['point'] ?? '', 'src' => $q['src'] ?? '' );
					if ( in_array( $q['type'], array( 'mc', 'listen' ), true ) ) {
						$o['options'] = $q['options'];
					}
					if ( 'listen' === $q['type'] ) {
						$o['say'] = $q['say'];
					}
					if ( 'order' === $q['type'] ) {
						$o['tokens'] = $q['tokens'];
					}
					if ( 'type' === $q['type'] ) {
						$o['len'] = strlen( $q['text'] );
					}
					return $o;
				},
				$qs
			),
			'seconds'   => $secs,
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
		if ( Sawa_Tracker_Wounds::of( $uid )['fallen'] ) {
			return new WP_Error( 'hp', 'You have fallen: 4 days without studying. Study today to get up again — or ask your clan for a revive.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Hero::hp( $uid ) < 0.15 * Sawa_Tracker_Hero::max_hp( $uid ) ) {
			return new WP_Error( 'hp', 'You are too hurt to fight. Rest at the inn (review your cards) or wait a little — health comes back by itself.', array( 'status' => 400 ) );
		}
		if ( 'boss' === $kind ) {
			$st = self::story( $w, $t );
			if ( 2 !== $st['step'] ) {
				return new WP_Error( 'boss', in_array( $t, $w['beaten'], true ) ? 'You already defeated this boss. Travel on!' : 'Finish the first two steps of this town\'s story first.', array( 'status' => 400 ) );
			}
			if ( (int) $w['f']['boss'] >= self::BOSS_TRIES ) {
				return new WP_Error( 'boss', 'No boss tries left today. Train on monsters and come back tomorrow!', array( 'status' => 400 ) );
			}
			$qs  = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, self::QUESTIONS['boss'], array( 'level' => self::LEVELS[ $t ] ) );
			$foe = array( 'name' => $town[4][0], 'icon' => $town[4][1], 'hp' => self::boss_hp( $t ), 'atk' => 14 + 4 * $t, 'boss' => true );
			$w['f']['boss'] = (int) $w['f']['boss'] + 1;
		} else {
			if ( self::stamina( $uid, $w )['left'] < 1 ) {
				return new WP_Error( 'stamina', 'No stamina left. Every step of today\'s plan gives you one more fight!', array( 'status' => 400 ) );
			}
			$m   = $town[3][ min( 2, max( 0, (int) $r->get_param( 'm' ) ) ) ];
			$qs  = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, self::QUESTIONS['monster'], array( 'level' => self::LEVELS[ $t ], 'weak' => true, 'own' => true ) );
			$foe = array( 'name' => $m[0], 'icon' => $m[1], 'hp' => self::monster_hp( $t ) );
			$w['f']['used'] = (int) $w['f']['used'] + 1;
		}
		if ( count( $qs ) < 5 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		self::save( $uid, $w );
		$support = class_exists( 'Sawa_Tracker_Coop' ) ? Sawa_Tracker_Coop::support_for( $uid, $foe['name'] ) : null; // a call for help was answered
		return self::battle_start( $uid, $kind, $qs, $foe, array( 'town' => $t, 'support' => $support ) );
	}

	private static function battle_get( $r, $uid ) {
		$key = 'sawa_tr_wb_' . sanitize_key( (string) $r->get_param( 'battle' ) );
		$b   = get_transient( $key );
		return is_array( $b ) && (int) $b['uid'] === $uid ? array( $key, $b ) : array( $key, null );
	}

	/** One answer: hits, misses, combos and speed are worked out here. */
	public static function step( WP_REST_Request $r ) {
		$uid = self::uid();
		list( $key, $b ) = self::battle_get( $r, $uid );
		if ( ! $b || $b['st']['done'] ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		$st = &$b['st'];
		$i  = (int) $r->get_param( 'i' );
		if ( $i !== count( $st['picks'] ) || ! isset( $b['qs'][ $i ] ) ) {
			return new WP_Error( 'battle', 'Answer the questions in order.', array( 'status' => 400 ) );
		}
		$q = $b['qs'][ $i ];
		if ( 'type' === $q['type'] || 'order' === $q['type'] ) {
			$given   = (string) $r->get_param( 'text' );
			$correct = '' !== trim( $given ) && self::norm( $given ) === self::norm( $q['text'] );
			$right   = $q['text'];
		} else {
			$given   = (int) $r->get_param( 'choice' );
			$correct = $given === (int) $q['answer'];
			$right   = $q['options'][ $q['answer'] ] ?? '';
		}
		$st['picks'][] = $correct ? 1 : 0;
		$ms    = (int) $r->get_param( 'ms' );
		$limit = ( $b['secs'] + ( in_array( $q['type'], array( 'type', 'order' ), true ) ? 10 : 0 ) ) * 1000;
		$quick = $correct && $ms > 300 && $ms < $limit * 0.35;
		$out   = array( 'correct' => $correct, 'right' => $right, 'why' => $q['why'] ?? '', 'dmg' => 0, 'taken' => 0, 'quick' => $quick, 'blocked' => false, 'fx' => array() );
		Sawa_Tracker_Combat::tick( $b, $out ); // poison and fire
		if ( $correct ) {
			$st['combo']++;
			$st['best'] = max( $st['best'], $st['combo'] );
			$st['right']++;
			$mult = ( $quick ? 1.25 : 1 ) * ( $st['combo'] >= 5 ? 2 : ( $st['combo'] >= 3 ? 1.5 : 1 ) ) * ( $st['power'] ? 2 : 1 );
			$dmg  = (int) round( $b['me']['atk'] * $mult ) + ( 3 === $st['combo'] && Sawa_Tracker_RPG::skill_on( $uid, 'critical' ) ? 15 : 0 );
			$dmg  = Sawa_Tracker_Combat::right( $b, $out, $dmg, $quick, $ms > $limit * 0.6, $q['type'] );
			$st['power']      = false;
			$b['foe']['hp']   = max( 0, $b['foe']['hp'] - $dmg );
			$st['dealt']     += $dmg;
			$out['dmg']       = $dmg;
		} else {
			$st['combo'] = 0;
			if ( ! $st['sw'] && Sawa_Tracker_RPG::skill_on( $uid, 'second_wind' ) ) {
				$st['sw']       = true;
				$out['blocked'] = true;
			} else {
				$hit            = (int) round( $b['foe']['atk'] * ( 2 === $st['phase'] ? 1.5 : 1 ) * ( 1 - $b['me']['armor'] ) * ( empty( $b['me']['soft'] ) ? 1 : 0.75 ) );
				$hit            = Sawa_Tracker_Combat::allies( $b, $out, Sawa_Tracker_Combat::wrong( $b, $out, $hit, $uid ) );
				$b['me']['hp']  = max( empty( $b['me']['noKo'] ) ? 0 : 1, $b['me']['hp'] - $hit );
				$st['taken']   += $hit;
				$out['taken']   = $hit;
			}
		}
		if ( $b['foe']['boss'] && 1 === $st['phase'] && $b['foe']['hp'] > 0 && $b['foe']['hp'] <= $b['foe']['hpMax'] / 2 ) {
			$st['phase']   = 2; // the boss gets angry: it hits harder
			$out['enrage'] = true;
		}
		Sawa_Tracker_Combat::ally_heal( $b, $out );
		Sawa_Tracker_Combat::next( $b, $out ); // what the monster gets ready to do next
		$st['done'] = $b['foe']['hp'] <= 0 || $b['me']['hp'] <= 0 || $i + 1 >= count( $b['qs'] );
		set_transient( $key, $b, 20 * MINUTE_IN_SECONDS );
		return $out + array( 'combo' => $st['combo'], 'foeHp' => $b['foe']['hp'], 'hp' => $b['me']['hp'], 'phase' => $st['phase'], 'done' => $st['done'] );
	}

	/**
	 * After the road: a beaten town boss comes back stronger once a week (an elite rematch): harder questions,
	 * more health, bigger rewards, and the title "Champion of <town>" the first time.
	 */
	public static function rematch() {
		$uid  = self::uid();
		$w    = self::get( $uid );
		$t    = $w['at'];
		$town = self::TOWNS[ $t ];
		if ( ! in_array( $t, $w['beaten'], true ) ) {
			return new WP_Error( 'boss', 'Beat this town\'s boss first.', array( 'status' => 400 ) );
		}
		if ( ( $w['elite'][ $t ] ?? '' ) === Sawa_Tracker_Game::week_start() ) {
			return new WP_Error( 'boss', 'The elite ' . $town[4][0] . ' is resting. It comes back next week!', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Wounds::of( $uid )['fallen'] || Sawa_Tracker_Hero::hp( $uid ) < 0.15 * Sawa_Tracker_Hero::max_hp( $uid ) ) {
			return new WP_Error( 'hp', 'You are too hurt for an elite fight. Rest at the inn first.', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, self::QUESTIONS['elite'], array( 'level' => min( 3.7, self::LEVELS[ $t ] + 0.35 ) ) );
		if ( count( $qs ) < 5 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		$w['elite'][ $t ] = Sawa_Tracker_Game::week_start();
		self::save( $uid, $w );
		$foe     = array( 'name' => $town[4][0], 'icon' => $town[4][1], 'hp' => (int) round( 1.5 * self::boss_hp( $t ) ), 'atk' => (int) round( 1.25 * ( 14 + 4 * $t ) ), 'boss' => true, 'elite' => true );
		$support = class_exists( 'Sawa_Tracker_Coop' ) ? Sawa_Tracker_Coop::support_for( $uid, $foe['name'] ) : null;
		return self::battle_start( $uid, 'elite', $qs, $foe, array( 'town' => $t, 'support' => $support ) );
	}

	const TEA_COINS   = 25;
	const TEA_DAY     = 3;
	const STORY_COINS = 20;

	/** Rawi the storyteller: once a day, a gift for finishing a story in Sawa Lens "Stories for you". */
	public static function story_gift() {
		$uid = self::uid();
		if ( ! class_exists( 'Sawa_Lens_Readers' ) || ! Sawa_Lens_Readers::read_today( $uid ) ) {
			return new WP_Error( 'story', 'Read one of your stories today first, then come back and tell me about it!', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Game::m( $uid, 'story_gift', '' ) === Sawa_Tracker_Game::today() ) {
			return new WP_Error( 'story', 'You have my gift for today. Come back tomorrow with a new story!', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Game::set( $uid, 'story_gift', Sawa_Tracker_Game::today() );
		Sawa_Tracker_Raids::add_coins( $uid, self::STORY_COINS, 'story' );
		Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
		return array( 'coins' => self::STORY_COINS, 'elixirs' => 1, 'world' => self::state( $uid ) );
	}

	/** Healing tea at the inn: coins buy back 40% of your health (three cups a day; it can't heal a wound). */
	public static function tea() {
		$uid = self::uid();
		$d   = Sawa_Tracker_Game::m( $uid, 'tea', array() );
		$n   = is_array( $d ) && ( $d['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $d['n'] : 0;
		$max = Sawa_Tracker_Hero::max_hp( $uid );
		if ( $n >= self::TEA_DAY ) {
			return new WP_Error( 'tea', 'Three cups a day is enough! Review cards to heal more.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Hero::hp( $uid ) >= Sawa_Tracker_Wounds::cap( $uid, $max ) ) {
			return new WP_Error( 'tea', Sawa_Tracker_Wounds::of( $uid )['level'] ? 'Tea can\'t heal a wound. Study today to heal it!' : 'Your health is full.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Raids::coins( $uid ) < self::TEA_COINS ) {
			return new WP_Error( 'tea', 'A cup costs 25 coins.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Raids::add_coins( $uid, -self::TEA_COINS );
		Sawa_Tracker_Game::set( $uid, 'tea', array( 'day' => Sawa_Tracker_Game::today(), 'n' => $n + 1 ) );
		Sawa_Tracker_Hero::set_hp( $uid, Sawa_Tracker_Hero::hp( $uid ) + (int) round( 0.4 * $max ) );
		return array( 'hero' => Sawa_Tracker_Hero::sheet( $uid ), 'left' => self::TEA_DAY - $n - 1, 'world' => self::state( $uid ) );
	}

	/** Leave a battle at any time. No rewards; leaving before the second question gives the fight back. */
	public static function flee( WP_REST_Request $r ) {
		$uid = self::uid();
		list( $key, $b ) = self::battle_get( $r, $uid );
		if ( ! $b ) {
			return self::state( $uid );
		}
		delete_transient( $key );
		Sawa_Tracker_Hero::set_hp( $uid, max( 1, (int) $b['me']['hp'] ) );
		$early = count( $b['st']['picks'] ) <= 1;
		if ( $early ) {
			$w = self::get( $uid );
			if ( 'monster' === $b['kind'] ) {
				$w['f']['used'] = max( 0, (int) $w['f']['used'] - 1 );
			} elseif ( 'boss' === $b['kind'] ) {
				$w['f']['boss'] = max( 0, (int) $w['f']['boss'] - 1 );
			}
			self::save( $uid, $w );
		}
		Sawa_Tracker_Play::record_accuracy( $uid, (int) $b['st']['right'], max( 1, count( $b['st']['picks'] ) ) );
		return array( 'fled' => true, 'refund' => $early && in_array( $b['kind'], array( 'monster', 'boss' ), true ), 'hero' => Sawa_Tracker_Hero::sheet( $uid ), 'world' => self::state( $uid ) );
	}

	/** Battle skills cost mana (earned by studying). */
	public static function skill( WP_REST_Request $r ) {
		$uid = self::uid();
		list( $key, $b ) = self::battle_get( $r, $uid );
		if ( ! $b || $b['st']['done'] ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		$sid = sanitize_key( (string) $r->get_param( 'skill' ) );
		$sk  = Sawa_Tracker_Hero::SKILLS[ $sid ] ?? null;
		$i   = count( $b['st']['picks'] );
		if ( ! $sk || ! isset( $b['qs'][ $i ] ) ) {
			return new WP_Error( 'skill', 'Unknown skill.', array( 'status' => 400 ) );
		}
		if ( ! empty( $b['st']['used'][ $i ][ $sid ] ) ) {
			return new WP_Error( 'skill', 'You already used it on this question.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Hero::mana( $uid ) < $sk[1] ) {
			return new WP_Error( 'mana', 'Not enough mana. Study to get more: review cards, do your plan, practise.', array( 'status' => 400 ) );
		}
		$q   = $b['qs'][ $i ];
		$out = array( 'skill' => $sid );
		if ( 'focus' === $sid ) {
			if ( in_array( $q['type'], array( 'mc', 'listen' ), true ) ) {
				$wrong = array_values( array_diff( array_keys( $q['options'] ), array( (int) $q['answer'] ) ) );
				$out['remove'] = $wrong[ wp_rand( 0, count( $wrong ) - 1 ) ];
			} else {
				$out['hint'] = 'Starts with: “' . implode( ' ', array_slice( preg_split( '/\s+/', $q['text'] ), 0, 'order' === $q['type'] ? 2 : 1 ) ) . ( 'type' === $q['type'] ? '' : '…' ) . '”';
				if ( 'type' === $q['type'] ) {
					$out['hint'] = 'Starts with “' . substr( $q['text'], 0, 2 ) . '…” (' . strlen( $q['text'] ) . ' letters)';
				}
			}
		} elseif ( 'hint' === $sid ) {
			$out['lemma'] = ! empty( $q['card'] ) && 0 === strpos( $q['card'], 'w:' ) ? substr( $q['card'], 2 ) : '';
			$ans          = 'type' === $q['type'] || 'order' === $q['type'] ? $q['text'] : ( $q['options'][ $q['answer'] ] ?? '' );
			$out['hint']  = ( ! empty( $q['point'] ) && 'Your word' !== $q['point'] ? 'Think about: ' . $q['point'] . '. ' : '' ) . 'The answer starts with “' . mb_substr( $ans, 0, 1 ) . '”.';
		} elseif ( 'heal' === $sid ) {
			$b['me']['hp'] = min( $b['me']['hpMax'], $b['me']['hp'] + (int) round( 0.4 * $b['me']['hpMax'] ) );
			$out['hp']     = $b['me']['hp'];
		} elseif ( 'power' === $sid ) {
			$b['st']['power'] = true;
		}
		$b['st']['used'][ $i ][ $sid ] = 1;
		set_transient( $key, $b, 20 * MINUTE_IN_SECONDS );
		$out['mana'] = Sawa_Tracker_Hero::add_mana( $uid, -$sk[1] );
		return $out;
	}

	/** Is a party member playing in the same town right now? Then rewards are 20% bigger. */
	private static function party_near( $uid, $t ) {
		$p = Sawa_Tracker_Party::get( Sawa_Tracker_Party::of( $uid ) );
		if ( ! $p ) {
			return false;
		}
		foreach ( $p['members'] as $m ) {
			$pos = Sawa_Tracker_Game::m( $m, 'wpos', array() );
			if ( $m !== $uid && is_array( $pos ) && (int) ( $pos['t'] ?? 0 ) === $t && time() - (int) $pos['at'] < 120 ) {
				return true;
			}
		}
		return false;
	}

	public static function answer( WP_REST_Request $r ) {
		$uid = self::uid();
		list( $key, $b ) = self::battle_get( $r, $uid );
		if ( ! $b ) {
			return new WP_Error( 'battle', 'This battle has ended.', array( 'status' => 404 ) );
		}
		delete_transient( $key );
		$st = $b['st'];
		$fb = array();
		foreach ( $b['qs'] as $i => $q ) {
			if ( ! isset( $st['picks'][ $i ] ) ) {
				break;
			}
			$ok   = (bool) $st['picks'][ $i ];
			$fb[] = array( 'ok' => $ok, 'q' => 'listen' === $q['type'] ? $q['say'] : $q['q'], 'right' => in_array( $q['type'], array( 'type', 'order' ), true ) ? $q['text'] : ( $q['options'][ $q['answer'] ] ?? '' ), 'point' => $q['point'] ?? '', 'why' => $q['why'] ?? '' );
			if ( ! $ok && ! empty( $q['card'] ) && (int) ( $q['user'] ?? 0 ) === $uid ) {
				do_action( 'sawa_tracker_missed_card', $uid, $q['card'] ); // the word comes back in today's review
				$missed = ( $missed ?? 0 ) + 1;
			}
		}
		$right = (int) $st['right'];
		$won   = $b['foe']['hp'] <= 0;
		$ko    = $b['me']['hp'] <= 0;
		Sawa_Tracker_Hero::set_hp( $uid, $ko ? (int) round( 0.3 * $b['me']['hpMax'] ) : $b['me']['hp'] );
		$foe = $b['foe'];
		$out = array( 'kind' => $b['kind'], 'right' => $right, 'total' => count( $fb ), 'attack' => (int) $st['dealt'], 'taken' => (int) $st['taken'], 'best' => (int) $st['best'], 'foe' => $foe, 'review' => $fb, 'coins' => 0, 'elixirs' => 0, 'won' => $won, 'ko' => $ko, 'xp' => 0, 'missedWords' => $missed ?? 0 );
		self::progress( $uid, 'right', $right );
		Sawa_Tracker_Play::record_accuracy( $uid, $right, max( 1, count( $fb ) ) );
		$t     = (int) ( $b['meta']['town'] ?? self::at( $uid ) );
		$bonus = self::party_near( $uid, $t ) ? 1.2 : 1;
		$out['partyBonus'] = $bonus > 1;
		if ( $won && in_array( $b['kind'], array( 'monster', 'boss', 'elite', 'pboss', 'support' ), true ) ) {
			Sawa_Tracker_Game::boss_fighter( $uid ); // breaks the weekly boss's shield together
		}
		if ( ! empty( $b['meta']['support']['call'] ) ) {
			Sawa_Tracker_Coop::support_done( $uid, $b['meta']['support']['call'], $won );
			$out['allies'] = count( $b['meta']['support']['allies'] );
		}
		if ( 'support' === $b['kind'] ) {
			$out = Sawa_Tracker_Coop::after_support( $uid, $b, $right ) + $out;
		} elseif ( 'duel' === $b['kind'] ) {
			$out = Sawa_Tracker_Play::after_duel( $uid, $b, $won, $right ) + $out;
		} elseif ( 'pboss' === $b['kind'] ) {
			$out = Sawa_Tracker_Party::after_hit( $uid, $b, (int) $st['dealt'], $right ) + $out;
		} elseif ( 'boss' === $b['kind'] && $won ) {
			$w = self::get( $uid );
			if ( ! in_array( $t, $w['beaten'], true ) ) {
				$w['beaten'][]    = $t;
				$w['story'][ $t ] = array( 'step' => 3, 'count' => 0 );
				$w['titles'][]    = 'Hero of ' . self::TOWNS[ $t ][0];
				self::save( $uid, $w );
				$out['coins']   = Sawa_Tracker_Raids::add_coins( $uid, (int) round( 30 * $t * $bonus ) );
				$out['elixirs'] = 2;
				Sawa_Tracker_RPG::add_elixirs( $uid, 2 );
				$out['title']   = 'Hero of ' . self::TOWNS[ $t ][0];
				$out['next']    = self::TOWNS[ $t + 1 ][0] ?? '';
				$out['xp']      = Sawa_Tracker_XP::award( $uid, ( 30 + 5 * $t ) * self::xp_mult(), 'boss', false );
				Sawa_Tracker_Hero::count( $uid, 'bosses' );
				self::progress( $uid, 'boss' );
				Sawa_Tracker_Game::event( $uid, 'town', null, array( 'boss' => $foe['name'], 'town' => self::TOWNS[ $t ][0], 'next' => $out['next'] ) );
			}
		} elseif ( 'elite' === $b['kind'] && $won ) {
			$out['coins']   = Sawa_Tracker_Raids::add_coins( $uid, (int) round( 25 * $t * $bonus ) );
			$out['elixirs'] = 1;
			Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
			$out['xp']      = Sawa_Tracker_XP::award( $uid, ( 40 + 5 * $t ) * self::xp_mult(), 'elite', false );
			$w              = self::get( $uid );
			$champ          = 'Champion of ' . self::TOWNS[ $t ][0];
			if ( ! in_array( $champ, $w['titles'], true ) ) {
				$w['titles'][] = $champ;
				self::save( $uid, $w );
				$out['title']  = $champ;
			}
			Sawa_Tracker_Game::event( $uid, 'town', null, array( 'boss' => 'elite ' . $foe['name'], 'town' => self::TOWNS[ $t ][0], 'next' => '' ) );
		} elseif ( 'monster' === $b['kind'] ) {
			if ( $won ) {
				$out['coins'] = Sawa_Tracker_Raids::add_coins( $uid, (int) round( ( 3 + $t + ( $st['best'] >= 5 ? 3 : 0 ) ) * $bonus ) );
				if ( 1 === wp_rand( 1, 6 ) ) {
					$out['elixirs'] = 1;
					Sawa_Tracker_RPG::add_elixirs( $uid, 1 );
				}
				$out['xp'] = Sawa_Tracker_XP::award( $uid, (int) round( ( 5 + $t ) * $bonus * self::xp_mult() ), 'battle', 1 === self::xp_mult() );
				Sawa_Tracker_Hero::count( $uid, 'kills' );
				self::progress( $uid, 'monster' );
			} else {
				$out['coins'] = Sawa_Tracker_Raids::add_coins( $uid, 1 );
			}
		}
		$out['hero']  = Sawa_Tracker_Hero::sheet( $uid );
		$out['world'] = self::state( $uid );
		return $out;
	}


	/** The student shared their card on Skool (counted when they open Skool from the share screen). */
	public static function shared() {
		$uid = get_current_user_id();
		$w   = self::get( $uid );
		if ( (int) ( $w['wk']['c']['share'] ?? 0 ) < 1 ) {
			self::progress( $uid, 'share' );
		}
		return self::state( $uid );
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
