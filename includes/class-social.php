<?php
/**
 * Community features: clans, chat rooms (community, clan, private groups), the daily quest,
 * the Skool daily-post text, and email reminders.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Social {

	const CLAN_NAMES = array(
		array( 'الأسود', '' ), array( 'النسور', '' ), array( 'الذئاب', '' ), array( 'الصقور', '' ), array( 'البوم', '' ), array( 'الدلافين', '' ), array( 'النمور', '' ), array( 'الفهود', '' ), array( 'العُقبان', '' ), array( 'الدببة', '' ), array( 'القروش', '' ), array( 'العنقاء', '' ), array( 'الخيول', '' ), array( 'الكوبرا', '' ), array( 'الثعالب', '' ), array( 'الأفيال', '' ),
	);
	const GROUP_MIN = 3;
	const GROUP_MAX = 5;
	const GROUPS_PER_USER = 3;

	private static function t( $n ) {
		return Sawa_Tracker_Game::table( $n );
	}

	/* ------------------------------------------------------------------ install */

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		dbDelta(
			'CREATE TABLE ' . self::t( 'clans' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			name varchar(60) NOT NULL,
			emoji varchar(16) NOT NULL DEFAULT '',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'rooms' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			type varchar(10) NOT NULL,
			clan_id bigint(20) unsigned DEFAULT NULL,
			name varchar(60) NOT NULL DEFAULT '',
			created_by bigint(20) unsigned DEFAULT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY clan (clan_id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'room_members' ) . " (
			room_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			joined_at datetime NOT NULL,
			PRIMARY KEY  (room_id,user_id),
			KEY user (user_id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'reads' ) . " (
			room_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			last_read bigint(20) unsigned NOT NULL DEFAULT 0,
			PRIMARY KEY  (room_id,user_id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'messages' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			room_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			body text,
			audio varchar(255) NOT NULL DEFAULT '',
			deleted tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY room (room_id,id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'reports' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			message_id bigint(20) unsigned NOT NULL,
			reporter_id bigint(20) unsigned NOT NULL,
			reason varchar(200) NOT NULL DEFAULT '',
			resolved tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY open (resolved,id)
			) $c;"
		);
		if ( ! self::public_room() ) {
			$wpdb->insert( self::t( 'rooms' ), array( 'type' => 'public', 'name' => 'Community', 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
		}
	}

	public static function public_room() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT id FROM ' . self::t( 'rooms' ) . " WHERE type = 'public' ORDER BY id LIMIT 1" ); // phpcs:ignore
	}

	/* ------------------------------------------------------------------ clans */

	public static function clans() {
		global $wpdb;
		return $wpdb->get_results( 'SELECT * FROM ' . self::t( 'clans' ) . ' ORDER BY id', ARRAY_A ); // phpcs:ignore
	}

	public static function clan( $id ) {
		global $wpdb;
		return $id ? $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'clans' ) . ' WHERE id = %d', $id ), ARRAY_A ) : null; // phpcs:ignore
	}

	public static function clan_of( $uid ) {
		$id = (int) Sawa_Tracker_Game::m( $uid, 'clan', 0 );
		return $id && self::clan( $id ) ? $id : 0;
	}

	public static function clan_members( $clan_id ) {
		return array_values(
			array_filter(
				array_map(
					'intval',
					get_users(
						array(
							'meta_key'   => 'sawa_clan', // phpcs:ignore
							'meta_value' => (string) (int) $clan_id, // phpcs:ignore
							'fields'     => 'ID',
						)
					)
				),
				array( 'Sawa_Tracker_Game', 'is_member' )
			)
		);
	}

	public static function create_clan( $name = '', $emoji = '' ) {
		global $wpdb;
		if ( '' === $name ) {
			$used = wp_list_pluck( self::clans(), 'name' );
			foreach ( self::CLAN_NAMES as $i => $c ) {
				$n = $c[0];
				if ( ! in_array( $n, $used, true ) ) {
					$name  = $n;
					$emoji = $c[1];
					break;
				}
			}
			if ( '' === $name ) {
				$name  = 'كلان ' . ( count( $used ) + 1 );
				$emoji = '';
			}
		}
		$wpdb->insert( self::t( 'clans' ), array( 'name' => mb_substr( $name, 0, 60 ), 'emoji' => mb_substr( $emoji, 0, 8 ), 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
		$id = (int) $wpdb->insert_id;
		$wpdb->insert( self::t( 'rooms' ), array( 'type' => 'clan', 'clan_id' => $id, 'name' => mb_substr( $name, 0, 60 ), 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
		return $id;
	}

	public static function update_clan( $id, $name, $emoji ) {
		global $wpdb;
		$wpdb->update( self::t( 'clans' ), array( 'name' => mb_substr( $name, 0, 60 ), 'emoji' => mb_substr( $emoji, 0, 8 ) ), array( 'id' => $id ) ); // phpcs:ignore
		$wpdb->update( self::t( 'rooms' ), array( 'name' => mb_substr( $name, 0, 60 ) ), array( 'clan_id' => $id ) ); // phpcs:ignore
	}

	public static function delete_clan( $id ) {
		global $wpdb;
		foreach ( self::clan_members( $id ) as $uid ) {
			delete_user_meta( $uid, 'sawa_clan' );
		}
		$rooms = $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM ' . self::t( 'rooms' ) . ' WHERE clan_id = %d', $id ) ); // phpcs:ignore
		foreach ( $rooms as $r ) {
			$wpdb->delete( self::t( 'messages' ), array( 'room_id' => $r ) ); // phpcs:ignore
			$wpdb->delete( self::t( 'reads' ), array( 'room_id' => $r ) ); // phpcs:ignore
			$wpdb->delete( self::t( 'rooms' ), array( 'id' => $r ) ); // phpcs:ignore
		}
		$wpdb->delete( self::t( 'clans' ), array( 'id' => $id ) ); // phpcs:ignore
	}

	public static function set_clan( $uid, $clan_id ) {
		if ( $clan_id ) {
			Sawa_Tracker_Game::set( $uid, 'clan', (int) $clan_id );
		} else {
			delete_user_meta( $uid, 'sawa_clan' );
		}
	}

	/**
	 * Puts every active student without a clan into one, mixing strong and new students so clans are balanced.
	 */
	public static function auto_assign( $size ) {
		$size  = max( 3, min( 20, (int) $size ) );
		$todo  = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $uid ) {
			if ( ! self::clan_of( $uid ) && '' !== Sawa_Tracker_Game::m( $uid, 'class' ) ) {
				$todo[ $uid ] = Sawa_Tracker_Game::study_days( $uid );
			}
		}
		if ( ! $todo ) {
			return 0;
		}
		arsort( $todo );
		$counts = array();
		foreach ( self::clans() as $c ) {
			$counts[ (int) $c['id'] ] = count( self::clan_members( (int) $c['id'] ) );
		}
		$needed = (int) ceil( ( array_sum( $counts ) + count( $todo ) ) / $size ) - count( $counts );
		for ( $i = 0; $i < $needed; $i++ ) {
			$counts[ self::create_clan() ] = 0;
		}
		foreach ( array_keys( $todo ) as $uid ) {
			asort( $counts );
			$target = array_key_first( $counts );
			self::set_clan( $uid, $target );
			++$counts[ $target ];
		}
		return count( $todo );
	}

	/** Clan streak, weekly score and member rows. A clan day counts when at least 60% of members studied. */
	public static function clan_stats( $clan_id, $with_members = true ) {
		global $wpdb;
		$G       = 'Sawa_Tracker_Game';
		$members = self::clan_members( $clan_id );
		$n       = count( $members );
		$today   = $G::today();
		$week    = $G::week_start();
		$out     = array(
			'id'      => (int) $clan_id,
			'size'    => $n,
			'streak'  => 0,
			'score'   => 0,
			'today'   => 0,
			'members' => array(),
		);
		$c = self::clan( $clan_id );
		if ( $c ) {
			$out['name']  = $c['name'];
			$out['emoji'] = $c['emoji'];
		}
		if ( ! $n ) {
			return $out;
		}
		$in    = implode( ',', array_map( 'intval', $members ) );
		$from  = $G::add_days( $today, -90 );
		$rows  = $wpdb->get_results( $wpdb->prepare( 'SELECT user_id, day, minutes FROM ' . $G::table( 'days' ) . " WHERE user_id IN ($in) AND day >= %s AND minutes > 0", $from ), ARRAY_A ); // phpcs:ignore
		$byday = array();
		$goal_days = array_fill_keys( $members, array() );
		foreach ( $rows as $r ) {
			$byday[ $r['day'] ] = ( $byday[ $r['day'] ] ?? 0 ) + 1;
			if ( $r['day'] >= $week && (int) $r['minutes'] >= $G::goal( (int) $r['user_id'] ) ) {
				$goal_days[ (int) $r['user_id'] ][] = $r['day'];
			}
		}
		$need          = max( 1, (int) ceil( $n * 0.6 ) );
		$out['today']  = $byday[ $today ] ?? 0;
		$streak        = ( $out['today'] >= $need ) ? 1 : 0;
		for ( $d = $G::add_days( $today, -1 ); $d >= $from; $d = $G::add_days( $d, -1 ) ) {
			if ( ( $byday[ $d ] ?? 0 ) < $need ) {
				break;
			}
			++$streak;
		}
		$out['streak'] = $streak;
		$out['need']   = $need;
		$out['score']  = round( array_sum( array_map( 'count', $goal_days ) ) / $n, 2 );
		if ( $with_members ) {
			foreach ( $members as $uid ) {
				$G::process_user( $uid );
				$l                = $G::live( $uid );
				$out['members'][] = $G::person( $uid ) + array(
					'level'     => $l['level'],
					'health'    => $l['health'],
					'streak'    => $l['streak'],
					'today'     => $l['studiedToday'],
					'todayMin'  => $l['todayMinutes'],
					'goalDays'  => $goal_days[ $uid ],
				);
			}
			usort(
				$out['members'],
				function ( $a, $b ) {
					return array( count( $b['goalDays'] ), $b['streak'] ) <=> array( count( $a['goalDays'] ), $a['streak'] );
				}
			);
		}
		return $out;
	}

	public static function standings() {
		$rows = array();
		foreach ( self::clans() as $c ) {
			$s = self::clan_stats( (int) $c['id'], false );
			if ( $s['size'] ) {
				$rows[] = $s;
			}
		}
		usort(
			$rows,
			function ( $a, $b ) {
				return array( $b['score'], $b['streak'] ) <=> array( $a['score'], $a['streak'] );
			}
		);
		foreach ( $rows as $i => &$r ) {
			$r['rank'] = $i + 1;
			unset( $r['members'] );
		}
		return $rows;
	}

	/* ------------------------------------------------------------------ chat */

	public static function room( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'rooms' ) . ' WHERE id = %d', $id ), ARRAY_A ); // phpcs:ignore
	}

	public static function can_access( $uid, $room ) {
		if ( ! $room || ! Sawa_Tracker_Game::is_member( $uid ) ) {
			return false;
		}
		if ( 'public' === $room['type'] ) {
			return true;
		}
		if ( 'clan' === $room['type'] ) {
			return user_can( $uid, 'manage_options' ) || self::clan_of( $uid ) === (int) $room['clan_id'];
		}
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'room_members' ) . ' WHERE room_id = %d AND user_id = %d', $room['id'], $uid ) ); // phpcs:ignore
	}

	public static function group_members( $room_id ) {
		global $wpdb;
		return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( 'SELECT user_id FROM ' . self::t( 'room_members' ) . ' WHERE room_id = %d ORDER BY joined_at', $room_id ) ) ); // phpcs:ignore
	}

	/** Rooms this student can see, with unread counts and the latest message. */
	public static function rooms_for( $uid ) {
		global $wpdb;
		$ids  = array( self::public_room() );
		$clan = self::clan_of( $uid );
		if ( $clan ) {
			$ids[] = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . self::t( 'rooms' ) . " WHERE type = 'clan' AND clan_id = %d", $clan ) ); // phpcs:ignore
		}
		foreach ( $wpdb->get_col( $wpdb->prepare( 'SELECT r.id FROM ' . self::t( 'rooms' ) . ' r JOIN ' . self::t( 'room_members' ) . " m ON m.room_id = r.id WHERE r.type = 'group' AND m.user_id = %d ORDER BY r.id", $uid ) ) as $g ) { // phpcs:ignore
			$ids[] = (int) $g;
		}
		$out = array();
		foreach ( array_filter( $ids ) as $id ) {
			$r    = self::room( $id );
			$read = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT last_read FROM ' . self::t( 'reads' ) . ' WHERE room_id = %d AND user_id = %d', $id, $uid ) ); // phpcs:ignore
			$last = $wpdb->get_row( $wpdb->prepare( 'SELECT id, user_id, body, audio, created_at FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND deleted = 0 ORDER BY id DESC LIMIT 1', $id ), ARRAY_A ); // phpcs:ignore
			$unread = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND id > %d AND user_id <> %d AND deleted = 0', $id, $read, $uid ) ); // phpcs:ignore
			$row  = array(
				'id'     => (int) $id,
				'type'   => $r['type'],
				'name'   => 'public' === $r['type'] ? 'Community' : $r['name'],
				'unread' => min( 99, $unread ),
				'last'   => $last ? array(
					'who'  => Sawa_Tracker_Game::person( (int) $last['user_id'] )['name'],
					'text' => $last['audio'] ? '🎤 Voice message' : wp_trim_words( (string) $last['body'], 10, '…' ),
					'at'   => mysql2date( 'c', $last['created_at'] ),
				) : null,
			);
			if ( 'clan' === $r['type'] ) {
				$c            = self::clan( (int) $r['clan_id'] );
				$row['emoji'] = $c ? $c['emoji'] : '🛡️';
			} elseif ( 'group' === $r['type'] ) {
				$row['members']  = array_map( array( 'Sawa_Tracker_Game', 'person' ), self::group_members( $id ) );
				$row['owner']    = (int) $r['created_by'];
			}
			$out[] = $row;
		}
		return $out;
	}

	public static function message_out( $m ) {
		return array(
			'id'    => (int) $m['id'],
			'who'   => Sawa_Tracker_Game::person( (int) $m['user_id'] ),
			'body'  => $m['deleted'] ? '' : (string) $m['body'],
			'audio' => $m['deleted'] ? '' : (string) $m['audio'],
			'gone'  => (bool) $m['deleted'],
			'at'    => mysql2date( 'c', $m['created_at'] ),
		);
	}

	public static function messages( $room_id, $after = 0, $before = 0 ) {
		global $wpdb;
		$t = self::t( 'messages' );
		if ( $after ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE room_id = %d AND id > %d ORDER BY id ASC LIMIT 100", $room_id, $after ), ARRAY_A ); // phpcs:ignore
		} else {
			$cond = $before ? $wpdb->prepare( 'AND id < %d', $before ) : '';
			$rows = array_reverse( $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE room_id = %d $cond ORDER BY id DESC LIMIT 50", $room_id ), ARRAY_A ) ); // phpcs:ignore
		}
		return array_map( array( __CLASS__, 'message_out' ), $rows );
	}

	public static function filter_words( $text ) {
		$words = array_filter( array_map( 'trim', explode( ',', (string) Sawa_Tracker_Game::settings()['blocked_words'] ) ) );
		foreach ( $words as $w ) {
			$text = preg_replace( '/' . preg_quote( $w, '/' ) . '/iu', str_repeat( '*', max( 3, mb_strlen( $w ) ) ), $text );
		}
		return $text;
	}

	public static function send( $uid, $room_id, $body, $audio_url = '' ) {
		global $wpdb;
		$room = self::room( $room_id );
		if ( ! self::can_access( $uid, $room ) ) {
			return new WP_Error( 'room', 'إنت مش في الشات ده.' );
		}
		if ( ! Sawa_Tracker_Game::settings()['chat_enabled'] && ! user_can( $uid, 'manage_options' ) ) {
			return new WP_Error( 'off', 'الشات متوقف دلوقتي.' );
		}
		$muted = (string) Sawa_Tracker_Game::m( $uid, 'muted_until', '' );
		if ( $muted && $muted >= Sawa_Tracker_Game::today() ) {
			return new WP_Error( 'muted', sprintf( 'تقدر تقرا الشات بس مش هتقدر تبعت لحد %s.', wp_date( 'M j', strtotime( $muted . ' 12:00' ) ) ) );
		}
		$body = trim( mb_substr( sanitize_textarea_field( $body ), 0, 1000 ) );
		if ( '' === $body && '' === $audio_url ) {
			return new WP_Error( 'empty', 'اكتب رسالة الأول.' );
		}
		$rl = (array) get_transient( 'sawa_tr_chat_' . $uid );
		$now = microtime( true );
		$rl  = array_values( array_filter( $rl, function ( $t ) use ( $now ) { return $now - $t < 60; } ) );
		if ( count( $rl ) >= 20 || ( $rl && $now - end( $rl ) < 1.2 ) ) {
			return new WP_Error( 'slow', 'براحة شوية. جرب تاني كمان ثواني.' );
		}
		$rl[] = $now;
		set_transient( 'sawa_tr_chat_' . $uid, $rl, 120 );
		$wpdb->insert( // phpcs:ignore
			self::t( 'messages' ),
			array(
				'room_id'    => $room_id,
				'user_id'    => $uid,
				'body'       => self::filter_words( $body ),
				'audio'      => $audio_url,
				'created_at' => Sawa_Tracker_Game::now_mysql(),
			)
		);
		$id = (int) $wpdb->insert_id;
		self::mark_read( $uid, $room_id, $id );
		return $id;
	}

	public static function mark_read( $uid, $room_id, $msg_id ) {
		global $wpdb;
		$t = self::t( 'reads' );
		$wpdb->query( $wpdb->prepare( "INSERT INTO $t (room_id, user_id, last_read) VALUES (%d, %d, %d) ON DUPLICATE KEY UPDATE last_read = GREATEST(last_read, VALUES(last_read))", $room_id, $uid, $msg_id ) ); // phpcs:ignore
	}

	public static function create_group( $uid, $name, $member_ids ) {
		global $wpdb;
		$mine = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'rooms' ) . " WHERE type = 'group' AND created_by = %d", $uid ) ); // phpcs:ignore
		if ( $mine >= self::GROUPS_PER_USER ) {
			return new WP_Error( 'limit', sprintf( 'تقدر تعمل لحد %d جروبات. اخرج من واحد الأول.', self::GROUPS_PER_USER ) );
		}
		$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $member_ids ), function ( $i ) use ( $uid ) { return $i !== $uid && Sawa_Tracker_Game::is_member( $i ); } ) ) );
		$total = count( $ids ) + 1;
		if ( $total < self::GROUP_MIN || $total > self::GROUP_MAX ) {
			return new WP_Error( 'size', sprintf( 'الجروب من %d لـ %d أشخاص بيك. اختار من %d لـ %d زمايل.', self::GROUP_MIN, self::GROUP_MAX, self::GROUP_MIN - 1, self::GROUP_MAX - 1 ) );
		}
		$name = trim( mb_substr( sanitize_text_field( $name ), 0, 40 ) );
		if ( '' === $name ) {
			$name = 'Study group';
		}
		$wpdb->insert( self::t( 'rooms' ), array( 'type' => 'group', 'name' => self::filter_words( $name ), 'created_by' => $uid, 'created_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
		$room = (int) $wpdb->insert_id;
		foreach ( array_merge( array( $uid ), $ids ) as $m ) {
			$wpdb->insert( self::t( 'room_members' ), array( 'room_id' => $room, 'user_id' => $m, 'joined_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
			if ( $m !== $uid ) {
				Sawa_Tracker_Game::event( $uid, 'group_invite', $m, array( 'room' => $room, 'name' => $name ) );
			}
		}
		return $room;
	}

	public static function add_to_group( $uid, $room_id, $member_ids ) {
		global $wpdb;
		$room = self::room( $room_id );
		if ( ! $room || 'group' !== $room['type'] || (int) $room['created_by'] !== $uid ) {
			return new WP_Error( 'owner', 'اللي عمل الجروب بس هو اللي يقدر يضيف ناس.' );
		}
		$have = self::group_members( $room_id );
		$add  = array_values( array_diff( array_filter( array_map( 'intval', (array) $member_ids ), array( 'Sawa_Tracker_Game', 'is_member' ) ), $have ) );
		if ( count( $have ) + count( $add ) > self::GROUP_MAX ) {
			return new WP_Error( 'size', sprintf( 'الجروب أقصاه %d أشخاص.', self::GROUP_MAX ) );
		}
		foreach ( $add as $m ) {
			$wpdb->insert( self::t( 'room_members' ), array( 'room_id' => $room_id, 'user_id' => $m, 'joined_at' => Sawa_Tracker_Game::now_mysql() ) ); // phpcs:ignore
			Sawa_Tracker_Game::event( $uid, 'group_invite', $m, array( 'room' => $room_id, 'name' => $room['name'] ) );
		}
		return true;
	}

	public static function leave_group( $uid, $room_id ) {
		global $wpdb;
		$room = self::room( $room_id );
		if ( ! $room || 'group' !== $room['type'] ) {
			return new WP_Error( 'room', 'ملقيناش الجروب ده.' );
		}
		$wpdb->delete( self::t( 'room_members' ), array( 'room_id' => $room_id, 'user_id' => $uid ) ); // phpcs:ignore
		$left = self::group_members( $room_id );
		if ( ! $left ) {
			$wpdb->delete( self::t( 'messages' ), array( 'room_id' => $room_id ) ); // phpcs:ignore
			$wpdb->delete( self::t( 'reads' ), array( 'room_id' => $room_id ) ); // phpcs:ignore
			$wpdb->delete( self::t( 'rooms' ), array( 'id' => $room_id ) ); // phpcs:ignore
		} elseif ( (int) $room['created_by'] === $uid ) {
			$wpdb->update( self::t( 'rooms' ), array( 'created_by' => $left[0] ), array( 'id' => $room_id ) ); // phpcs:ignore
		}
		return true;
	}

	/* ------------------------------------------------------------------ daily quest */

	public static function quest() {
		$q = get_option( 'sawa_tr_quest', array() );
		if ( empty( $q['day'] ) || $q['day'] !== Sawa_Tracker_Game::today() || '' === trim( (string) ( $q['text'] ?? '' ) ) ) {
			return null;
		}
		return array(
			'text' => (string) $q['text'],
			'sp'   => max( 0, (int) ( $q['sp'] ?? 2 ) ),
		);
	}

	public static function quest_done( $uid ) {
		return Sawa_Tracker_Game::m( $uid, 'quest_day', '' ) === Sawa_Tracker_Game::today();
	}

	public static function complete_quest( $uid, $note ) {
		$q = self::quest();
		if ( ! $q ) {
			return new WP_Error( 'none', 'مفيش مهمة النهارده.' );
		}
		if ( self::quest_done( $uid ) ) {
			return new WP_Error( 'done', 'إنت خلّصت مهمة النهارده خلاص.' );
		}
		Sawa_Tracker_Game::set( $uid, 'quest_day', Sawa_Tracker_Game::today() );
		Sawa_Tracker_Game::set( $uid, 'sp', (int) Sawa_Tracker_Game::m( $uid, 'sp', 0 ) + $q['sp'] );
		Sawa_Tracker_Game::event(
			$uid,
			'quest_done',
			null,
			array(
				'note' => mb_substr( self::filter_words( sanitize_text_field( $note ) ), 0, 200 ),
				'sp'   => $q['sp'],
			)
		);
		return $q['sp'];
	}

	/* ------------------------------------------------------------------ Skool daily post */

	public static function daily_post() {
		global $wpdb;
		$G     = 'Sawa_Tracker_Game';
		$today = $G::today();
		$yday  = $G::add_days( $today, -1 );
		$days  = $G::table( 'days' );
		$y     = $wpdb->get_row( $wpdb->prepare( "SELECT COUNT(*) AS n, COALESCE(SUM(minutes),0) AS m FROM $days WHERE day = %s AND minutes > 0", $yday ) ); // phpcs:ignore
		$streaks = $G::board( 'consistency' );
		usort(
			$streaks,
			function ( $a, $b ) {
				return $b['streak'] <=> $a['streak'];
			}
		);
		$heroes = array_slice( array_filter( $streaks, function ( $r ) { return $r['streak'] >= 3; } ), 0, 3 );
		$boss   = $G::boss();
		$clans  = array_slice( self::standings(), 0, 3 );
		$q      = get_option( 'sawa_tr_quest', array() );
		$page   = get_option( 'sawa_tr_page', home_url( '/' ) );
		$lines  = array();
		$lines[] = '☀️ Daily check-in · ' . wp_date( 'l, j F' );
		$lines[] = '';
		$lines[] = sprintf( 'Yesterday %d of us studied for %s in total. 💪', (int) $y->n, floor( $y->m / 60 ) . 'h ' . ( $y->m % 60 ) . 'm' );
		if ( $heroes ) {
			$lines[] = '🔥 Streak heroes: ' . implode( ', ', array_map( function ( $r ) { return $r['name'] . ' (' . $r['streak'] . ' days)'; }, $heroes ) );
		}
		if ( $boss['defeated'] ) {
			$lines[] = sprintf( '%s We defeated %s this week! A new boss arrives soon.', $boss['icon'], $boss['name'] );
		} else {
			$lines[] = sprintf( '%s %s has %s HP left. Every minute you study is a hit!', $boss['icon'], $boss['name'], number_format( max( 0, $boss['hp'] - $boss['damage'] ) ) );
		}
		if ( $clans ) {
			$medals  = array( '🥇', '🥈', '🥉' );
			$lines[] = '🛡️ Clan race this week: ' . implode( '  ', array_map( function ( $c, $i ) use ( $medals ) { return $medals[ $i ] . ' ' . $c['emoji'] . ' ' . $c['name']; }, $clans, array_keys( $clans ) ) );
		}
		if ( ! empty( $q['day'] ) && $q['day'] === $today && '' !== trim( (string) $q['text'] ) ) {
			$lines[] = '';
			$lines[] = '🎯 Today\'s quest (+' . (int) $q['sp'] . ' SP): ' . $q['text'];
		}
		$lines[] = '';
		$lines[] = '👉 Log your day on the tracker: ' . $page;
		$lines[] = 'Comment "done ✅" below when you finish!';
		return implode( "\n", $lines );
	}

	/* ------------------------------------------------------------------ reminders */

	/** Runs every hour: emails students who asked for a reminder at this hour and haven't studied today. */
	public static function send_reminders() {
		$hour  = (int) wp_date( 'G' );
		$today = Sawa_Tracker_Game::today();
		$page  = get_option( 'sawa_tr_page', home_url( '/' ) );
		$ids   = get_users(
			array(
				'meta_key'   => 'sawa_remind_hour', // phpcs:ignore
				'meta_value' => (string) $hour, // phpcs:ignore
				'fields'     => 'ID',
			)
		);
		foreach ( $ids as $uid ) {
			$uid = (int) $uid;
			if ( ! Sawa_Tracker_Game::is_member( $uid ) || Sawa_Tracker_Game::m( $uid, 'reminded', '' ) === $today ) {
				continue;
			}
			$l = Sawa_Tracker_Game::live( $uid );
			if ( $l['studiedToday'] ) {
				continue;
			}
			$u = get_userdata( $uid );
			Sawa_Tracker_Game::set( $uid, 'reminded', $today );
			wp_mail(
				$u->user_email,
				$l['streak'] > 0 ? sprintf( 'حافظ على ستريك الـ %d يوم بتاعك', $l['streak'] ) : 'عشر دقايق انجليزي النهارده؟',
				sprintf(
					"أهلًا يا %s،\n\n%s حتى ٥ دقايق بتتحسب يوم مذاكرة.\n\nسجّلها هنا: %s\n\nإنت اللي طلبت التذكير ده. تقدر تقفله من إعدادات التراكر.\nسوا انجليش",
					$u->first_name ? $u->first_name : $u->display_name,
					$l['streak'] > 0 ? sprintf( 'عندك ستريك %d يوم وصحة العادة %d%%.', $l['streak'], $l['health'] ) : 'الكلان بتاعك بيذاكر النهارده.',
					$page
				)
			);
		}
	}
}
