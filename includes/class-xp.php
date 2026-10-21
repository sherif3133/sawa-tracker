<?php
/**
 * English XP: points for using English in the community, separate from the study skill points (SP).
 *   - Chat: 1 XP per English word (max 25 a message, +3 for a full sentence); voice notes 5 + 1 per 10 seconds.
 *   - Writing checker (Sawa Lens): half a point per word, max 50 a check.
 *   - Improvement bonuses (Sawa Lens): correct use of a point you got wrong recently, mastering a skill.
 * Repeated text, mostly-Arabic text and stickers earn nothing; translated messages earn 30%.
 * Base XP is capped per day; improvement bonuses are not.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_XP {

	const DAILY_CAP = 400;

	/** XP the last chat message earned, so the send response can show "+12 XP". */
	public static $last = 0;

	public static function init() {
		add_action( 'sawa_tracker_message_sent', array( __CLASS__, 'on_message' ), 10, 5 );
	}

	private static function log( $uid ) {
		$l = get_user_meta( $uid, 'sawa_tr_xp_log', true );
		return is_array( $l ) ? $l : array();
	}

	public static function total( $uid ) {
		return (int) get_user_meta( $uid, 'sawa_tr_xp', true );
	}

	/** Adds XP. $capped: counts toward the daily cap. Returns the XP actually given. */
	public static function award( $uid, $n, $reason, $capped = true ) {
		$n = (int) $n;
		if ( $n <= 0 || ! $uid ) {
			return 0;
		}
		$day = Sawa_Tracker_Game::today();
		$log = self::log( $uid );
		$d   = $log[ $day ] ?? array( 'base' => 0, 'bonus' => 0, 'why' => array() );
		if ( $capped ) {
			$n          = max( 0, min( $n, self::DAILY_CAP - (int) $d['base'] ) );
			$d['base'] += $n;
		} else {
			$d['bonus'] += $n;
		}
		if ( ! $n ) {
			return 0;
		}
		$key              = sanitize_key( strtok( (string) $reason, ':' ) );
		$d['why'][ $key ] = (int) ( $d['why'][ $key ] ?? 0 ) + $n;
		$log[ $day ]      = $d;
		ksort( $log );
		update_user_meta( $uid, 'sawa_tr_xp_log', array_slice( $log, -60, null, true ) );
		update_user_meta( $uid, 'sawa_tr_xp', self::total( $uid ) + $n );
		delete_transient( 'sawa_tr_board_xp' );
		return $n;
	}

	public static function on_message( $uid, $room_id, $msg_id, $body, $audio ) {
		self::$last = 0;
		$m = Sawa_Tracker_Social::message_row( $msg_id );
		if ( ! $m ) {
			return;
		}
		if ( '' !== (string) $audio ) {
			self::$last = self::award( $uid, 5 + intdiv( (int) $m['duration'], 10 ), 'voice' );
			self::study( $uid, max( 1, (int) $m['duration'] / 30 ) );
			return;
		}
		$body = (string) $m['body'];
		if ( '' === trim( $body ) || Sawa_Tracker_Social::arabic_share( $body ) > 0.3 ) {
			return;
		}
		$words = preg_match_all( "/[A-Za-z]+(?:['’][A-Za-z]+)?/u", $body );
		if ( ! $words ) {
			return;
		}
		// Copy-paste / repeated messages earn nothing.
		$norm   = strtolower( preg_replace( '/[^a-z]+/i', '', $body ) );
		$hashes = (array) get_user_meta( $uid, 'sawa_tr_xp_seen', true );
		$h      = substr( md5( $norm ), 0, 12 );
		if ( in_array( $h, $hashes, true ) || preg_match( '/(.)\1{5,}/', $norm ) ) {
			return;
		}
		$hashes[] = $h;
		update_user_meta( $uid, 'sawa_tr_xp_seen', array_slice( $hashes, -40 ) );
		$xp = min( 25, $words ) + ( $words >= 5 && preg_match( '/[.!?]\s*$/', trim( $body ) ) ? 3 : 0 );
		if ( '' !== (string) ( $m['orig'] ?? '' ) ) {
			$xp = (int) max( 1, round( $xp * 0.3 ) ); // translated from Arabic
		}
		self::$last = self::award( $uid, $xp, 'chat' );
		self::study( $uid, $words / 15 );
	}

	/** Speaking and writing English in the chat counts as study time (via Sawa Lens' automatic study log). */
	private static function study( $uid, $minutes ) {
		if ( class_exists( 'Sawa_Lens_Activity' ) ) {
			Sawa_Lens_Activity::add( $uid, '', 1, 'Others', $minutes );
		}
	}

	/** Level from total XP: level n needs 100 × (1 + 2 + … + (n−1)) XP. */
	public static function level( $total ) {
		$lv = 1;
		while ( 50 * $lv * ( $lv + 1 ) <= $total ) {
			$lv++;
		}
		return array(
			'level' => $lv,
			'from'  => 50 * ( $lv - 1 ) * $lv,
			'to'    => 50 * $lv * ( $lv + 1 ),
		);
	}

	public static function week( $uid ) {
		$from = Sawa_Tracker_Game::week_start();
		$n    = 0;
		foreach ( self::log( $uid ) as $day => $d ) {
			if ( $day >= $from ) {
				$n += (int) $d['base'] + (int) $d['bonus'];
			}
		}
		return $n;
	}

	/** For the dashboard. */
	public static function summary( $uid ) {
		$total = self::total( $uid );
		$log   = self::log( $uid );
		$today = $log[ Sawa_Tracker_Game::today() ] ?? array( 'base' => 0, 'bonus' => 0, 'why' => array() );
		$days  = array();
		for ( $i = 13; $i >= 0; $i-- ) {
			$k      = Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -$i );
			$days[] = (int) ( ( $log[ $k ]['base'] ?? 0 ) + ( $log[ $k ]['bonus'] ?? 0 ) );
		}
		return array(
			'total' => $total,
			'today' => (int) $today['base'] + (int) $today['bonus'],
			'base'  => (int) $today['base'],
			'cap'   => self::DAILY_CAP,
			'why'   => $today['why'],
			'week'  => self::week( $uid ),
			'days'  => $days,
		) + self::level( $total );
	}
}
