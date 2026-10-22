<?php
/**
 * REST API used by the tracker app (namespace sawa-tracker/v1).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Rest {

	const NS = 'sawa-tracker/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	private static function route( $path, $method, $cb, $public = false ) {
		register_rest_route(
			self::NS,
			$path,
			array(
				'methods'             => $method,
				'callback'            => array( __CLASS__, $cb ),
				'permission_callback' => $public ? '__return_true' : array( __CLASS__, 'member' ),
			)
		);
	}

	public static function routes() {
		self::route( '/me', 'GET', 'me' );
		self::route( '/class', 'POST', 'choose_class' );
		self::route( '/log', 'POST', 'log' );
		self::route( '/media/search', 'GET', 'media_search' );
		self::route( '/media/info', 'GET', 'media_info' );
		self::route( '/log/(?P<id>\d+)', 'DELETE', 'delete_log' );
		self::route( '/day', 'POST', 'day' );
		self::route( '/cast', 'POST', 'cast' );
		self::route( '/board', 'GET', 'board' );
		self::route( '/feed', 'GET', 'feed' );
		self::route( '/react', 'POST', 'react' );
		self::route( '/student/(?P<id>\d+)', 'GET', 'student' );
		self::route( '/profile', 'POST', 'profile' );
		self::route( '/notifications/seen', 'POST', 'seen' );
		self::route( '/request', 'POST', 'request_access', true );
	}

	public static function member() {
		$uid = get_current_user_id();
		if ( ! $uid ) {
			return new WP_Error( 'signed_out', 'سجّل دخول تاني.', array( 'status' => 401 ) );
		}
		if ( ! Sawa_Tracker_Game::is_member( $uid ) ) {
			return new WP_Error( 'pending', 'حسابك لسه مستني الموافقة.', array( 'status' => 403 ) );
		}
		return true;
	}

	private static function fail( $e ) {
		return new WP_REST_Response(
			array(
				'ok'      => false,
				'message' => $e->get_error_message(),
			),
			400
		);
	}

	private static function uid() {
		return get_current_user_id();
	}

	/* ------------------------------------------------------------------ me */

	public static function me_data( $uid ) {
		global $wpdb;
		$G = 'Sawa_Tracker_Game';
		if ( '' !== $G::m( $uid, 'class' ) ) {
			$G::ensure_started( $uid );
			$G::process_user( $uid );
		}
		$logs  = $G::table( 'logs' );
		$days  = $G::table( 'days' );
		$today = $G::today();
		$yday  = $G::add_days( $today, -1 );
		$tot   = $wpdb->get_row( $wpdb->prepare( "SELECT COALESCE(SUM(minutes),0) AS m, COALESCE(SUM(cards),0) AS c FROM $logs WHERE user_id = %d", $uid ) ); // phpcs:ignore
		$break = $wpdb->get_results( $wpdb->prepare( "SELECT activity, SUM(minutes) AS m FROM $logs WHERE user_id = %d GROUP BY activity ORDER BY m DESC", $uid ), ARRAY_A ); // phpcs:ignore
		$recent = $wpdb->get_results( $wpdb->prepare( "SELECT id, activity, minutes, cards, notes, links, day FROM $logs WHERE user_id = %d ORDER BY day DESC, id DESC LIMIT 25", $uid ), ARRAY_A ); // phpcs:ignore
		$trend = $wpdb->get_results( $wpdb->prepare( "SELECT day, health, minutes, state FROM $days WHERE user_id = %d AND day >= %s AND health IS NOT NULL ORDER BY day", $uid, $G::add_days( $today, -60 ) ), ARRAY_A ); // phpcs:ignore
		$live  = $G::live( $uid );
		$trend[] = array(
			'day'     => $today,
			'health'  => $live['health'],
			'minutes' => $live['todayMinutes'],
			'state'   => 'today',
		);
		$seen   = (int) $G::m( $uid, 'seen', 0 );
		$notifs = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . $G::table( 'events' ) . ' WHERE target_id = %d AND user_id <> %d ORDER BY id DESC LIMIT 15', $uid, $uid ), ARRAY_A ); // phpcs:ignore
		$week   = $G::week_start();
		$heat   = $wpdb->get_results( $wpdb->prepare( "SELECT day, minutes FROM $days WHERE user_id = %d AND day >= %s AND minutes > 0", $uid, $G::add_days( $today, -83 ) ), ARRAY_A ); // phpcs:ignore
		$badges = (array) $G::m( $uid, 'badges', array() );
		$u      = wp_get_current_user();

		return array(
			'me'         => $G::person( $uid ) + array( 'firstName' => $u->first_name ? $u->first_name : strtok( $u->display_name, ' ' ) ),
			'today'      => $today,
			'yesterday'  => $yday,
			'stats'      => $live + array(
				'totalMinutes' => (int) $tot->m,
				'totalCards'   => (int) $tot->c,
			),
			'skills'     => $G::skills_for( $uid ),
			'xp'         => Sawa_Tracker_XP::summary( $uid ),
			'breakdown'  => array_map(
				function ( $r ) {
					return array(
						'activity' => $r['activity'],
						'minutes'  => (int) $r['m'],
					);
				},
				$break
			),
			'recent'     => array_map(
				function ( $r ) use ( $today, $yday ) {
					return array(
						'id'        => (int) $r['id'],
						'activity'  => $r['activity'],
						'minutes'   => (int) $r['minutes'],
						'cards'     => (int) $r['cards'],
						'notes'     => $r['notes'],
						'links'     => json_decode( (string) $r['links'], true ) ?: array(),
						'day'       => $r['day'],
						'canDelete' => $r['day'] === $today || $r['day'] === $yday,
					);
				},
				$recent
			),
			'trend'      => array_map(
				function ( $r ) {
					return array(
						'day'     => $r['day'],
						'health'  => (int) $r['health'],
						'minutes' => (int) $r['minutes'],
						'state'   => $r['state'],
					);
				},
				$trend
			),
			'heat'       => array_map(
				function ( $r ) {
					return array( $r['day'], (int) $r['minutes'] );
				},
				$heat
			),
			'badges'     => array_map(
				function ( $k ) use ( $badges ) {
					$b = Sawa_Tracker_Game::BADGES[ $k ];
					return array(
						'id'    => $k,
						'name'  => $b[0],
						'icon'  => $b[1],
						'about' => $b[2],
						'on'    => $badges[ $k ] ?? null,
					);
				},
				array_keys( $G::BADGES )
			),
			'boss'       => $G::boss(),
			'notifications' => array_map( array( __CLASS__, 'event_out' ), $notifs ),
			'unread'     => count(
				array_filter(
					$notifs,
					function ( $n ) use ( $seen ) {
						return (int) $n['id'] > $seen;
					}
				)
			),
			'weekStart'  => $week,
			'quest'      => ( $q = Sawa_Tracker_Social::quest() ) ? $q + array( 'done' => Sawa_Tracker_Social::quest_done( $uid ) ) : null,
			'remindHour' => (string) $G::m( $uid, 'remind_hour', '' ),
			'clan'       => ( $cid = Sawa_Tracker_Social::clan_of( $uid ) ) ? array_intersect_key( (array) Sawa_Tracker_Social::clan( $cid ), array_flip( array( 'id', 'name', 'emoji' ) ) ) : null,
			'skoolUrl'   => (string) $G::settings()['skool_url'],
			'isAdmin'    => user_can( $uid, 'manage_options' ),
		);
	}

	public static function me() {
		return self::me_data( self::uid() );
	}

	public static function choose_class( WP_REST_Request $r ) {
		$uid = self::uid();
		$c   = sanitize_key( (string) $r->get_param( 'class' ) );
		if ( ! isset( Sawa_Tracker_Game::CLASSES[ $c ] ) ) {
			return self::fail( new WP_Error( 'class', 'اختار المحارب أو المعالج.' ) );
		}
		$had = Sawa_Tracker_Game::m( $uid, 'class' );
		if ( '' !== $had && $had !== $c ) {
			$changed = Sawa_Tracker_Game::m( $uid, 'class_changed', '' );
			if ( $changed && $changed > Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -30 ) ) {
				return self::fail( new WP_Error( 'class', 'تقدر تغيّر الكلاس مرة كل ٣٠ يوم.' ) );
			}
			Sawa_Tracker_Game::set( $uid, 'class_changed', Sawa_Tracker_Game::today() );
			Sawa_Tracker_Game::set( $uid, 'cooldowns', array() );
		}
		Sawa_Tracker_Game::set( $uid, 'class', $c );
		Sawa_Tracker_Game::ensure_started( $uid );
		if ( '' === $had ) {
			Sawa_Tracker_Game::event( $uid, 'joined', null, array( 'class' => $c ) );
		}
		Sawa_Tracker_Game::bust_boards();
		return self::me_data( $uid );
	}

	/* ------------------------------------------------------------------ logging */

	public static function log( WP_REST_Request $r ) {
		$uid = self::uid();
		if ( ! current_user_can( 'manage_options' ) && '' === (string) Sawa_Tracker_Game::m( $uid, 'avatar', '' ) ) {
			return new WP_Error( 'photo', 'ارفع صورتك الأول عشان تقدر تسجّل مذاكرتك.', array( 'status' => 400 ) );
		}
		$res = Sawa_Tracker_Game::add_log(
			$uid,
			(string) $r->get_param( 'activity' ),
			(int) $r->get_param( 'minutes' ),
			(int) $r->get_param( 'cards' ),
			(string) $r->get_param( 'notes' ),
			(string) ( $r->get_param( 'day' ) ? $r->get_param( 'day' ) : Sawa_Tracker_Game::today() ),
			false,
			(array) $r->get_param( 'links' )
		);
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + $res + array( 'data' => self::me_data( $uid ) );
	}

	/** Find the video you studied with, by its title. */
	public static function media_search( WP_REST_Request $r ) {
		$res = Sawa_Tracker_Media::search( self::uid(), (string) $r->get_param( 'q' ) );
		return is_wp_error( $res ) ? self::fail( $res ) : array( 'ok' => true, 'items' => $res );
	}

	/** A pasted link's title. */
	public static function media_info( WP_REST_Request $r ) {
		$res = Sawa_Tracker_Media::info( (string) $r->get_param( 'url' ) );
		return is_wp_error( $res ) ? self::fail( $res ) : array( 'ok' => true, 'item' => $res );
	}

	public static function delete_log( WP_REST_Request $r ) {
		$uid = self::uid();
		$res = Sawa_Tracker_Game::delete_log( $uid, (int) $r['id'] );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array(
			'ok'   => true,
			'data' => self::me_data( $uid ),
		);
	}

	public static function day( WP_REST_Request $r ) {
		$uid     = self::uid();
		$entries = array_values( array_filter( (array) $r->get_param( 'entries' ), 'is_array' ) );
		if ( ! $entries ) {
			return self::fail( new WP_Error( 'empty', 'ضيف نشاط واحد على الأقل بالدقايق بتاعته.' ) );
		}
		$day = (string) ( $r->get_param( 'day' ) ? $r->get_param( 'day' ) : Sawa_Tracker_Game::today() );
		$res = Sawa_Tracker_Game::log_day( $uid, $day, $entries, (int) $r->get_param( 'moodBefore' ), (int) $r->get_param( 'moodAfter' ), (string) $r->get_param( 'note' ) );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + $res + array( 'data' => self::me_data( $uid ) );
	}

	/* ------------------------------------------------------------------ social */

	public static function cast( WP_REST_Request $r ) {
		$uid = self::uid();
		$res = Sawa_Tracker_Game::cast( $uid, sanitize_key( (string) $r->get_param( 'skill' ) ), (int) $r->get_param( 'target' ) );
		if ( is_wp_error( $res ) ) {
			return self::fail( $res );
		}
		return array( 'ok' => true ) + $res + array( 'data' => self::me_data( $uid ) );
	}

	public static function board( WP_REST_Request $r ) {
		$rows = Sawa_Tracker_Game::board( (string) $r->get_param( 'tab' ) );
		$uid  = self::uid();
		$mine = null;
		foreach ( $rows as $row ) {
			if ( $row['id'] === $uid ) {
				$mine = $row;
			}
		}
		return array(
			'total' => count( $rows ),
			'rows'  => array_slice( $rows, 0, 100 ),
			'me'    => $mine,
		);
	}

	public static function event_out( $e ) {
		$data = json_decode( (string) $e['data'], true );
		return array(
			'id'     => (int) $e['id'],
			'type'   => $e['type'],
			'who'    => (int) $e['user_id'] ? Sawa_Tracker_Game::person( (int) $e['user_id'] ) : null,
			'target' => $e['target_id'] ? Sawa_Tracker_Game::person( (int) $e['target_id'] ) : null,
			'data'   => is_array( $data ) ? $data : array(),
			'at'     => mysql2date( 'c', $e['created_at'] ),
		);
	}

	/** Newest events. Pass ?after=ID to get only what's new since the last poll. */
	public static function feed( WP_REST_Request $r ) {
		global $wpdb;
		$t      = Sawa_Tracker_Game::table( 'events' );
		$after  = (int) $r->get_param( 'after' );
		$before = (int) $r->get_param( 'before' );
		$types  = "'log','day_done','skill','level_up','badge','boss_down','streak_lost','freeze_used','joined','quest_done','mastered','town','party_down','hero_level','coop_built','chat_helper'";
		if ( $after ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE id > %d AND type IN ($types) ORDER BY id DESC LIMIT 50", $after ), ARRAY_A ); // phpcs:ignore
		} elseif ( $before ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE id < %d AND type IN ($types) ORDER BY id DESC LIMIT 30", $before ), ARRAY_A ); // phpcs:ignore
		} else {
			$rows = $wpdb->get_results( "SELECT * FROM $t WHERE type IN ($types) ORDER BY id DESC LIMIT 30", ARRAY_A ); // phpcs:ignore
		}
		$ids   = wp_list_pluck( $rows, 'id' );
		$reac  = array();
		$mine  = array();
		if ( $ids ) {
			$in = implode( ',', array_map( 'intval', $ids ) );
			foreach ( $wpdb->get_results( 'SELECT event_id, emoji, COUNT(*) AS n, SUM(user_id = ' . (int) self::uid() . ') AS me FROM ' . Sawa_Tracker_Game::table( 'reactions' ) . " WHERE event_id IN ($in) GROUP BY event_id, emoji", ARRAY_A ) as $x ) { // phpcs:ignore
				$reac[ (int) $x['event_id'] ][ $x['emoji'] ] = (int) $x['n'];
				if ( (int) $x['me'] ) {
					$mine[ (int) $x['event_id'] ][] = $x['emoji'];
				}
			}
		}
		$out = array();
		foreach ( $rows as $e ) {
			$o              = self::event_out( $e );
			$o['reactions'] = $reac[ $o['id'] ] ?? (object) array();
			$o['mine']      = $mine[ $o['id'] ] ?? array();
			$out[]          = $o;
		}
		return array(
			'events' => $out,
			'now'    => current_time( 'c' ),
		);
	}

	public static function react( WP_REST_Request $r ) {
		global $wpdb;
		$allowed = array( '👏', '🔥', '💪', '❤️' );
		$emoji   = (string) $r->get_param( 'emoji' );
		$event   = (int) $r->get_param( 'event' );
		if ( ! in_array( $emoji, $allowed, true ) || ! $event ) {
			return self::fail( new WP_Error( 'react', 'التفاعل ده مش موجود.' ) );
		}
		$t    = Sawa_Tracker_Game::table( 'reactions' );
		$keys = array(
			'event_id' => $event,
			'user_id'  => self::uid(),
			'emoji'    => $emoji,
		);
		$has  = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE event_id = %d AND user_id = %d AND emoji = %s", $event, self::uid(), $emoji ) ); // phpcs:ignore
		if ( $has ) {
			$wpdb->delete( $t, $keys ); // phpcs:ignore
		} else {
			$wpdb->insert( $t, $keys ); // phpcs:ignore
		}
		$n = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE event_id = %d AND emoji = %s", $event, $emoji ) ); // phpcs:ignore
		return array(
			'ok'    => true,
			'on'    => ! $has,
			'count' => $n,
		);
	}

	public static function student( WP_REST_Request $r ) {
		global $wpdb;
		$id = (int) $r['id'];
		if ( ! Sawa_Tracker_Game::is_member( $id ) ) {
			return self::fail( new WP_Error( 'missing', 'ملقيناش الطالب ده.' ) );
		}
		Sawa_Tracker_Game::process_user( $id );
		$live   = Sawa_Tracker_Game::live( $id );
		$logs   = Sawa_Tracker_Game::table( 'logs' );
		$total  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(minutes),0) FROM $logs WHERE user_id = %d", $id ) ); // phpcs:ignore
		$recent = $wpdb->get_results( $wpdb->prepare( "SELECT activity, minutes, day FROM $logs WHERE user_id = %d ORDER BY id DESC LIMIT 6", $id ), ARRAY_A ); // phpcs:ignore
		$badges = (array) Sawa_Tracker_Game::m( $id, 'badges', array() );
		return Sawa_Tracker_Game::person( $id ) + array(
			'level'        => $live['level'],
			'title'        => $live['title'],
			'health'       => $live['health'],
			'streak'       => $live['streak'],
			'bestStreak'   => $live['bestStreak'],
			'studyDays'    => $live['studyDays'],
			'studiedToday' => $live['studiedToday'],
			'freezes'      => $live['freezes'],
			'shieldUntil'  => $live['shieldUntil'],
			'totalMinutes' => $total,
			'recent'       => $recent,
			'badges'       => array_values(
				array_map(
					function ( $k ) {
						return array(
							'name' => Sawa_Tracker_Game::BADGES[ $k ][0],
							'icon' => Sawa_Tracker_Game::BADGES[ $k ][1],
						);
					},
					array_keys( array_intersect_key( $badges, Sawa_Tracker_Game::BADGES ) )
				)
			),
		);
	}

	public static function profile( WP_REST_Request $r ) {
		$uid = self::uid();
		if ( null !== $r->get_param( 'goal' ) ) {
			Sawa_Tracker_Game::set( $uid, 'goal', max( 5, min( 600, (int) $r->get_param( 'goal' ) ) ) );
		}
		$files = $r->get_file_params();
		if ( ! empty( $files['avatar'] ) ) {
			if ( 0 !== strpos( (string) $files['avatar']['type'], 'image/' ) ) {
				return self::fail( new WP_Error( 'type', 'اختار صورة JPG أو PNG.' ) );
			}
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$aid = media_handle_upload( 'avatar', 0, array( 'post_title' => 'Avatar ' . $uid ), array( 'test_form' => false ) );
			if ( is_wp_error( $aid ) ) {
				return self::fail( $aid );
			}
			$old = (int) Sawa_Tracker_Game::m( $uid, 'avatar_id', 0 );
			if ( $old ) {
				wp_delete_attachment( $old, true );
			}
			Sawa_Tracker_Game::set( $uid, 'avatar_id', $aid );
			Sawa_Tracker_Game::set( $uid, 'avatar', wp_get_attachment_image_url( $aid, 'thumbnail' ) ? wp_get_attachment_image_url( $aid, 'thumbnail' ) : wp_get_attachment_url( $aid ) );
		}
		Sawa_Tracker_Game::bust_boards();
		return array(
			'ok'   => true,
			'data' => self::me_data( $uid ),
		);
	}

	public static function seen( WP_REST_Request $r ) {
		Sawa_Tracker_Game::set( self::uid(), 'seen', (int) $r->get_param( 'id' ) );
		return array( 'ok' => true );
	}

	/* ------------------------------------------------------------------ access requests */

	public static function request_access( WP_REST_Request $r ) {
		$fail = function ( $m ) {
			return new WP_REST_Response(
				array(
					'ok'      => false,
					'message' => $m,
				),
				400
			);
		};
		if ( '' !== trim( (string) $r->get_param( 'website' ) ) ) {
			return array( 'ok' => true );
		}
		$ip  = sanitize_text_field( wp_unslash( $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ( $_SERVER['REMOTE_ADDR'] ?? '' ) ) );
		$key = 'sawa_tr_req_' . md5( $ip );
		if ( (int) get_transient( $key ) >= 5 ) {
			return $fail( 'طلبات كتير من نفس الاتصال. جرب تاني بعد شوية.' );
		}
		$name  = sanitize_text_field( (string) $r->get_param( 'name' ) );
		$email = sanitize_email( (string) $r->get_param( 'email' ) );
		$pass  = (string) $r->get_param( 'password' );
		$note  = sanitize_text_field( (string) $r->get_param( 'note' ) );
		if ( mb_strlen( $name ) < 2 ) {
			return $fail( 'اكتب اسمك.' );
		}
		if ( ! is_email( $email ) ) {
			return $fail( 'اكتب إيميل صحيح.' );
		}
		if ( strlen( $pass ) < 8 ) {
			return $fail( 'اختار باسورد ٨ حروف على الأقل.' );
		}
		if ( email_exists( $email ) ) {
			return $fail( 'في حساب بالإيميل ده. سجّل دخول، أو غيّر الباسورد لو نسيته.' );
		}
		$login = sanitize_user( strtolower( strtok( $email, '@' ) ), true );
		$base  = $login ? $login : 'student';
		$i     = 1;
		while ( username_exists( $login ) || '' === $login ) {
			$login = $base . ( ++$i );
		}
		$uid = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_email'   => $email,
				'user_pass'    => $pass,
				'display_name' => $name,
				'first_name'   => strtok( $name, ' ' ),
				'role'         => 'subscriber',
			)
		);
		if ( is_wp_error( $uid ) ) {
			return $fail( $uid->get_error_message() );
		}
		Sawa_Tracker_Game::set( $uid, 'status', 'pending' );
		Sawa_Tracker_Game::set( $uid, 'requested', current_time( 'mysql' ) );
		if ( $note ) {
			Sawa_Tracker_Game::set( $uid, 'request_note', $note );
		}
		set_transient( $key, (int) get_transient( $key ) + 1, HOUR_IN_SECONDS );
		if ( Sawa_Tracker_Game::settings()['notify_admin'] ) {
			wp_mail(
				get_option( 'admin_email' ),
				sprintf( 'Sawa Tracker: %s asked to join', $name ),
				sprintf( "%s (%s) asked to join the tracker.%s\n\nApprove or decline here:\n%s", $name, $email, $note ? "\nNote: $note" : '', admin_url( 'admin.php?page=sawa-tracker' ) )
			);
		}
		wp_set_current_user( $uid );
		wp_set_auth_cookie( $uid, true );
		return array( 'ok' => true );
	}
}
