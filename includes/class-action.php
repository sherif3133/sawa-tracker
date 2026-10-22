<?php
/**
 * Action fights against the roaming monsters: the battle starts as usual (/world/fight: stamina, the student's own
 * words as questions), but it is played as an action game in game.js (dodge, timed hits, combos, a role move).
 * English is the "power word" (about 20%): a question now and then; right fires the ultimate, wrong costs nothing.
 * /world/power grades one power word, /world/action reports how the fight went, then /world/answer gives the rewards
 * exactly like a quiz fight (coins, XP, missed words back in today's review).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Action {

	const MIN_SECS = 8; // a win needs at least this long a fight

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		foreach ( array( array( '/world/power', 'power' ), array( '/world/action', 'report' ) ) as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => 'POST', 'callback' => array( __CLASS__, $r[1] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	private static function battle( WP_REST_Request $r ) {
		$key = 'sawa_tr_wb_' . sanitize_key( (string) $r->get_param( 'battle' ) );
		$b   = get_transient( $key );
		return is_array( $b ) && (int) $b['uid'] === get_current_user_id() && 'monster' === $b['kind'] ? array( $key, $b ) : array( $key, null );
	}

	private static function norm( $s ) {
		return trim( preg_replace( '/\s+/', ' ', strtolower( preg_replace( "/[^\\p{L}\\p{N}'\\s]/u", '', (string) $s ) ) ) );
	}

	/** One power word (the questions come in order). No damage either way: the game fires the ultimate on a right answer. */
	public static function power( WP_REST_Request $r ) {
		list( $key, $b ) = self::battle( $r );
		if ( ! $b || $b['st']['done'] ) {
			return new WP_Error( 'battle', 'This fight has ended.', array( 'status' => 404 ) );
		}
		$i = count( $b['st']['picks'] );
		if ( (int) $r->get_param( 'i' ) !== $i || ! isset( $b['qs'][ $i ] ) ) {
			return new WP_Error( 'battle', 'Answer the power words in order.', array( 'status' => 400 ) );
		}
		$q = $b['qs'][ $i ];
		if ( in_array( $q['type'], array( 'type', 'order' ), true ) ) {
			$correct = '' !== trim( (string) $r->get_param( 'text' ) ) && self::norm( $r->get_param( 'text' ) ) === self::norm( $q['text'] );
			$right   = $q['text'];
		} else {
			$correct = (int) $r->get_param( 'choice' ) === (int) $q['answer'];
			$right   = $q['options'][ $q['answer'] ] ?? '';
		}
		$b['st']['picks'][] = $correct ? 1 : 0;
		if ( $correct ) {
			++$b['st']['right'];
		}
		set_transient( $key, $b, 20 * MINUTE_IN_SECONDS );
		return array( 'correct' => $correct, 'right' => $right, 'why' => $q['why'] ?? '' );
	}

	/** How the action fight went (worked out in the game). Then /world/answer gives the rewards. */
	public static function report( WP_REST_Request $r ) {
		list( $key, $b ) = self::battle( $r );
		if ( ! $b || $b['st']['done'] ) {
			return new WP_Error( 'battle', 'This fight has ended.', array( 'status' => 404 ) );
		}
		$won = (bool) $r->get_param( 'won' ) && time() - (int) $b['t'] >= self::MIN_SECS;
		$hp  = max( empty( $b['me']['noKo'] ) ? 0 : 1, min( (int) $b['me']['hpMax'], (int) $r->get_param( 'hp' ) ) );
		$b['foe']['hp']      = $won ? 0 : max( 1, (int) $b['foe']['hp'] - (int) $r->get_param( 'dealt' ) );
		$b['me']['hp']       = $won ? max( 1, $hp ) : $hp;
		$b['st']['dealt']    = max( 0, min( 2 * (int) $b['foe']['hpMax'], (int) $r->get_param( 'dealt' ) ) );
		$b['st']['taken']    = max( 0, (int) $b['me']['hpMax'] - $hp );
		$b['st']['best']     = max( 0, min( 99, (int) $r->get_param( 'best' ) ) );
		$b['st']['done']     = true;
		$b['meta']['action'] = true;
		set_transient( $key, $b, 20 * MINUTE_IN_SECONDS );
		return array( 'ok' => true, 'won' => $won );
	}
}
