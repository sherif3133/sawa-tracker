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
		self::route( '/chat/messages/(?P<id>\d+)/transcript', 'POST', 'transcript' );
		self::route( '/chat/messages/(?P<id>\d+)/feedback', 'POST', 'feedback' );
		self::route( '/chat/messages/(?P<id>\d+)/react', 'POST', 'react' );
		self::route( '/chat/gifs', 'GET', 'gifs' );
		self::route( '/chat/translate', 'POST', 'translate' );
		self::route( '/chat/messages/(?P<id>\d+)', 'DELETE', 'delete_message' );
		self::route( '/chat/threads/(?P<id>\d+)', 'GET', 'thread' );
		self::route( '/chat/threads/(?P<id>\d+)', 'POST', 'thread_send' );
		self::route( '/chat/threads/(?P<id>\d+)/follow', 'POST', 'thread_follow' );
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
		$uid     = self::uid();
		$rooms   = Sawa_Tracker_Social::rooms_for( $uid );
		$threads = Sawa_Tracker_Social::thread_inbox( $uid );
		return array(
			'rooms'   => $rooms,
			'unread'  => array_sum( wp_list_pluck( $rooms, 'unread' ) ) + array_sum( wp_list_pluck( $threads, 'unread' ) ),
			'threads' => $threads,
			'replyGoal' => Sawa_Tracker_Replies::goal( $uid ),
			'enabled' => (bool) Sawa_Tracker_Game::settings()['chat_enabled'],
			'muted'   => (string) Sawa_Tracker_Game::m( $uid, 'muted_until', '' ),
			'admin'   => current_user_can( 'manage_options' ),
			'maxRow'  => (int) ( Sawa_Tracker_Game::settings()['chat_max_row'] ?? 5 ),
			'gifs'    => '' !== (string) ( Sawa_Tracker_Game::settings()['giphy_key'] ?? '' ),
			'stickers' => Sawa_Tracker_Social::STICKERS,
			'reacts'  => Sawa_Tracker_Social::REACTS,
			// Transcripts and feedback come from the Sawa Lens plugin when it's set up.
			'ai'      => (array) apply_filters( 'sawa_tracker_chat_ai', array( 'transcribe' => false, 'feedback' => false, 'translate' => false ), $uid ),
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
			return self::fail( 'إنت مش في الشات ده.', 403 );
		}
		$msgs = Sawa_Tracker_Social::messages( (int) $room['id'], (int) $r->get_param( 'after' ), (int) $r->get_param( 'before' ) );
		if ( $msgs && ! $r->get_param( 'before' ) ) {
			Sawa_Tracker_Social::mark_read( self::uid(), (int) $room['id'], end( $msgs )['id'] );
		}
		$first = $msgs ? (int) $msgs[0]['id'] : 0;
		if ( $r->get_param( 'after' ) ) {
			$first = max( 0, (int) $r->get_param( 'after' ) - 400 );
		}
		return array(
			'messages' => $msgs,
			'reacts'   => Sawa_Tracker_Social::reactions( (int) $room['id'], self::uid(), $first ),
			'threads'  => Sawa_Tracker_Social::thread_meta( (int) $room['id'], self::uid(), $first ),
		);
	}

	/** A thread: the message it started from and its replies (?after= for new ones). Opening it marks it read. */
	public static function thread( WP_REST_Request $r ) {
		$uid  = self::uid();
		$root = Sawa_Tracker_Social::thread_root( $uid, (int) $r['id'] );
		if ( ! $root ) {
			return self::fail( 'ملقيناش الثريد ده.', 404 );
		}
		$after = (int) $r->get_param( 'after' );
		$msgs  = Sawa_Tracker_Social::thread_messages( (int) $root['id'], $after );
		if ( $msgs ) {
			Sawa_Tracker_Social::read_thread( $uid, (int) $root['id'], end( $msgs )['id'] );
		}
		return array(
			'root'      => Sawa_Tracker_Social::message_out( $root ),
			'room'      => (int) $root['room_id'],
			'messages'  => $msgs,
			'reacts'    => Sawa_Tracker_Social::reactions( (int) $root['room_id'], $uid, (int) $root['id'], (int) $root['id'] ),
			'following' => Sawa_Tracker_Social::thread_following( $uid, (int) $root['id'] ),
			'replyGoal' => Sawa_Tracker_Replies::goal( $uid ),
		);
	}

	public static function thread_send( WP_REST_Request $r ) {
		$uid  = self::uid();
		$root = Sawa_Tracker_Social::thread_root( $uid, (int) $r['id'] );
		if ( ! $root ) {
			return self::fail( 'ملقيناش الثريد ده.', 404 );
		}
		$id = Sawa_Tracker_Social::send( $uid, (int) $root['room_id'], (string) $r->get_param( 'body' ), '', (int) $r->get_param( 'reply_to' ), 0, (string) $r->get_param( 'kind' ), (string) $r->get_param( 'media' ), (string) $r->get_param( 'orig' ), (int) $root['id'], (array) $r->get_param( 'mentions' ) );
		if ( is_wp_error( $id ) ) {
			return self::fail( $id );
		}
		return array(
			'ok'        => true,
			'xp'        => Sawa_Tracker_XP::$last,
			'reply'     => Sawa_Tracker_Replies::$last,
			'replyGoal' => Sawa_Tracker_Replies::goal( $uid ),
			'messages'  => Sawa_Tracker_Social::thread_messages( (int) $root['id'], (int) $r->get_param( 'after' ) ),
			'following' => true,
		);
	}

	public static function thread_follow( WP_REST_Request $r ) {
		$uid  = self::uid();
		$root = Sawa_Tracker_Social::thread_root( $uid, (int) $r['id'] );
		if ( ! $root ) {
			return self::fail( 'ملقيناش الثريد ده.', 404 );
		}
		global $wpdb;
		$on   = (bool) $r->get_param( 'on' );
		$last = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(id) FROM ' . Sawa_Tracker_Game::table( 'messages' ) . ' WHERE thread_id = %d', $root['id'] ) ); // phpcs:ignore
		Sawa_Tracker_Social::follow_thread( $uid, (int) $root['id'], $on, max( $last, (int) $root['id'] ) );
		return array( 'ok' => true, 'following' => $on );
	}

	public static function send( WP_REST_Request $r ) {
		$uid  = self::uid();
		$room = self::room_or_fail( $r );
		if ( ! $room ) {
			return self::fail( 'إنت مش في الشات ده.', 403 );
		}
		$audio = '';
		$files = $r->get_file_params();
		if ( ! empty( $files['audio'] ) ) {
			if ( ! empty( $files['audio']['error'] ) || (int) $files['audio']['size'] > 4 * MB_IN_BYTES ) {
				return self::fail( 'الرسالة الصوتية طويلة. خليها أقل من دقيقتين.' );
			}
			if ( ! preg_match( '~^(audio|video)/~', (string) $files['audio']['type'] ) ) {
				return self::fail( 'تقدر تبعت رسايل صوتية بس.' );
			}
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
			add_filter( 'upload_mimes', array( __CLASS__, 'mimes' ) );
			add_filter( 'wp_check_filetype_and_ext', array( __CLASS__, 'allow_voice' ), 10, 5 );
			$up = wp_handle_upload( $files['audio'], array( 'test_form' => false ) );
			remove_filter( 'upload_mimes', array( __CLASS__, 'mimes' ) );
			remove_filter( 'wp_check_filetype_and_ext', array( __CLASS__, 'allow_voice' ), 10 );
			if ( empty( $up['url'] ) ) {
				return self::fail( 'الرسالة الصوتية متحفظتش: ' . ( $up['error'] ?? 'unknown error' ) );
			}
			$audio = esc_url_raw( $up['url'] );
		}
		$id = Sawa_Tracker_Social::send( $uid, (int) $room['id'], (string) $r->get_param( 'body' ), $audio, (int) $r->get_param( 'reply_to' ), (int) $r->get_param( 'duration' ), (string) $r->get_param( 'kind' ), (string) $r->get_param( 'media' ), (string) $r->get_param( 'orig' ), 0, (array) $r->get_param( 'mentions' ) );
		if ( is_wp_error( $id ) ) {
			return self::fail( $id );
		}
		return array(
			'ok'        => true,
			'xp'        => Sawa_Tracker_XP::$last,
			'reply'     => Sawa_Tracker_Replies::$last,
			'replyGoal' => Sawa_Tracker_Replies::goal( $uid ),
			'messages'  => Sawa_Tracker_Social::messages( (int) $room['id'], (int) $r->get_param( 'after' ) ),
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
		return Sawa_Tracker_Social::message_row( $id );
	}

	/** Local file of an uploaded voice message, or ''. */
	private static function audio_path( $url ) {
		$up = wp_upload_dir();
		if ( '' === $url || 0 !== strpos( set_url_scheme( $url, 'https' ), set_url_scheme( $up['baseurl'], 'https' ) ) ) {
			return '';
		}
		$path = $up['basedir'] . substr( set_url_scheme( $url, 'https' ), strlen( set_url_scheme( $up['baseurl'], 'https' ) ) );
		return is_file( $path ) ? $path : '';
	}

	/** Voice message → text. Done once per message, then saved for everyone in the chat. */
	private static function transcript_of( $m ) {
		if ( '' !== (string) $m['transcript'] ) {
			return (string) $m['transcript'];
		}
		$path = self::audio_path( (string) $m['audio'] );
		if ( '' === $path ) {
			return new WP_Error( 'audio', 'ملقيناش ملف الرسالة الصوتية.' );
		}
		$text = apply_filters( 'sawa_tracker_transcribe', new WP_Error( 'off', 'تحويل الصوت لنص مش متفعّل لسه.' ), $path, self::uid() );
		if ( is_wp_error( $text ) ) {
			return $text;
		}
		$text = trim( (string) $text );
		if ( '' === $text ) {
			$text = '…';
		}
		global $wpdb;
		$wpdb->update( Sawa_Tracker_Game::table( 'messages' ), array( 'transcript' => $text ), array( 'id' => (int) $m['id'] ) ); // phpcs:ignore
		return $text;
	}

	/** Arabic (any dialect) → natural English for the chat. The student checks it before it's sent. */
	public static function translate( WP_REST_Request $r ) {
		$text = trim( mb_substr( sanitize_textarea_field( (string) $r->get_param( 'text' ) ), 0, 1000 ) );
		if ( '' === $text ) {
			return self::fail( 'اكتب رسالة الأول.' );
		}
		$res = apply_filters( 'sawa_tracker_translate', new WP_Error( 'off', 'الترجمة مش متفعّلة لسه.' ), $text, self::uid() );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + $res;
	}

	public static function react( WP_REST_Request $r ) {
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || $m['deleted'] || ! Sawa_Tracker_Social::can_access( self::uid(), Sawa_Tracker_Social::room( (int) $m['room_id'] ) ) ) {
			return self::fail( 'ملقيناش الرسالة.' );
		}
		// The emoji is sent by its position in the list (some servers mangle emoji in JSON bodies).
		$i     = $r->get_param( 'i' );
		$emoji = null !== $i && isset( Sawa_Tracker_Social::REACTS[ (int) $i ] ) ? Sawa_Tracker_Social::REACTS[ (int) $i ] : (string) $r->get_param( 'emoji' );
		$res   = Sawa_Tracker_Social::toggle_react( self::uid(), (int) $m['id'], $emoji );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true, 'reacts' => Sawa_Tracker_Social::reactions( (int) $m['room_id'], self::uid(), (int) $m['id'] ) );
	}

	/** GIF search through GIPHY (family-friendly rating only). Cached 1 hour per query. */
	public static function gifs( WP_REST_Request $r ) {
		$key = (string) ( Sawa_Tracker_Game::settings()['giphy_key'] ?? '' );
		if ( '' === $key ) {
			return self::fail( 'الـ GIFs مش متفعّلة.' );
		}
		$q  = mb_substr( trim( sanitize_text_field( (string) $r->get_param( 'q' ) ) ), 0, 50 );
		$ck = 'sawa_tr_gif_' . md5( $q );
		$out = get_transient( $ck );
		if ( false === $out ) {
			$url = '' === $q
				? add_query_arg( array( 'api_key' => $key, 'limit' => 24, 'rating' => 'g' ), 'https://api.giphy.com/v1/gifs/trending' )
				: add_query_arg( array( 'api_key' => $key, 'q' => $q, 'limit' => 24, 'rating' => 'g', 'lang' => 'en' ), 'https://api.giphy.com/v1/gifs/search' );
			$res = wp_remote_get( $url, array( 'timeout' => 10 ) );
			$j   = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
			if ( ! is_array( $j ) || ! isset( $j['data'] ) ) {
				return self::fail( 'الـ GIFs مش راضية تحمّل دلوقتي.' );
			}
			$out = array();
			foreach ( (array) $j['data'] as $g ) {
				$small = $g['images']['fixed_height_small']['url'] ?? ( $g['images']['fixed_height']['url'] ?? '' );
				$send  = $g['images']['fixed_height']['url'] ?? $small;
				$small = preg_replace( '~\?.*$~', '', (string) $small );
				$send  = preg_replace( '~\?.*$~', '', (string) $send );
				if ( Sawa_Tracker_Social::gif_ok( $send ) && Sawa_Tracker_Social::gif_ok( $small ) ) {
					$out[] = array( 'preview' => $small, 'url' => $send, 'title' => mb_substr( (string) ( $g['title'] ?? '' ), 0, 80 ) );
				}
			}
			set_transient( $ck, $out, HOUR_IN_SECONDS );
		}
		return array( 'ok' => true, 'gifs' => $out );
	}

	public static function transcript( WP_REST_Request $r ) {
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || $m['deleted'] || '' === (string) $m['audio'] || ! Sawa_Tracker_Social::can_access( self::uid(), Sawa_Tracker_Social::room( (int) $m['room_id'] ) ) ) {
			return self::fail( 'ملقيناش الرسالة.' );
		}
		$text = self::transcript_of( $m );
		if ( is_wp_error( $text ) ) {
			return self::fail( $text );
		}
		return array( 'ok' => true, 'transcript' => $text );
	}

	/** Private feedback on your own message (voice or text): corrections, linked to the skill tree. */
	public static function feedback( WP_REST_Request $r ) {
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || $m['deleted'] || (int) $m['user_id'] !== self::uid() ) {
			return self::fail( 'تقدر تطلب رأي في رسايلك إنت بس.' );
		}
		$voice = '' !== (string) $m['audio'];
		$text  = $voice ? self::transcript_of( $m ) : (string) $m['body'];
		if ( is_wp_error( $text ) ) {
			return self::fail( $text );
		}
		$res = apply_filters( 'sawa_tracker_feedback', new WP_Error( 'off', 'الرأي على الرسايل مش متفعّل لسه.' ), $text, self::uid(), $voice ? 'voice' : 'chat', (int) $m['id'] );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true, 'transcript' => $voice ? $text : '', 'feedback' => $res );
	}

	public static function report( WP_REST_Request $r ) {
		global $wpdb;
		$m = self::message_row( (int) $r['id'] );
		if ( ! $m || ! Sawa_Tracker_Social::can_access( self::uid(), Sawa_Tracker_Social::room( (int) $m['room_id'] ) ) ) {
			return self::fail( 'ملقيناش الرسالة.' );
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
			return self::fail( 'تقدر تمسح رسايلك إنت بس.' );
		}
		$wpdb->update( Sawa_Tracker_Game::table( 'messages' ), array( 'deleted' => 1 ), array( 'id' => (int) $m['id'] ) ); // phpcs:ignore
		return array( 'ok' => true );
	}

	public static function members( WP_REST_Request $r ) {
		$q    = mb_strtolower( trim( (string) $r->get_param( 'q' ) ) );
		$room = $r->get_param( 'room' ) ? Sawa_Tracker_Social::room( (int) $r->get_param( 'room' ) ) : null; // @mention suggestions: only people who can read this chat
		$out  = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $id ) {
			if ( $id === self::uid() || ( $room && ! Sawa_Tracker_Social::can_access( $id, $room ) ) ) {
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
