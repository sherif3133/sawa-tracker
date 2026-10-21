<?php
/**
 * The walkable Silk Road: what the game client needs on top of Sawa_Tracker_World.
 *
 * Students study at different times, so every social feature works whether others are online or not:
 * - Look: each student's character (skin, hair, outfit), drawn by the game; gear and job come from the RPG.
 * - Sync: every few seconds the game sends where you stand and gets who is in the same town. Students seen in
 *   the last minute walk around live; students seen in the last 24 hours stand where they left as "echoes"
 *   you can still tap (profile, party invite, shadow duel).
 * - Notes: short English notes left on the map for whoever comes later; a "helpful" from a reader pays the
 *   author a few coins.
 * - Shadow duels: fight another student's shadow any time — its strength comes from that student's real
 *   accuracy in recent battles. Nobody loses coins; the other student gets a notification.
 * - Emotes and the town chat appear as bubbles over characters.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Play {

	const LIVE_SECS   = 60;
	const ECHO_SECS   = DAY_IN_SECONDS;
	const EMOTES      = array( 'wave', 'cheer', 'clap', 'heart', 'laugh', 'bow' );
	const NOTES_DAY   = 3;
	const NOTES_TOWN  = 40;
	const DUELS_DAY   = 3;
	const NOTE_COINS  = 2;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		$routes = array(
			array( '/play/look', 'POST', 'set_look' ),
			array( '/play/sync', 'POST', 'sync' ),
			array( '/play/emote', 'POST', 'emote' ),
			array( '/play/notes', 'GET', 'notes' ),
			array( '/play/notes', 'POST', 'add_note' ),
			array( '/play/notes/like', 'POST', 'like_note' ),
			array( '/play/notes/delete', 'POST', 'delete_note' ),
			array( '/play/duel', 'POST', 'duel' ),
			array( '/play/profile', 'GET', 'profile' ),
		);
		foreach ( $routes as $r ) {
			register_rest_route( Sawa_Tracker_Rest::NS, $r[0], array( 'methods' => $r[1], 'callback' => array( __CLASS__, $r[2] ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
		}
	}

	private static function uid() {
		return get_current_user_id();
	}

	/* ------------------------------------------------------------------ look */

	/** Skin 0–4, hair style 0–3, hair colour 0–5, outfit colour 0–5. Defaults come from the user id. */
	public static function look( $uid ) {
		$l = Sawa_Tracker_Game::m( $uid, 'look', array() );
		$h = crc32( 'look' . $uid );
		$d = array( 'skin' => $h % 5, 'hair' => ( $h >> 4 ) % 4, 'hairc' => ( $h >> 8 ) % 6, 'outfit' => ( $h >> 12 ) % 6, 'set' => false );
		return is_array( $l ) ? array_merge( $d, array_intersect_key( $l, $d ) ) : $d;
	}

	public static function set_look( WP_REST_Request $r ) {
		$uid = self::uid();
		$max = array( 'skin' => 5, 'hair' => 4, 'hairc' => 6, 'outfit' => 6 );
		$l   = array( 'set' => true );
		foreach ( $max as $k => $m ) {
			$l[ $k ] = max( 0, min( $m - 1, (int) $r->get_param( $k ) ) );
		}
		Sawa_Tracker_Game::set( $uid, 'look', $l );
		return array( 'look' => self::look( $uid ) );
	}

	/** What the game draws for a student: look, job, gear grades, title. */
	public static function avatar( $uid ) {
		$rpg = Sawa_Tracker_RPG::get( $uid );
		$w   = Sawa_Tracker_World::get( $uid );
		$p   = Sawa_Tracker_Game::person( $uid );
		return array(
			'id'     => (int) $uid,
			'name'   => $p['name'],
			'photo'  => $p['avatar'] ?? '',
			'look'   => self::look( $uid ),
			'job'    => $rpg['job'],
			'weapon' => (int) ( $rpg['gear']['weapon']['grade'] ?? 0 ),
			'armor'  => (int) ( $rpg['gear']['armor']['grade'] ?? 0 ),
			'title'  => (string) ( end( $w['titles'] ) ? end( $w['titles'] ) : '' ),
			'level'  => Sawa_Tracker_World::TOWNS[ min( 6, $w['reached'] ) ][2],
			'hero'   => array_intersect_key( Sawa_Tracker_Hero::sheet( $uid ), array_flip( array( 'level', 'title', 'rank', 'aura', 'hp', 'hpMax' ) ) ),
		);
	}

	/* ------------------------------------------------------------------ presence */

	/** Thieves wanted right now (cached for 30 seconds). */
	private static function wanted_ids() {
		$ids = get_transient( 'sawa_tr_wanted_ids' );
		if ( ! is_array( $ids ) ) {
			$ids = array_values( array_unique( array_map( function ( $w ) { return (int) $w['thief']['id']; }, Sawa_Tracker_Raids::wanted_list( 0 ) ) ) );
			set_transient( 'sawa_tr_wanted_ids', $ids, 30 );
		}
		return $ids;
	}

	public static function sync( WP_REST_Request $r ) {
		global $wpdb;
		$uid  = self::uid();
		$town = Sawa_Tracker_World::at( $uid );
		$me   = Sawa_Tracker_Game::m( $uid, 'wpos', array() );
		$me   = is_array( $me ) ? $me : array();
		$pos  = array(
			't'   => $town,
			'x'   => max( 0, min( 4000, (int) $r->get_param( 'x' ) ) ),
			'y'   => max( 0, min( 4000, (int) $r->get_param( 'y' ) ) ),
			'd'   => max( 0, min( 3, (int) $r->get_param( 'd' ) ) ),
			'at'  => time(),
			'em'  => $me['em'] ?? '',
			'emt' => (int) ( $me['emt'] ?? 0 ),
		);
		Sawa_Tracker_Game::set( $uid, 'wpos', $pos );
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = %s AND user_id <> %d", 'sawa_wpos', $uid ), ARRAY_A ); // phpcs:ignore
		$wanted = self::wanted_ids();
		$live   = array();
		$echo   = array();
		foreach ( (array) $rows as $row ) {
			$p = maybe_unserialize( $row['meta_value'] );
			if ( ! is_array( $p ) || (int) ( $p['t'] ?? 0 ) !== $town || time() - (int) $p['at'] > self::ECHO_SECS || ! Sawa_Tracker_Game::is_member( (int) $row['user_id'] ) ) {
				continue;
			}
			$a = self::avatar( (int) $row['user_id'] ) + array(
				'x'      => (int) $p['x'],
				'y'      => (int) $p['y'],
				'd'      => (int) $p['d'],
				'ago'    => time() - (int) $p['at'],
				'wanted' => in_array( (int) $row['user_id'], $wanted, true ),
				'emote'  => time() - (int) ( $p['emt'] ?? 0 ) < 8 ? (string) $p['em'] : '',
			);
			if ( $a['ago'] <= self::LIVE_SECS ) {
				$live[] = $a;
			} else {
				$echo[] = $a;
			}
		}
		usort( $echo, function ( $a, $b ) { return $a['ago'] <=> $b['ago']; } );
		// The town chat: messages from the last 30 seconds become bubbles over the speakers.
		$room    = Sawa_Tracker_World::town_room( $town );
		$bubbles = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT id, user_id, body FROM ' . Sawa_Tracker_Social::t( 'messages' ) . " WHERE room_id = %d AND deleted = 0 AND body <> '' AND created_at >= %s ORDER BY id DESC LIMIT 12", $room, gmdate( 'Y-m-d H:i:s', time() - 30 + (int) ( get_option( 'gmt_offset' ) * HOUR_IN_SECONDS ) ) ), ARRAY_A ) as $m ) { // phpcs:ignore
			$bubbles[] = array( 'id' => (int) $m['id'], 'user' => (int) $m['user_id'], 'text' => wp_trim_words( (string) $m['body'], 14, '…' ) );
		}
		return array(
			'town'    => $town,
			'live'    => array_slice( $live, 0, 40 ),
			'echoes'  => array_slice( $echo, 0, 15 ),
			'bubbles' => $bubbles,
			'room'    => $room,
			'now'     => time(),
		);
	}

	public static function emote( WP_REST_Request $r ) {
		$uid = self::uid();
		$e   = (string) $r->get_param( 'e' );
		if ( ! in_array( $e, self::EMOTES, true ) ) {
			return new WP_Error( 'emote', 'Unknown emote.', array( 'status' => 400 ) );
		}
		$p        = Sawa_Tracker_Game::m( $uid, 'wpos', array() );
		$p        = is_array( $p ) ? $p : array( 't' => Sawa_Tracker_World::at( $uid ), 'x' => 0, 'y' => 0, 'd' => 0, 'at' => time() );
		$p['em']  = $e;
		$p['emt'] = time();
		Sawa_Tracker_Game::set( $uid, 'wpos', $p );
		return array( 'ok' => true );
	}

	/** A student's card when you tap them in the world. */
	public static function profile( WP_REST_Request $r ) {
		$id = (int) $r->get_param( 'user' );
		if ( ! Sawa_Tracker_Game::is_member( $id ) ) {
			return new WP_Error( 'user', 'Not found.', array( 'status' => 404 ) );
		}
		$acc = self::accuracy( $id );
		$w   = Sawa_Tracker_World::get( $id );
		return self::avatar( $id ) + array(
			'titles'   => array_values( (array) $w['titles'] ),
			'accuracy' => $acc['n'] >= 5 ? (int) round( 100 * $acc['r'] / $acc['n'] ) : null,
			'party'    => (bool) Sawa_Tracker_Party::of( $id ),
			'clan'     => Sawa_Tracker_Social::clan_of( $id ) === Sawa_Tracker_Social::clan_of( self::uid() ) && Sawa_Tracker_Social::clan_of( $id ),
			'duelsLeft' => self::duels_left( self::uid() ),
		);
	}

	/* ------------------------------------------------------------------ notes */

	private static function notes_key( $t ) {
		return 'sawa_tr_notes_' . (int) $t;
	}

	private static function notes_out( $t, $uid ) {
		$out = array();
		foreach ( (array) get_option( self::notes_key( $t ), array() ) as $n ) {
			$out[] = array(
				'id'    => $n['id'],
				'x'     => (int) $n['x'],
				'y'     => (int) $n['y'],
				'text'  => $n['text'],
				'by'    => Sawa_Tracker_Game::person( (int) $n['uid'] )['name'],
				'mine'  => (int) $n['uid'] === $uid,
				'likes' => count( (array) $n['likes'] ),
				'liked' => in_array( $uid, (array) $n['likes'], true ),
				'at'    => (int) $n['at'],
			);
		}
		return $out;
	}

	public static function notes() {
		$uid = self::uid();
		return array( 'notes' => self::notes_out( Sawa_Tracker_World::at( $uid ), $uid ) );
	}

	public static function add_note( WP_REST_Request $r ) {
		$uid  = self::uid();
		$t    = Sawa_Tracker_World::at( $uid );
		$text = trim( preg_replace( '/\s+/u', ' ', sanitize_text_field( (string) $r->get_param( 'text' ) ) ) );
		if ( preg_match( '/[\x{0600}-\x{06FF}]/u', $text ) ) {
			return new WP_Error( 'note', 'Notes are in English. Use the Chat tab if you want help translating.', array( 'status' => 400 ) );
		}
		if ( count( preg_split( '/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY ) ) < 3 || mb_strlen( $text ) > 140 ) {
			return new WP_Error( 'note', 'Write 3 or more English words (up to 140 characters).', array( 'status' => 400 ) );
		}
		$day = Sawa_Tracker_Game::m( $uid, 'notes_day', array() );
		$n   = is_array( $day ) && ( $day['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $day['n'] : 0;
		if ( $n >= self::NOTES_DAY ) {
			return new WP_Error( 'note', 'You can leave 3 notes a day.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Game::set( $uid, 'notes_day', array( 'day' => Sawa_Tracker_Game::today(), 'n' => $n + 1 ) );
		$list   = (array) get_option( self::notes_key( $t ), array() );
		$list[] = array( 'id' => wp_generate_password( 10, false ), 'uid' => $uid, 'x' => (int) $r->get_param( 'x' ), 'y' => (int) $r->get_param( 'y' ), 'text' => Sawa_Tracker_Social::filter_words( $text ), 'likes' => array(), 'at' => time() );
		update_option( self::notes_key( $t ), array_slice( $list, -self::NOTES_TOWN ), false );
		Sawa_Tracker_World::progress( $uid, 'use' );
		return array( 'notes' => self::notes_out( $t, $uid ) );
	}

	private static function edit_note( $uid, $id, $fn ) {
		$t    = Sawa_Tracker_World::at( $uid );
		$list = (array) get_option( self::notes_key( $t ), array() );
		foreach ( $list as $i => $n ) {
			if ( $n['id'] === $id ) {
				$res = $fn( $list, $i, $n );
				if ( is_wp_error( $res ) ) {
					return $res;
				}
				update_option( self::notes_key( $t ), array_values( $res ), false );
				return array( 'notes' => self::notes_out( $t, $uid ) );
			}
		}
		return new WP_Error( 'note', 'This note is gone.', array( 'status' => 404 ) );
	}

	public static function like_note( WP_REST_Request $r ) {
		$uid = self::uid();
		return self::edit_note(
			$uid,
			(string) $r->get_param( 'id' ),
			function ( $list, $i, $n ) use ( $uid ) {
				if ( (int) $n['uid'] === $uid || in_array( $uid, (array) $n['likes'], true ) ) {
					return $list;
				}
				$list[ $i ]['likes'][] = $uid;
				$c = Sawa_Tracker_Game::m( (int) $n['uid'], 'note_coins', array() );
				$k = is_array( $c ) && ( $c['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $c['n'] : 0;
				if ( $k < 5 ) { // up to 10 coins a day from helpful notes
					Sawa_Tracker_Game::set( (int) $n['uid'], 'note_coins', array( 'day' => Sawa_Tracker_Game::today(), 'n' => $k + 1 ) );
					Sawa_Tracker_Raids::add_coins( (int) $n['uid'], self::NOTE_COINS );
				}
				return $list;
			}
		);
	}

	public static function delete_note( WP_REST_Request $r ) {
		$uid = self::uid();
		return self::edit_note(
			$uid,
			(string) $r->get_param( 'id' ),
			function ( $list, $i, $n ) use ( $uid ) {
				if ( (int) $n['uid'] !== $uid && ! user_can( $uid, 'manage_options' ) ) {
					return new WP_Error( 'note', 'You can only remove your own notes.', array( 'status' => 403 ) );
				}
				unset( $list[ $i ] );
				return $list;
			}
		);
	}

	/* ------------------------------------------------------------------ shadow duels */

	/** Right answers / questions in recent battles (old battles fade out). */
	public static function accuracy( $uid ) {
		$a = Sawa_Tracker_Game::m( $uid, 'acc', array() );
		return is_array( $a ) ? $a + array( 'r' => 0, 'n' => 0 ) : array( 'r' => 0, 'n' => 0 );
	}

	public static function record_accuracy( $uid, $right, $total ) {
		$a = self::accuracy( $uid );
		$a = array( 'r' => $a['r'] + $right, 'n' => $a['n'] + $total );
		if ( $a['n'] > 60 ) {
			$a = array( 'r' => $a['r'] * 0.8, 'n' => $a['n'] * 0.8 );
		}
		Sawa_Tracker_Game::set( $uid, 'acc', $a );
	}

	private static function duels_left( $uid ) {
		$d = Sawa_Tracker_Game::m( $uid, 'duels', array() );
		return self::DUELS_DAY - ( is_array( $d ) && ( $d['day'] ?? '' ) === Sawa_Tracker_Game::today() ? count( (array) $d['vs'] ) : 0 );
	}

	public static function duel( WP_REST_Request $r ) {
		$uid = self::uid();
		$vs  = (int) $r->get_param( 'user' );
		if ( $vs === $uid || ! Sawa_Tracker_Game::is_member( $vs ) ) {
			return new WP_Error( 'duel', 'Choose another student.', array( 'status' => 400 ) );
		}
		$d = Sawa_Tracker_Game::m( $uid, 'duels', array() );
		$d = is_array( $d ) && ( $d['day'] ?? '' ) === Sawa_Tracker_Game::today() ? $d : array( 'day' => Sawa_Tracker_Game::today(), 'vs' => array() );
		if ( count( $d['vs'] ) >= self::DUELS_DAY ) {
			return new WP_Error( 'duel', 'You had 3 duels today. Come back tomorrow!', array( 'status' => 400 ) );
		}
		if ( in_array( $vs, $d['vs'], true ) ) {
			return new WP_Error( 'duel', 'You already dueled this student today.', array( 'status' => 400 ) );
		}
		$qs = apply_filters( 'sawa_tracker_battle_questions', array(), $uid, 7, array() ); // fair: grammar at your own level
		if ( count( $qs ) < 5 ) {
			return new WP_Error( 'battle', 'Battles are not ready yet.', array( 'status' => 503 ) );
		}
		$d['vs'][] = $vs;
		Sawa_Tracker_Game::set( $uid, 'duels', $d );
		$acc    = self::accuracy( $vs );
		$rate   = $acc['n'] >= 5 ? $acc['r'] / $acc['n'] : 0.5;
		$shadow = (int) round( $rate * 5 * 20 * ( 1 + Sawa_Tracker_RPG::slot_bonus( Sawa_Tracker_RPG::get( $vs ), 'weapon' ) ) * ( wp_rand( 92, 108 ) / 100 ) );
		$shadow = max( 30, $shadow );
		$name   = Sawa_Tracker_Game::person( $vs )['name'];
		return Sawa_Tracker_World::battle_start( $uid, 'duel', $qs, array( 'name' => $name . '\'s shadow', 'icon' => '👤', 'hp' => $shadow + 20, 'atk' => (int) round( 8 + 14 * $rate ), 'shadow' => true, 'user' => $vs, 'avatar' => self::avatar( $vs ) ), array( 'vs' => $vs, 'shadow' => $shadow ) );
	}

	public static function after_duel( $uid, $b, $won, $right ) {
		$vs  = (int) $b['meta']['vs'];
		$d   = Sawa_Tracker_Hero::duel_result( $uid, $vs, $won );
		$c   = Sawa_Tracker_Raids::add_coins( $uid, $won ? 8 : 2 ); // new coins: nobody loses any
		Sawa_Tracker_Game::event( $uid, 'duel', $vs, array( 'won' => $won, 'right' => $right ) );
		return array( 'won' => $won, 'coins' => $c, 'shadow' => (int) $b['meta']['shadow'], 'rating' => $d, 'rank' => Sawa_Tracker_Hero::sheet( $uid )['rank'] );
	}
}
