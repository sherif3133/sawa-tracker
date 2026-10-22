<?php
/**
 * The daily reply goal: replying to classmates is what keeps the chat alive, so it earns its own goal.
 *   - A reply counts when it answers someone else: a quoted reply to another student's message, or a message
 *     in a thread where someone else wrote (the starter, or another reply).
 *   - It must be real English: 3+ English words (2 different), or a voice note of 5+ seconds. Stickers and GIFs don't count.
 *   - No farming: the same text twice, more than 4 counted replies to the same person a day, or replies faster
 *     than one every 20 seconds don't count.
 *   - Each counted reply up to the goal: +2 XP (on top of the chat XP). Reaching the goal: +25 XP and 10 coins.
 *   - Every counted reply also moves the weekly "reply" quest on the Silk Road.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Replies {

	const GOAL        = 10;
	const XP          = 2;
	const BONUS_XP    = 25;
	const BONUS_COINS = 10;
	const MIN_WORDS   = 3;
	const MIN_VOICE   = 5;
	const GAP         = 20;
	const PER_PERSON  = 4;

	/** Result for the last message sent: { counted, why, n, goal, done, xp, bonus }, for the send response. */
	public static $last = null;

	public static function init() {
		add_action( 'sawa_tracker_message_sent', array( __CLASS__, 'on_message' ), 20, 5 );
	}

	private static function state( $uid ) {
		$s = get_user_meta( $uid, 'sawa_tr_replies', true );
		$s = is_array( $s ) ? $s : array();
		if ( ( $s['day'] ?? '' ) !== Sawa_Tracker_Game::today() ) {
			$s = array( 'day' => Sawa_Tracker_Game::today(), 'n' => 0, 't' => 0, 'per' => array(), 'h' => array() );
		}
		return $s;
	}

	/** Today's progress, for the chat and the game. */
	public static function goal( $uid ) {
		$s = self::state( $uid );
		return array(
			'n'     => (int) $s['n'],
			'goal'  => self::GOAL,
			'done'  => (int) $s['n'] >= self::GOAL,
			'xp'    => self::XP,
			'bonus' => self::BONUS_XP,
			'coins' => self::BONUS_COINS,
			'min'   => self::MIN_WORDS,
		);
	}

	/** Who this message answers (0 when it isn't a reply to someone). */
	public static function target( $m ) {
		global $wpdb;
		$uid = (int) $m['user_id'];
		if ( ! empty( $m['reply_to'] ) ) {
			$p = Sawa_Tracker_Social::message_row( (int) $m['reply_to'] );
			if ( $p && ! $p['deleted'] ) {
				return (int) $p['user_id'];
			}
		}
		if ( ! empty( $m['thread_id'] ) ) {
			$root = Sawa_Tracker_Social::message_row( (int) $m['thread_id'] );
			if ( $root && (int) $root['user_id'] !== $uid ) {
				return (int) $root['user_id'];
			}
			// Your own thread: answering whoever wrote last before you.
			return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT user_id FROM ' . Sawa_Tracker_Game::table( 'messages' ) . ' WHERE thread_id = %d AND id < %d AND user_id <> %d AND deleted = 0 ORDER BY id DESC LIMIT 1', $m['thread_id'], $m['id'], $uid ) ); // phpcs:ignore
		}
		return 0;
	}

	/** Why a reply doesn't count ('' when it does). */
	private static function check( $m, $s, $to ) {
		if ( '' !== (string) $m['audio'] ) {
			return (int) $m['duration'] >= self::MIN_VOICE ? '' : 'short';
		}
		if ( '' !== (string) $m['kind'] ) {
			return 'sticker';
		}
		$body = (string) $m['body'];
		preg_match_all( "/[A-Za-z]+(?:['’][A-Za-z]+)?/u", $body, $w );
		$words = array_map( 'strtolower', $w[0] );
		if ( count( $words ) < self::MIN_WORDS || count( array_unique( $words ) ) < 2 || preg_match( '/(.)\1{4,}/', implode( '', $words ) ) ) {
			return 'short';
		}
		if ( in_array( self::hash( $body ), $s['h'], true ) ) {
			return 'same';
		}
		if ( time() - (int) $s['t'] < self::GAP ) {
			return 'fast';
		}
		if ( (int) ( $s['per'][ $to ] ?? 0 ) >= self::PER_PERSON ) {
			return 'person';
		}
		return '';
	}

	private static function hash( $body ) {
		return substr( md5( strtolower( preg_replace( '/[^a-z]+/i', '', (string) $body ) ) ), 0, 10 );
	}

	public static function on_message( $uid, $room_id, $msg_id, $body, $audio ) {
		self::$last = null;
		$m          = Sawa_Tracker_Social::message_row( $msg_id );
		$to         = $m ? self::target( $m ) : 0;
		if ( ! $to || $to === (int) $uid ) {
			return; // not a reply, or a reply to yourself
		}
		$s   = self::state( $uid );
		$why = self::check( $m, $s, $to );
		$out = array( 'counted' => false, 'why' => $why, 'xp' => 0, 'bonus' => false );
		if ( '' === $why ) {
			$s['n']++;
			$s['t']          = time();
			$s['per'][ $to ] = (int) ( $s['per'][ $to ] ?? 0 ) + 1;
			if ( '' === (string) $m['audio'] ) {
				$s['h'] = array_slice( array_merge( $s['h'], array( self::hash( $m['body'] ) ) ), -30 );
			}
			update_user_meta( $uid, 'sawa_tr_replies', $s );
			$out['counted'] = true;
			if ( $s['n'] <= self::GOAL ) {
				$out['xp'] = Sawa_Tracker_XP::award( $uid, self::XP, 'reply' );
			}
			if ( self::GOAL === $s['n'] ) {
				$out['xp']   += Sawa_Tracker_XP::award( $uid, self::BONUS_XP, 'replygoal', false );
				$out['bonus'] = true;
				Sawa_Tracker_Raids::add_coins( $uid, self::BONUS_COINS );
			}
			Sawa_Tracker_World::progress( $uid, 'reply' );
		}
		self::$last = $out + self::goal( $uid );
	}
}
