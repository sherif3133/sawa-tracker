<?php
/**
 * The Caravan: co-op on the Silk Road that works when students study at different times of day.
 *
 * - Calls for help: stuck on a boss or a monster? Call the caravan. Other travellers answer when they play: each one
 *   fights a short support battle (4 questions of their own English), and their role turns their right answers
 *   into help for your next fight against that foe: a Guardian's shield, a Healer's heals, a Mage's fireball, a
 *   Trickster's frost. They stand next to you in the arena. When you win, your helpers get XP and coins too.
 * - (Older: word questions answered in English. Still served, no longer shown in the game.)
 * - The caravanserai: one weekly project for the whole community. It needs three materials that come from
 *   different people: bricks (right battle answers), lanterns (review cards) and lessons (explanations marked
 *   helpful). Lessons only come from helping each other, so the project can't be finished alone.
 * - Guides: students further along the road volunteer; every newcomer gets one guide for their first two weeks.
 *   Three pair steps reward both: the newcomer's first question answered, three days both studied, and the
 *   newcomer's first town boss.
 *
 * Every student writes their own counters (user meta); the shared lists (asks, pairs) change only on rare actions.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Coop {

	const ASKS_OPT     = 'sawa_tr_coop_asks';
	const MAX_ASKS     = 200;
	const ASKS_DAY     = 3;
	const OPEN_MAX     = 5;
	const ANSWERS_DAY  = 10;
	const ANSWER_WORDS = 6;
	const HELP_XP      = 20; // when the asker says it helped
	const HELP_COINS   = 10;
	const HELPED_DAY   = 5;  // rewarded "helped" per helper per day
	const GUIDE_DAYS   = 14;
	const GUIDE_MAX    = 3;  // newcomers per guide
	/** The caravanserai: [key, icon, name, what makes it, goal per active student, minimum goal]. */
	const MATERIALS = array(
		array( 'bricks', '🧱', 'Bricks', 'right battle answers', 12, 150 ),
		array( 'lanterns', '🏮', 'Lanterns', 'review cards', 15, 200 ),
		array( 'lessons', '⚔', 'Battles won together', 'calls for help that ended in a win', 1, 6 ),
	);
	/** Guide and newcomer steps: [key, text, reward coins]. */
	const PAIR_STEPS = array(
		array( 'ask', 'The guide helps the newcomer win a battle', 15 ),
		array( 'days', 'Study on the same day 3 times', 20 ),
		array( 'boss', 'The newcomer defeats their first town boss', 40 ),
	);

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'sawa_tracker_progress', array( __CLASS__, 'on_progress' ), 10, 3 );
	}

	public static function routes() {
		$routes = array(
			array( '/coop', 'GET', 'state_rest' ),
			array( '/coop/guide', 'POST', 'guide' ),
			array( '/coop/call', 'POST', 'call' ),
			array( '/coop/call/cancel', 'POST', 'call_cancel' ),
			array( '/coop/help', 'POST', 'help' ),
			array( '/coop/donate', 'POST', 'donate' ),
		);
		foreach ( $routes as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => $r[1], 'callback' => array( __CLASS__, $r[2] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	private static function uid() {
		return get_current_user_id();
	}

	private static function first( $uid ) {
		$n = Sawa_Tracker_Game::person( $uid )['name'];
		return strtok( (string) $n, ' ' );
	}

	/** English only: no Arabic letters, no Franco-Arabic. */
	private static function english( $text ) {
		return ! preg_match( '/[\x{0600}-\x{06FF}]/u', $text ) && ! Sawa_Tracker_Social::franco( $text ) && preg_match( '/[a-z]{2}/i', $text );
	}

	private static function clean( $text, $max ) {
		return mb_substr( trim( preg_replace( '/\s+/u', ' ', sanitize_text_field( (string) $text ) ) ), 0, $max );
	}

	private static function words( $text ) {
		return count( preg_split( '/\s+/', trim( $text ), -1, PREG_SPLIT_NO_EMPTY ) );
	}

	/** A per-day counter in user meta: returns today's value; $add > 0 adds to it. */
	private static function daily( $uid, $key, $add = 0 ) {
		$d = Sawa_Tracker_Game::m( $uid, 'coop_' . $key, array() );
		$n = is_array( $d ) && ( $d['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $d['n'] : 0;
		if ( $add ) {
			$n += $add;
			Sawa_Tracker_Game::set( $uid, 'coop_' . $key, array( 'day' => Sawa_Tracker_Game::today(), 'n' => $n ) );
		}
		return $n;
	}

	/* ------------------------------------------------------------------ asks */

	private static function asks() {
		$a = get_option( self::ASKS_OPT, array() );
		return is_array( $a ) ? $a : array();
	}

	private static function save_asks( $list ) {
		update_option( self::ASKS_OPT, array_slice( array_values( $list ), -self::MAX_ASKS ), false );
	}

	private static function ask_out( $a, $uid ) {
		$answers = array();
		foreach ( $a['answers'] as $x ) {
			$answers[] = array( 'id' => $x['id'], 'by' => self::first( $x['uid'] ), 'byId' => (int) $x['uid'], 'text' => $x['text'], 'helped' => ! empty( $x['helped'] ), 'mine' => (int) $x['uid'] === $uid, 'at' => (int) $x['at'] );
		}
		$p = Sawa_Tracker_Game::person( (int) $a['uid'] );
		return array(
			'id'       => $a['id'],
			'kind'     => $a['kind'],
			'lemma'    => $a['lemma'],
			'q'        => $a['q'],
			'ctx'      => $a['ctx'],
			'src'      => $a['src'],
			'by'       => self::first( $a['uid'] ),
			'byId'     => (int) $a['uid'],
			'avatar'   => $p['avatar'] ?? '',
			'to'       => $a['to'] ? self::first( $a['to'] ) : '',
			'toMe'     => (int) $a['to'] === $uid,
			'mine'     => (int) $a['uid'] === $uid,
			'answered' => (bool) array_filter( $a['answers'], function ( $x ) use ( $uid ) { return (int) $x['uid'] === $uid; } ),
			'answers'  => $answers,
			'closed'   => ! empty( $a['closed'] ),
			'at'       => (int) $a['at'],
		);
	}

	/** The question an A2 learner doesn't have to write: made from what they tapped. */
	private static function auto_q( $kind, $lemma ) {
		if ( 'word' === $kind ) {
			return 'What does "' . $lemma . '" mean here? Can you give me an easy example?';
		}
		if ( 'sentence' === $kind ) {
			return 'Can you explain this sentence in easy English?';
		}
		return 'Can you help me with this?';
	}

	public static function ask( WP_REST_Request $r ) {
		$uid   = self::uid();
		$kind  = in_array( $r->get_param( 'kind' ), array( 'word', 'sentence', 'grammar', 'other' ), true ) ? $r->get_param( 'kind' ) : 'other';
		$lemma = mb_substr( strtolower( trim( sanitize_text_field( (string) $r->get_param( 'lemma' ) ) ) ), 0, 64 );
		$ctx   = self::clean( $r->get_param( 'ctx' ), 240 );
		$q     = self::clean( $r->get_param( 'q' ), 200 );
		$to    = (int) $r->get_param( 'to' );
		if ( '' === $q ) {
			$q = self::auto_q( $kind, $lemma );
		}
		if ( ! self::english( $q ) || ( '' !== $ctx && preg_match( '/[\x{0600}-\x{06FF}]/u', $ctx ) ) ) {
			return new WP_Error( 'coop', 'Ask in English. Short and simple is fine — or tap a word and use the ready question.', array( 'status' => 400 ) );
		}
		if ( 'word' === $kind && '' === $lemma ) {
			return new WP_Error( 'coop', 'Which word?', array( 'status' => 400 ) );
		}
		if ( $to && ( $to === $uid || ! Sawa_Tracker_Game::is_member( $to ) ) ) {
			$to = 0;
		}
		$list = self::asks();
		$open = count( array_filter( $list, function ( $a ) use ( $uid ) { return (int) $a['uid'] === $uid && empty( $a['closed'] ); } ) );
		if ( $open >= self::OPEN_MAX ) {
			return new WP_Error( 'coop', 'You have 5 open questions. Close one first (tap “This helped” or “Close”).', array( 'status' => 400 ) );
		}
		if ( self::daily( $uid, 'asks' ) >= self::ASKS_DAY ) {
			return new WP_Error( 'coop', 'You can ask 3 questions a day. Come back tomorrow!', array( 'status' => 400 ) );
		}
		self::daily( $uid, 'asks', 1 );
		$a      = array( 'id' => wp_generate_password( 10, false ), 'uid' => $uid, 'to' => $to, 'kind' => $kind, 'lemma' => $lemma, 'q' => Sawa_Tracker_Social::filter_words( $q ), 'ctx' => Sawa_Tracker_Social::filter_words( $ctx ), 'src' => self::clean( $r->get_param( 'src' ), 80 ), 'town' => Sawa_Tracker_World::at( $uid ), 'answers' => array(), 'at' => time() );
		$list[] = $a;
		self::save_asks( $list );
		if ( $to ) {
			Sawa_Tracker_Game::event( $uid, 'coop_ask', $to, array( 'q' => mb_substr( $a['q'], 0, 80 ), 'lemma' => $lemma ) );
		}
		return self::state( $uid ) + array( 'asked' => $a['id'] );
	}

	public static function answer( WP_REST_Request $r ) {
		$uid  = self::uid();
		$id   = (string) $r->get_param( 'id' );
		$text = self::clean( $r->get_param( 'text' ), 300 );
		if ( ! self::english( $text ) ) {
			return new WP_Error( 'coop', 'Answer in English — simple words are perfect. (Use the Chat tab if you need a translation first.)', array( 'status' => 400 ) );
		}
		if ( self::words( $text ) < self::ANSWER_WORDS ) {
			return new WP_Error( 'coop', 'Write a little more: 6 words or more. Try an example sentence!', array( 'status' => 400 ) );
		}
		if ( self::daily( $uid, 'answers' ) >= self::ANSWERS_DAY ) {
			return new WP_Error( 'coop', 'You answered 10 questions today — thank you! Come back tomorrow.', array( 'status' => 400 ) );
		}
		$list = self::asks();
		foreach ( $list as $i => $a ) {
			if ( $a['id'] !== $id ) {
				continue;
			}
			if ( (int) $a['uid'] === $uid || ! empty( $a['closed'] ) ) {
				return new WP_Error( 'coop', 'This question is closed.', array( 'status' => 400 ) );
			}
			foreach ( $a['answers'] as $x ) {
				if ( (int) $x['uid'] === $uid ) {
					return new WP_Error( 'coop', 'You already answered this one.', array( 'status' => 400 ) );
				}
			}
			$list[ $i ]['answers'][] = array( 'id' => wp_generate_password( 8, false ), 'uid' => $uid, 'text' => Sawa_Tracker_Social::filter_words( $text ), 'at' => time() );
			self::save_asks( $list );
			self::daily( $uid, 'answers', 1 );
			$xp = Sawa_Tracker_XP::award( $uid, min( 15, self::words( $text ) ), 'help' ); // writing English counts like chat
			Sawa_Tracker_World::progress( $uid, 'answer' );
			Sawa_Tracker_World::progress( $uid, 'use' );
			Sawa_Tracker_Game::event( $uid, 'coop_answer', (int) $a['uid'], array( 'q' => mb_substr( $a['q'], 0, 80 ), 'lemma' => $a['lemma'] ) );
			return self::state( $uid ) + array( 'xp' => $xp );
		}
		return new WP_Error( 'coop', 'This question is gone.', array( 'status' => 404 ) );
	}

	/** The asker says an answer helped: rewards for the helper (and a lesson for the caravanserai). */
	public static function helped( WP_REST_Request $r ) {
		$uid  = self::uid();
		$id   = (string) $r->get_param( 'id' );
		$aid  = (string) $r->get_param( 'answer' );
		$list = self::asks();
		foreach ( $list as $i => $a ) {
			if ( $a['id'] !== $id || (int) $a['uid'] !== $uid ) {
				continue;
			}
			foreach ( $a['answers'] as $k => $x ) {
				if ( $x['id'] !== $aid || ! empty( $x['helped'] ) ) {
					continue;
				}
				$helper                              = (int) $x['uid'];
				$list[ $i ]['answers'][ $k ]['helped'] = time();
				self::save_asks( $list );
				$got = array( 'xp' => 0, 'coins' => 0 );
				if ( self::daily( $helper, 'helped' ) < self::HELPED_DAY ) {
					self::daily( $helper, 'helped', 1 );
					$got['xp']    = Sawa_Tracker_XP::award( $helper, self::HELP_XP, 'helped', false );
					$got['coins'] = Sawa_Tracker_Raids::add_coins( $helper, self::HELP_COINS );
				}
				self::bump( $helper, 'lessons', 1 );
				self::bump( $helper, 'helpedAll', 1, false );
				Sawa_Tracker_World::progress( $helper, 'helped' );
				Sawa_Tracker_Raids::add_coins( $uid, 3 ); // for closing the loop
				Sawa_Tracker_Game::event( $uid, 'coop_helped', $helper, array( 'q' => mb_substr( $a['q'], 0, 80 ), 'lemma' => $a['lemma'], 'xp' => $got['xp'], 'coins' => $got['coins'] ) );
				self::pair_ask( $uid, $helper );
				return self::state( $uid ) + array( 'thanked' => self::first( $helper ) );
			}
		}
		return new WP_Error( 'coop', 'Not found.', array( 'status' => 404 ) );
	}

	public static function close( WP_REST_Request $r ) {
		$uid  = self::uid();
		$list = self::asks();
		foreach ( $list as $i => $a ) {
			if ( $a['id'] === (string) $r->get_param( 'id' ) && ( (int) $a['uid'] === $uid || user_can( $uid, 'manage_options' ) ) ) {
				$list[ $i ]['closed'] = 1;
				self::save_asks( $list );
			}
		}
		return self::state( $uid );
	}

	/* ------------------------------------------------------------------ calls for help (battle support by role) */

	const CALLS_OPT  = 'sawa_tr_coop_calls';
	const CALL_HOURS = 48;
	const HELPERS    = 3;
	const HELPS_DAY  = 3;

	private static function calls() {
		$c = get_option( self::CALLS_OPT, array() );
		return array_values( array_filter( is_array( $c ) ? $c : array(), function ( $x ) { return time() < (int) $x['ends'] + DAY_IN_SECONDS; } ) );
	}

	private static function save_calls( $c ) {
		update_option( self::CALLS_OPT, array_slice( array_values( $c ), -100 ), false );
	}

	private static function my_call( $uid ) {
		foreach ( array_reverse( self::calls() ) as $c ) {
			if ( (int) $c['uid'] === $uid && empty( $c['used'] ) && time() < (int) $c['ends'] ) {
				return $c;
			}
		}
		return null;
	}

	private static function call_out( $c, $uid ) {
		$p = Sawa_Tracker_Game::person( (int) $c['uid'] );
		return array(
			'id'      => $c['id'],
			'by'      => self::first( $c['uid'] ),
			'byId'    => (int) $c['uid'],
			'avatar'  => $p['avatar'] ?? '',
			'role'    => Sawa_Tracker_Combat::role( (int) $c['uid'] ),
			'foe'     => $c['foe'],
			'msg'     => $c['msg'],
			'helpers' => array_map( function ( $h ) { return array( 'name' => self::first( $h['uid'] ), 'role' => $h['role'], 'power' => (int) $h['power'] ); }, $c['helpers'] ),
			'full'    => count( $c['helpers'] ) >= self::HELPERS,
			'helped'  => (bool) array_filter( $c['helpers'], function ( $h ) use ( $uid ) { return (int) $h['uid'] === $uid; } ),
			'mine'    => (int) $c['uid'] === $uid,
			'mate'    => Sawa_Tracker_Social::clan_of( $uid ) && Sawa_Tracker_Social::clan_of( $uid ) === Sawa_Tracker_Social::clan_of( (int) $c['uid'] ),
			'used'    => ! empty( $c['used'] ),
			'won'     => ! empty( $c['won'] ),
			'at'      => (int) $c['at'],
			'ends'    => (int) $c['ends'],
		);
	}

	/** Call the caravan against the town boss (kind boss) or a monster of this town (kind monster, m = 0–2). */
	public static function call( WP_REST_Request $r ) {
		$uid  = self::uid();
		$kind = 'boss' === $r->get_param( 'kind' ) ? 'boss' : 'monster';
		$w    = Sawa_Tracker_World::get( $uid );
		$t    = Sawa_Tracker_World::TOWNS[ $w['at'] ];
		if ( self::my_call( $uid ) ) {
			return new WP_Error( 'coop', 'You already have a call for help open. Fight that battle first — or cancel it.', array( 'status' => 400 ) );
		}
		if ( 'boss' === $kind && in_array( (int) $w['at'], $w['beaten'], true ) && ( $w['elite'][ (int) $w['at'] ] ?? '' ) === Sawa_Tracker_Game::week_start() ) {
			return new WP_Error( 'coop', 'You already fought this boss this week!', array( 'status' => 400 ) );
		}
		$m    = $t[3][ min( 2, max( 0, (int) $r->get_param( 'm' ) ) ) ];
		$foe  = 'boss' === $kind ? array( 'name' => $t[4][0], 'icon' => $t[4][1], 'kind' => 'boss' ) : array( 'name' => $m[0], 'icon' => $m[1], 'kind' => 'monster' );
		$foe['town'] = $t[0];
		$msg  = mb_substr( trim( Sawa_Tracker_Social::filter_words( sanitize_text_field( (string) $r->get_param( 'msg' ) ) ) ), 0, 120 );
		if ( '' !== $msg && ! self::english( $msg ) ) {
			$msg = '';
		}
		$list   = self::calls();
		$c      = array( 'id' => wp_generate_password( 10, false ), 'uid' => $uid, 'foe' => $foe, 'msg' => $msg, 'helpers' => array(), 'at' => time(), 'ends' => time() + self::CALL_HOURS * HOUR_IN_SECONDS );
		$list[] = $c;
		self::save_calls( $list );
		// clanmates and a guide hear about it first
		$tell = Sawa_Tracker_Social::clan_of( $uid ) ? Sawa_Tracker_Social::clan_members( Sawa_Tracker_Social::clan_of( $uid ) ) : array();
		$pair = self::pair( $uid );
		if ( $pair ) {
			$tell[] = (int) $pair['guide'];
		}
		foreach ( array_unique( array_map( function ( $x ) { return (int) ( is_array( $x ) ? ( $x['id'] ?? 0 ) : $x ); }, $tell ) ) as $to ) {
			if ( $to && $to !== $uid ) {
				Sawa_Tracker_Game::event( $uid, 'coop_call', $to, array( 'foe' => $foe['name'], 'icon' => $foe['icon'] ) );
			}
		}
		return self::state( $uid );
	}

	public static function call_cancel() {
		$uid  = self::uid();
		$list = self::calls();
		foreach ( $list as $i => $c ) {
			if ( (int) $c['uid'] === $uid && empty( $c['used'] ) ) {
				$list[ $i ]['used'] = 1;
			}
		}
		self::save_calls( $list );
		return self::state( $uid );
	}

	/** Answer a call: a 4-question support battle of your own English. Right answers become your help. */
	public static function help( WP_REST_Request $r ) {
		$uid = self::uid();
		$id  = (string) $r->get_param( 'id' );
		$c   = null;
		foreach ( self::calls() as $x ) {
			if ( $x['id'] === $id ) {
				$c = $x;
			}
		}
		if ( ! $c || ! empty( $c['used'] ) || time() > (int) $c['ends'] ) {
			return new WP_Error( 'coop', 'This call is over. Thank you anyway!', array( 'status' => 400 ) );
		}
		if ( (int) $c['uid'] === $uid ) {
			return new WP_Error( 'coop', 'This is your own call. Others will answer it.', array( 'status' => 400 ) );
		}
		$out = self::call_out( $c, $uid );
		if ( $out['helped'] || $out['full'] ) {
			return new WP_Error( 'coop', $out['helped'] ? 'You already helped here.' : 'This call has 3 helpers already.', array( 'status' => 400 ) );
		}
		if ( self::daily( $uid, 'helps' ) >= self::HELPS_DAY ) {
			return new WP_Error( 'coop', 'You helped 3 times today. Thank you! Come back tomorrow.', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 4, array( 'own' => true, 'weak' => true ) );
		if ( count( $qs ) < 4 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		self::daily( $uid, 'helps', 1 );
		return Sawa_Tracker_World::battle_start( $uid, 'support', $qs, array( 'name' => $c['foe']['name'], 'icon' => $c['foe']['icon'], 'hp' => 999, 'atk' => 6, 'boss' => 'boss' === $c['foe']['kind'], 'for' => self::first( $c['uid'] ) ), array( 'call' => $c['id'], 'for' => self::first( $c['uid'] ) ) );
	}

	/** After a support battle: the helper's role and right answers are saved on the call. */
	public static function after_support( $uid, $b, $right ) {
		$list = self::calls();
		$role = Sawa_Tracker_Combat::role( $uid );
		$out  = array( 'support' => true, 'role' => $role, 'power' => $right, 'for' => $b['meta']['for'] ?? '' );
		foreach ( $list as $i => $c ) {
			if ( $c['id'] !== ( $b['meta']['call'] ?? '' ) || ! empty( $c['used'] ) || count( $c['helpers'] ) >= self::HELPERS ) {
				continue;
			}
			if ( array_filter( $c['helpers'], function ( $h ) use ( $uid ) { return (int) $h['uid'] === $uid; } ) ) {
				break;
			}
			$list[ $i ]['helpers'][] = array( 'uid' => $uid, 'role' => $role, 'power' => max( 1, (int) $right ), 'at' => time() );
			self::save_calls( $list );
			$out['xp']    = Sawa_Tracker_XP::award( $uid, 10, 'support', false );
			$out['coins'] = Sawa_Tracker_Raids::add_coins( $uid, 5 );
			Sawa_Tracker_World::progress( $uid, 'answer' );
			Sawa_Tracker_Game::event( $uid, 'coop_support', (int) $c['uid'], array( 'foe' => $c['foe']['name'], 'role' => $role ) );
			$out['help'] = Sawa_Tracker_Combat::help_text( $role, max( 1, (int) $right ) );
			break;
		}
		return $out;
	}

	/** The support waiting for this student's next fight against this foe (used once). */
	public static function support_for( $uid, $foe_name ) {
		$list = self::calls();
		foreach ( $list as $i => $c ) {
			if ( (int) $c['uid'] === $uid && empty( $c['used'] ) && $c['foe']['name'] === $foe_name && $c['helpers'] && time() < (int) $c['ends'] ) {
				$list[ $i ]['used'] = 1;
				self::save_calls( $list );
				$allies = array();
				foreach ( $c['helpers'] as $h ) {
					$allies[] = array( 'uid' => (int) $h['uid'], 'name' => self::first( $h['uid'] ), 'role' => $h['role'], 'power' => (int) $h['power'], 'avatar' => Sawa_Tracker_Play::avatar( (int) $h['uid'] ) );
				}
				return array( 'call' => $c['id'], 'allies' => $allies );
			}
		}
		return null;
	}

	/** After the student's battle with support: helpers share the win. */
	public static function support_done( $uid, $call_id, $won ) {
		$list = self::calls();
		foreach ( $list as $i => $c ) {
			if ( $c['id'] !== $call_id ) {
				continue;
			}
			$list[ $i ]['won'] = $won ? 1 : 0;
			self::save_calls( $list );
			foreach ( $c['helpers'] as $h ) {
				$hid = (int) $h['uid'];
				if ( $won ) {
					Sawa_Tracker_XP::award( $hid, 20, 'support_win', false );
					Sawa_Tracker_Raids::add_coins( $hid, 15 );
					self::bump( $hid, 'lessons', 1 );
					self::bump( $hid, 'helpedAll', 1, false );
					Sawa_Tracker_World::progress( $hid, 'helped' );
					self::pair_ask( $uid, $hid );
				}
				Sawa_Tracker_Game::event( $uid, 'coop_won', $hid, array( 'foe' => $c['foe']['name'], 'won' => $won ) );
			}
		}
	}

	/* ------------------------------------------------------------------ the caravanserai (weekly) */

	const DONATE_COINS = 30;
	const DONATE_WEEK  = 3;

	/** Coins for the caravanserai: 30 coins buy 10 bricks (three times a week). */
	public static function donate() {
		$uid = self::uid();
		$c   = self::mine_wk( $uid );
		if ( (int) ( $c['donated'] ?? 0 ) >= self::DONATE_WEEK ) {
			return new WP_Error( 'coop', 'You gave 3 times this week — thank you! Battles bring more bricks.', array( 'status' => 400 ) );
		}
		if ( Sawa_Tracker_Raids::coins( $uid ) < self::DONATE_COINS ) {
			return new WP_Error( 'coop', 'A gift costs 30 coins.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Raids::add_coins( $uid, -self::DONATE_COINS );
		self::bump( $uid, 'donated', 1 );
		self::bump( $uid, 'bricks', 10 );
		return self::state( $uid );
	}

	/** This student's materials this week. $weekly false: an all-time counter. */
	private static function mine_wk( $uid ) {
		$c = Sawa_Tracker_Game::m( $uid, 'coop_wk', array() );
		return is_array( $c ) && ( $c['week'] ?? '' ) === Sawa_Tracker_Game::week_start() ? $c : array( 'week' => Sawa_Tracker_Game::week_start() );
	}

	private static function bump( $uid, $key, $n, $weekly = true ) {
		if ( $weekly ) {
			$c         = self::mine_wk( $uid );
			$c[ $key ] = (int) ( $c[ $key ] ?? 0 ) + $n;
			Sawa_Tracker_Game::set( $uid, 'coop_wk', $c );
			return;
		}
		Sawa_Tracker_Game::set( $uid, 'coop_' . $key, (int) Sawa_Tracker_Game::m( $uid, 'coop_' . $key, 0 ) + $n );
	}

	/** Called from Sawa_Tracker_World::progress: materials, and "studied today" for guide pairs. */
	public static function on_progress( $uid, $kind, $n ) {
		if ( 'right' === $kind ) {
			self::bump( $uid, 'bricks', $n );
		} elseif ( 'card' === $kind ) {
			self::bump( $uid, 'lanterns', $n );
		}
		if ( in_array( $kind, array( 'card', 'right', 'practice', 'use', 'plan' ), true ) ) {
			self::pair_day( $uid );
		}
		if ( 'boss' === $kind ) {
			self::pair_boss( $uid );
		}
	}

	public static function project() {
		$week   = Sawa_Tracker_Game::week_start();
		$ids    = Sawa_Tracker_Game::member_ids();
		$have   = array();
		$people = array();
		$active = 0;
		foreach ( $ids as $m ) {
			$c = Sawa_Tracker_Game::m( $m, 'coop_wk', array() );
			if ( ! is_array( $c ) || ( $c['week'] ?? '' ) !== $week ) {
				continue;
			}
			$any = false;
			foreach ( self::MATERIALS as $mat ) {
				$v = (int) ( $c[ $mat[0] ] ?? 0 );
				if ( $v > 0 ) {
					$have[ $mat[0] ]   = ( $have[ $mat[0] ] ?? 0 ) + $v;
					$people[ $mat[0] ][] = array( 'name' => self::first( $m ), 'n' => $v );
					$any               = true;
				}
			}
			$active += $any ? 1 : 0;
		}
		// The goal is set from last week's active students, so it stays fixed during the week.
		$size = get_option( 'sawa_tr_coop_size', array() );
		if ( ! is_array( $size ) || ( $size['week'] ?? '' ) !== $week ) {
			$size = array( 'week' => $week, 'n' => max( 3, (int) ( $size['last'] ?? 0 ) ), 'last' => 0 );
		}
		if ( $active > (int) $size['last'] ) {
			$size['last'] = $active;
			update_option( 'sawa_tr_coop_size', $size, false );
		} elseif ( ! get_option( 'sawa_tr_coop_size' ) ) {
			update_option( 'sawa_tr_coop_size', $size, false );
		}
		$mats = array();
		$done = true;
		foreach ( self::MATERIALS as $mat ) {
			$goal = max( $mat[5], $mat[4] * (int) $size['n'] );
			$v    = (int) ( $have[ $mat[0] ] ?? 0 );
			$top  = $people[ $mat[0] ] ?? array();
			usort( $top, function ( $a, $b ) { return $b['n'] <=> $a['n']; } );
			$mats[] = array( 'key' => $mat[0], 'icon' => $mat[1], 'name' => $mat[2], 'from' => $mat[3], 'have' => min( $v, $goal ), 'goal' => $goal, 'top' => array_slice( $top, 0, 3 ), 'people' => count( $top ) );
			$done   = $done && $v >= $goal;
		}
		$pct = (int) floor( 100 * array_sum( array_map( function ( $m ) { return min( 1, $m['have'] / max( 1, $m['goal'] ) ); }, $mats ) ) / count( $mats ) );
		if ( $done ) {
			self::project_payout( $week, $ids );
		}
		return array( 'name' => 'The caravanserai', 'week' => $week, 'ends' => Sawa_Tracker_Game::add_days( $week, 6 ), 'materials' => $mats, 'pct' => $pct, 'done' => $done, 'builders' => $active, 'reward' => '30 🪙 + 1 ⚗ + 20 XP' );
	}

	/** Everyone who brought anything this week gets the reward, once (the option is a lock). */
	private static function project_payout( $week, $ids ) {
		if ( ! add_option( 'sawa_tr_coop_paid_' . $week, time(), '', 'no' ) ) {
			return;
		}
		$n = 0;
		foreach ( $ids as $m ) {
			$c = Sawa_Tracker_Game::m( $m, 'coop_wk', array() );
			if ( is_array( $c ) && ( $c['week'] ?? '' ) === $week && ( (int) ( $c['bricks'] ?? 0 ) + (int) ( $c['lanterns'] ?? 0 ) + (int) ( $c['lessons'] ?? 0 ) ) > 0 ) {
				Sawa_Tracker_Raids::add_coins( $m, 30 );
				Sawa_Tracker_RPG::add_elixirs( $m, 1 );
				Sawa_Tracker_XP::award( $m, 20, 'project', false );
				++$n;
			}
		}
		Sawa_Tracker_Game::event( 0, 'coop_built', null, array( 'builders' => $n ) );
	}

	/* ------------------------------------------------------------------ guides and newcomers */

	/** Can volunteer as a guide: two town bosses beaten, or level 5. */
	public static function can_guide( $uid ) {
		return count( (array) Sawa_Tracker_World::get( $uid )['beaten'] ) >= 2 || Sawa_Tracker_Hero::level( $uid ) >= 5 || user_can( $uid, 'manage_options' );
	}

	private static function pair( $mentee ) {
		$p = get_option( 'sawa_tr_coop_pair_' . (int) $mentee );
		return is_array( $p ) ? $p : null;
	}

	private static function save_pair( $p ) {
		update_option( 'sawa_tr_coop_pair_' . (int) $p['mentee'], $p, false );
	}

	/** The newcomer whose guide this student is (active pairs only). */
	private static function mentees( $uid ) {
		$ids = Sawa_Tracker_Game::m( $uid, 'coop_mentees', array() );
		return array_values( array_filter( array_map( 'intval', is_array( $ids ) ? $ids : array() ), function ( $m ) use ( $uid ) { $p = self::pair( $m ); return $p && (int) $p['guide'] === $uid && time() < (int) $p['ends']; } ) );
	}

	/** A newcomer (joined less than 2 weeks ago, no town boss yet) gets a guide the first time they open the caravan. */
	private static function match( $uid ) {
		$p = self::pair( $uid );
		if ( $p ) {
			return $p;
		}
		$u     = get_userdata( $uid );
		$start = $u ? (int) strtotime( $u->user_registered . ' UTC' ) : 0; // new members only, not everyone on the day this ships
		if ( time() - $start > self::GUIDE_DAYS * DAY_IN_SECONDS || Sawa_Tracker_World::get( $uid )['beaten'] || self::can_guide( $uid ) ) {
			return null;
		}
		$best = 0;
		$load = 99;
		foreach ( Sawa_Tracker_Game::member_ids() as $g ) {
			if ( $g === $uid || ! Sawa_Tracker_Game::m( $g, 'coop_guide', 0 ) || ! self::can_guide( $g ) ) {
				continue;
			}
			$pos = Sawa_Tracker_Game::m( $g, 'wpos', array() );
			if ( ! is_array( $pos ) || time() - (int) ( $pos['at'] ?? 0 ) > 7 * DAY_IN_SECONDS ) {
				continue; // guides must have played this week
			}
			$n = count( self::mentees( $g ) );
			if ( $n < self::GUIDE_MAX && $n < $load ) {
				$best = $g;
				$load = $n;
			}
		}
		if ( ! $best ) {
			return null;
		}
		$p = array( 'mentee' => $uid, 'guide' => $best, 'start' => time(), 'ends' => time() + self::GUIDE_DAYS * DAY_IN_SECONDS, 'done' => array(), 'days' => array() );
		self::save_pair( $p );
		$list   = self::mentees( $best );
		$list[] = $uid;
		Sawa_Tracker_Game::set( $best, 'coop_mentees', $list );
		Sawa_Tracker_Game::event( $uid, 'coop_guide', $best, array() );
		return $p;
	}

	private static function pair_step( $p, $key ) {
		if ( in_array( $key, $p['done'], true ) ) {
			return $p;
		}
		$p['done'][] = $key;
		foreach ( self::PAIR_STEPS as $s ) {
			if ( $s[0] === $key ) {
				Sawa_Tracker_Raids::add_coins( (int) $p['mentee'], $s[2] );
				Sawa_Tracker_Raids::add_coins( (int) $p['guide'], $s[2] );
				Sawa_Tracker_XP::award( (int) $p['guide'], 15, 'guide', false );
				Sawa_Tracker_Game::event( (int) $p['mentee'], 'coop_pair', (int) $p['guide'], array( 'step' => $s[1], 'coins' => $s[2] ) );
				Sawa_Tracker_Game::event( (int) $p['guide'], 'coop_pair', (int) $p['mentee'], array( 'step' => $s[1], 'coins' => $s[2] ) );
			}
		}
		if ( count( $p['done'] ) === count( self::PAIR_STEPS ) ) {
			$w = Sawa_Tracker_World::get( (int) $p['guide'] );
			if ( ! in_array( 'Guide of the Road', $w['titles'], true ) ) {
				$w['titles'][] = 'Guide of the Road';
				Sawa_Tracker_World::save( (int) $p['guide'], $w );
			}
		}
		return $p;
	}

	/** The newcomer marked their guide's answer as helpful. */
	private static function pair_ask( $asker, $helper ) {
		$p = self::pair( $asker );
		if ( $p && (int) $p['guide'] === $helper && time() < (int) $p['ends'] ) {
			self::save_pair( self::pair_step( $p, 'ask' ) );
		}
	}

	/** Records that this student studied today; counts days both partners studied. */
	private static function pair_day( $uid ) {
		$today = Sawa_Tracker_Game::today();
		if ( Sawa_Tracker_Game::m( $uid, 'coop_day', '' ) === $today ) {
			return;
		}
		Sawa_Tracker_Game::set( $uid, 'coop_day', $today );
		$pairs = array_filter( array_merge( array( self::pair( $uid ) ), array_map( array( __CLASS__, 'pair' ), self::mentees( $uid ) ) ) );
		foreach ( $pairs as $p ) {
			if ( time() > (int) $p['ends'] ) {
				continue;
			}
			$other = (int) $p['mentee'] === $uid ? (int) $p['guide'] : (int) $p['mentee'];
			if ( Sawa_Tracker_Game::m( $other, 'coop_day', '' ) === $today && ! in_array( $today, $p['days'], true ) ) {
				$p['days'][] = $today;
				if ( count( $p['days'] ) >= 3 ) {
					$p = self::pair_step( $p, 'days' );
				}
				self::save_pair( $p );
			}
		}
	}

	private static function pair_boss( $uid ) {
		$p = self::pair( $uid );
		if ( $p && time() < (int) $p['ends'] + 7 * DAY_IN_SECONDS ) { // a little extra time for the boss
			self::save_pair( self::pair_step( $p, 'boss' ) );
		}
	}

	private static function pair_out( $p, $uid ) {
		$other = (int) $p['mentee'] === $uid ? (int) $p['guide'] : (int) $p['mentee'];
		$pos   = Sawa_Tracker_Game::m( $other, 'wpos', array() );
		$o     = Sawa_Tracker_Game::person( $other );
		return array(
			'role'   => (int) $p['mentee'] === $uid ? 'newcomer' : 'guide',
			'with'   => array( 'id' => $other, 'name' => $o['name'], 'avatar' => $o['avatar'] ?? '', 'town' => Sawa_Tracker_World::TOWNS[ Sawa_Tracker_World::at( $other ) ][0], 'level' => Sawa_Tracker_Hero::level( $other ), 'seen' => is_array( $pos ) ? time() - (int) ( $pos['at'] ?? 0 ) : null ),
			'days'   => count( $p['days'] ),
			'daysLeft' => max( 0, (int) ceil( ( (int) $p['ends'] - time() ) / DAY_IN_SECONDS ) ),
			'steps'  => array_map( function ( $s ) use ( $p ) { return array( 'key' => $s[0], 'text' => $s[1], 'coins' => $s[2], 'done' => in_array( $s[0], $p['done'], true ) ); }, self::PAIR_STEPS ),
		);
	}

	public static function guide( WP_REST_Request $r ) {
		$uid = self::uid();
		$on  = (bool) $r->get_param( 'on' );
		if ( $on && ! self::can_guide( $uid ) ) {
			return new WP_Error( 'coop', 'Guides have beaten two town bosses or reached level 5. Keep going — you will get there!', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Game::set( $uid, 'coop_guide', $on ? 1 : 0 );
		return self::state( $uid );
	}

	/* ------------------------------------------------------------------ state */

	public static function state( $uid ) {
		$help = array();
		$mine = array();
		$new  = 0;
		foreach ( array_reverse( self::asks() ) as $a ) {
			if ( (int) $a['uid'] === $uid ) {
				if ( count( $mine ) < 10 && ( empty( $a['closed'] ) || time() - (int) $a['at'] < 3 * DAY_IN_SECONDS ) ) {
					$o       = self::ask_out( $a, $uid );
					$mine[]  = $o;
					$new    += empty( $a['closed'] ) ? count( array_filter( $o['answers'], function ( $x ) { return ! $x['helped']; } ) ) : 0;
				}
			} elseif ( empty( $a['closed'] ) && ( ! $a['to'] || (int) $a['to'] === $uid ) && time() - (int) $a['at'] < 7 * DAY_IN_SECONDS && count( $help ) < 12 ) {
				$help[] = self::ask_out( $a, $uid );
			}
		}
		// questions sent to you and questions nobody answered yet come first
		usort( $help, function ( $a, $b ) { return array( ! $a['toMe'], $a['answered'], count( $a['answers'] ) > 0, -$a['at'] ) <=> array( ! $b['toMe'], $b['answered'], count( $b['answers'] ) > 0, -$b['at'] ); } );
		$pair    = self::match( $uid );
		$guiding = array();
		foreach ( self::mentees( $uid ) as $m ) {
			$guiding[] = self::pair_out( self::pair( $m ), $uid );
		}
		$todo   = count( array_filter( $help, function ( $a ) { return ! $a['answered']; } ) );
		$thanks = array(); // my answers that helped in the last 3 days (the game shows a thank-you once)
		foreach ( self::asks() as $a ) {
			foreach ( $a['answers'] as $x ) {
				if ( (int) $x['uid'] === $uid && ! empty( $x['helped'] ) && time() - (int) $x['helped'] < 3 * DAY_IN_SECONDS ) {
					$thanks[] = array( 'id' => $x['id'], 'by' => self::first( $a['uid'] ), 'lemma' => $a['lemma'] );
				}
			}
		}
		$c    = self::mine_wk( $uid );
		$calls = array();
		foreach ( array_reverse( self::calls() ) as $cl ) {
			if ( (int) $cl['uid'] !== $uid && empty( $cl['used'] ) && time() < (int) $cl['ends'] && count( $calls ) < 12 ) {
				$calls[] = self::call_out( $cl, $uid );
			}
		}
		usort( $calls, function ( $a, $b ) { return array( $a['helped'] || $a['full'], ! $a['mate'], -$a['at'] ) <=> array( $b['helped'] || $b['full'], ! $b['mate'], -$b['at'] ); } );
		$mine_call = self::my_call( $uid );
		$last      = null;
		foreach ( array_reverse( self::calls() ) as $cl ) {
			if ( (int) $cl['uid'] === $uid ) {
				$last = $cl;
				break;
			}
		}
		return array(
			'calls'   => $calls,
			'myCall'  => $mine_call ? self::call_out( $mine_call, $uid ) : ( $last && time() - (int) $last['at'] < DAY_IN_SECONDS ? self::call_out( $last, $uid ) : null ),
			'helpsLeft' => max( 0, self::HELPS_DAY - self::daily( $uid, 'helps' ) ),
			'role'    => Sawa_Tracker_Combat::role( $uid ),
			'help'    => $help,
			'mine'    => $mine,
			'badge'   => count( array_filter( $calls, function ( $c ) { return $c['mate'] && ! $c['helped'] && ! $c['full']; } ) ) + ( $mine_call && $mine_call['helpers'] ? 1 : 0 ),
			'todo'    => count( array_filter( $calls, function ( $c ) { return ! $c['helped'] && ! $c['full']; } ) ),
			'newAnswers' => $new,
			'project' => self::project(),
			'myWeek'  => array( 'bricks' => (int) ( $c['bricks'] ?? 0 ), 'lanterns' => (int) ( $c['lanterns'] ?? 0 ), 'lessons' => (int) ( $c['lessons'] ?? 0 ), 'donated' => (int) ( $c['donated'] ?? 0 ) ),
			'donate'  => array( 'coins' => self::DONATE_COINS, 'left' => max( 0, self::DONATE_WEEK - (int) ( $c['donated'] ?? 0 ) ) ),
			'helpedAll' => (int) Sawa_Tracker_Game::m( $uid, 'coop_helpedAll', 0 ),
			'thanks'  => array_slice( $thanks, -5 ),
			'pair'    => $pair && time() < (int) $pair['ends'] + 7 * DAY_IN_SECONDS ? self::pair_out( $pair, $uid ) : null,
			'guiding' => $guiding,
			'guide'   => array( 'on' => (bool) Sawa_Tracker_Game::m( $uid, 'coop_guide', 0 ), 'can' => self::can_guide( $uid ) ),
			'limits'  => array( 'asksLeft' => max( 0, self::ASKS_DAY - self::daily( $uid, 'asks' ) ), 'answersLeft' => max( 0, self::ANSWERS_DAY - self::daily( $uid, 'answers' ) ), 'words' => self::ANSWER_WORDS ),
		);
	}

	public static function state_rest() {
		return self::state( self::uid() );
	}
}
