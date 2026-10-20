<?php
/**
 * REST routes for clans, chat, the daily quest and reminders.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Rest_Social {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	private static function route( $path, $method, $cb ) {
		register_rest_route(
			Sawa_Tracker_Rest::NS,
			$path,
			array(
				'methods'             => $method,
				'callback'            => array( __CLASS__, $cb ),
				'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ),
			)
		);
	}

	public static function routes() {
		self::route( '/clan', 'GET', 'clan' );
		self::route( '/chat/rooms', 'GET', 'rooms' );
		self::route( '/chat/rooms/(?P<id>\d+)/messages', 'GET', 'messages' );
		self::route( '/chat/rooms/(?P<id>\d+)/messages', 'POST', 'send' );
		self::route( '/chat/rooms/(?P<id>\d+)/read', 'POST', 'read' );
		self::route( '/chat/groups', 'POST', 'create_group' );
		self::route( '/chat/groups/(?P<id>\d+)/members', 'POST', 'add_members' );
		self::route( '/chat/groups/(?P<id>\d+)/leave', 'POST', 'leave' );
		self::route( '/chat/messages/(?P<id>\d+)/report', 'POST', 'report' );
		self::route( '/chat/messages/(?P<id>\d+)', 'DELETE', 'delete_message' );
		self::route( '/members', 'GET', 'members' );
		self::route( '/quest', 'POST', 'quest' );
		self::route( '/reminder', 'POST', 'reminder' );
	}

	private static function fail( $m, $status = 400 ) {
		return new WP_REST_Response(
			array(
				'ok'      => false,
				'message' => is_wp_error( $m ) ? $m->get_error_message() : $m,
			),
			$status
		);
	}

	private static function uid() {
		return get_current_user_id();
	}

	public static function clan() {
		$uid  = self::uid();
		$clan = Sawa_Tracker_Social::clan_of( $uid );
		return array(
			'clan'      => $clan ? Sawa_Tracker_Social::clan_stats( $clan ) : null,
			'standings' => Sawa_Tracker_Social::standings(),
			'weekStart' => Sawa_Tracker_Game::week_start(),
		);
	}

	public static function rooms() {
		$uid   = self::uid();
		$rooms = Sawa_Tracker_Social::rooms_for( $uid );
		return array(
			'rooms'   => $rooms,
			'unread'  => array_sum( wp_list_pluck( $rooms, 'unread' ) ),
			'enabled' => (bool) Sawa_Tracker_Game::settings()['chat_enabled'],
			'muted'   => (string) Sawa_Tracker_Game::m( $uid, 'muted_until', '' ),
			'admin'   => current_user_can( 'manage_options' ),
		);
	}

	private static function room_or_fail( WP_REST_Request $r ) {
		$room = Sawa_Tracker_Social::room( (int) $r['id'] );
		if ( ! Sawa_Tracker_Social::can_access( self::uid(), $room ) ) {
			return null;
		}
		return $room;
	}

	public static function messages( WP_REST_Request $r ) {
		$room = self::room_or_fail( $r );
		if ( ! $room ) {
			return self::fail( 'You are not in this chat.', 403 );
		}
		$msgs = Sawa_Tracker_Social::messages( (int) $room['id'], (int) $r->get_param( 'after' ), (int) $r->get_param( 'before' ) );
		if ( $msgs && ! $r->get_param( 'before' ) ) {
			Sawa_Tracker_Social::mark_read( self::uid(), (int) $room['id'], end( $msgs )['id'] );
		}
		return array( 'messages' => $msgs );
	}

	public static function send( WP_REST_Request $r ) {
		$uid  = self::uid();
		$room = self::room_or_fail( $r );
		if ( ! $room ) {
			return self::fail( 'You are not in this chat.', 403 );
		}
		$audio = '';
		$files = $r->get_file_params();
		if ( ! empty( $files['audio'] ) ) {
			if ( ! empty( $files['audio']['error'] ) || (int) $files['audio']['size'] > 4 * MB_IN_BYTES ) {
				return self::fail( 'That voice message is too long. Keep it under 2 minutes.' );
			}
			if ( ! preg_match( '~^(audio|video)/~', (string) $files['audio']['type'] ) ) {
				return self::fail( 'Only voice messages can be attached.' );
			}
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
			add_filter( 'upload_mimes', array( __CLASS__, 'mimes' ) );
			add_filter( 'wp_check_filetype_and_ext', array( __CLASS__, 'allow_voice' ), 10, 5 );
			$up = wp_handle_upload( $files['audio'], array( 'test_form' => false ) );
			remove_filter( 'upload_mimes', array( __CLASS__, 'mimes' ) );
			remove_filter( 'wp_check_filetype_and_ext', array( __CLASS__, 'allow_voice' ), 10 );
			if ( empty( $up['url'] ) ) {
				return self::fail( 'The voice message could not be saved: ' . ( $up['error'] ?? 'unknown error' ) );
			}
			$audio = esc_url_raw( $up['url'] );
		}
		$id = Sawa_Tracker_Social::send( $uid, (int) $room['id'], (string) $r->get_param( 'body' ), $audio );
		if ( is_wp_error( $id ) ) {
			return self::fail( $id );
		}
		return array(
			'ok'       => true,
			'messages' => Sawa_Tracker_Social::messages( (int) $room['id'], (int) $r->get_param( 'after' ) ),
		);
	}

	public static function mimes( $m ) {
		$m['webm'] = 'audio/webm';
		$m['weba'] = 'audio/webm';
		$m['m4a']  = 'audio/mp4';
		$m['ogg']  = 'audio/ogg';
		return $m;
	}

	public static function allow_voice( $data, $file, $filename, $mimes, $real = null ) {
		if ( ! empty( $data['ext'] ) && ! empty( $data['type'] ) ) {
			return $data;
		}
		$ft = wp_check_filetype( $filename, $mimes );
		if ( $ft['ext'] && preg_match( '~^audio/~', (string) $ft['type'] ) && ( ! $real || preg_match( '~^(audio|video)/|octet-stream~', (string) $real ) ) ) {
			return array( 'ext' => $ft['ext'], 'type' => $ft['type'], 'proper_filename' => false );
		}
		return $data;
	}

	public static function read( WP_REST_Request $r ) {
		$room = self::room_or_fail( $r );
		if ( $room ) {
			Sawa_Tracker_Social::mark_read( self::uid(), (int) $room['id'], (int) $r->get_param( 'last' ) );
		}
		return array( 'ok' => true );
	}

	public static function create_group( WP_REST_Request $r ) {
		$id = Sawa_Tracker_Social::create_group( self::uid(), (string) $r->get_param( 'name' ), (array) $r->get_param( 'members' ) );
		if ( is_wp_error( $id ) ) {
			return self::fail( $id );
		}
		return array( 'ok' => true, 'room' => $id ) + self::rooms();
	}

	public static function add_members( WP_REST_Request $r ) {
		$res = Sawa_Tracker_Social::add_to_group( self::uid(), (int) $r['id'], (array) $r->get_param( 'members' ) );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + self::rooms();
	}

	public static function leave( WP_REST_Request $r ) {
		$res = Sawa_Tracker_Social::leave_group( self::uid(), (int) $r['id'] );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + self::rooms();
	}

	private static function message_row( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . Sawa_Tracker_Game::table( 'messages' ) . ' WHERE id = %d', $id ), ARRAY_A ); // phpcs:ignore
	}

	public static function report( WP_REST_Request $r ) {
		global $wpdb;
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || ! Sawa_Tracker_Social::can_access( self::uid(), Sawa_Tracker_Social::room( (int) $m['room_id'] ) ) ) {
			return self::fail( 'Message not found.' );
		}
		$wpdb->insert( // phpcs:ignore
			Sawa_Tracker_Game::table( 'reports' ),
			array(
				'message_id'  => (int) $m['id'],
				'reporter_id' => self::uid(),
				'reason'      => mb_substr( sanitize_text_field( (string) $r->get_param( 'reason' ) ), 0, 200 ),
				'created_at'  => Sawa_Tracker_Game::now_mysql(),
			)
		);
		if ( Sawa_Tracker_Game::settings()['notify_admin'] ) {
			wp_mail( get_option( 'admin_email' ), 'Sawa Tracker: a chat message was reported', "A student reported a chat message.\n\nReview it here:\n" . admin_url( 'admin.php?page=sawa-tracker&tab=moderation' ) );
		}
		return array( 'ok' => true );
	}

	public static function delete_message( WP_REST_Request $r ) {
		global $wpdb;
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || ( (int) $m['user_id'] !== self::uid() && ! current_user_can( 'manage_options' ) ) ) {
			return self::fail( 'You can only delete your own messages.' );
		}
		$wpdb->update( Sawa_Tracker_Game::table( 'messages' ), array( 'deleted' => 1 ), array( 'id' => (int) $m['id'] ) ); // phpcs:ignore
		return array( 'ok' => true );
	}

	public static function members( WP_REST_Request $r ) {
		$q   = mb_strtolower( trim( (string) $r->get_param( 'q' ) ) );
		$out = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $id ) {
			if ( $id === self::uid() ) {
				continue;
			}
			$p = Sawa_Tracker_Game::person( $id );
			if ( '' === $q || false !== mb_strpos( mb_strtolower( $p['name'] ), $q ) ) {
				$out[] = $p;
			}
			if ( count( $out ) >= 20 ) {
				break;
			}
		}
		return array( 'members' => $out );
	}

	public static function quest( WP_REST_Request $r ) {
		$res = Sawa_Tracker_Social::complete_quest( self::uid(), (string) $r->get_param( 'note' ) );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true, 'sp' => $res, 'data' => Sawa_Tracker_Rest::me_data( self::uid() ) );
	}

	public static function reminder( WP_REST_Request $r ) {
		$h = $r->get_param( 'hour' );
		if ( '' === $h || null === $h || (int) $h < 0 ) {
			delete_user_meta( self::uid(), 'sawa_remind_hour' );
		} else {
			Sawa_Tracker_Game::set( self::uid(), 'remind_hour', (string) min( 23, (int) $h ) );
		}
		return array( 'ok' => true, 'data' => Sawa_Tracker_Rest::me_data( self::uid() ) );
	}
}
