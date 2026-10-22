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

	public static function t( $n ) {
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
			leader_id bigint(20) unsigned NOT NULL DEFAULT 0,
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
			duration smallint(5) unsigned NOT NULL DEFAULT 0,
			reply_to bigint(20) unsigned NOT NULL DEFAULT 0,
			thread_id bigint(20) unsigned NOT NULL DEFAULT 0,
			mentions varchar(500) NOT NULL DEFAULT '',
			transcript text,
			kind varchar(10) NOT NULL DEFAULT '',
			media varchar(300) NOT NULL DEFAULT '',
			orig text,
			deleted tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY room (room_id,id),
			KEY thread (thread_id,id)
			) $c;"
		);
		// Threads a student follows (started, wrote in, or tapped Follow) and how far they have read.
		dbDelta(
			'CREATE TABLE ' . self::t( 'thread_reads' ) . " (
			thread_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			last_read bigint(20) unsigned NOT NULL DEFAULT 0,
			followed tinyint(1) NOT NULL DEFAULT 1,
			PRIMARY KEY  (thread_id,user_id),
			KEY user (user_id,followed)
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
		dbDelta(
			'CREATE TABLE ' . self::t( 'msg_reacts' ) . " (
			message_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			emoji varchar(16) NOT NULL,
			PRIMARY KEY  (message_id,user_id,emoji),
			KEY msg (message_id)
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

	/** The clan leader: the one Sherif picked in wp-admin, or else the member with the most study days. */
	public static function clan_leader( $clan_id ) {
		$c       = self::clan( $clan_id );
		$members = self::clan_members( $clan_id );
		$lead    = (int) ( $c['leader_id'] ?? 0 );
		if ( $lead && in_array( $lead, $members, true ) ) {
			return $lead;
		}
		$best = 0;
		$most = -1;
		foreach ( $members as $uid ) {
			$d = Sawa_Tracker_Game::study_days( $uid );
			if ( $d > $most ) {
				$most = $d;
				$best = $uid;
			}
		}
		return $best;
	}

	public static function set_clan_leader( $clan_id, $uid ) {
		global $wpdb;
		$wpdb->update( self::t( 'clans' ), array( 'leader_id' => (int) $uid ), array( 'id' => (int) $clan_id ) ); // phpcs:ignore
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
		$out['leader'] = self::clan_leader( $clan_id );
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
		if ( 'town' === $room['type'] ) {
			return Sawa_Tracker_World::reached( $uid ) >= (int) $room['clan_id'];
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
		foreach ( $wpdb->get_col( $wpdb->prepare( 'SELECT r.id FROM ' . self::t( 'rooms' ) . ' r JOIN ' . self::t( 'room_members' ) . " m ON m.room_id = r.id WHERE r.type IN ('group','party') AND m.user_id = %d ORDER BY r.id", $uid ) ) as $g ) { // phpcs:ignore
			$ids[] = (int) $g;
		}
		$out     = array();
		$threads = array();
		foreach ( self::thread_inbox( $uid ) as $th ) {
			$threads[ $th['room'] ] = ( $threads[ $th['room'] ] ?? 0 ) + $th['unread'];
		}
		foreach ( array_unique( array_filter( $ids ) ) as $id ) { // the town chat in the game is the community room now
			$r    = self::room( $id );
			$read = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT last_read FROM ' . self::t( 'reads' ) . ' WHERE room_id = %d AND user_id = %d', $id, $uid ) ); // phpcs:ignore
			$last = $wpdb->get_row( $wpdb->prepare( 'SELECT id, user_id, body, audio, created_at FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND thread_id = 0 AND deleted = 0 ORDER BY id DESC LIMIT 1', $id ), ARRAY_A ); // phpcs:ignore
			$unread = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND thread_id = 0 AND id > %d AND user_id <> %d AND deleted = 0', $id, $read, $uid ) ); // phpcs:ignore
			$row  = array(
				'id'     => (int) $id,
				'type'   => $r['type'],
				'name'   => 'public' === $r['type'] ? 'Community' : $r['name'],
				'unread' => min( 99, $unread ),
				'threadUnread' => (int) ( $threads[ (int) $id ] ?? 0 ),
				'mentions' => (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND thread_id = 0 AND id > %d AND user_id <> %d AND deleted = 0 AND (mentions LIKE %s OR mentions LIKE %s OR mentions LIKE %s)', $id, $read, $uid, '%' . $wpdb->esc_like( ',' . $uid . ',' ) . '%', '%,all,%', '%,clan,%' ) ), // phpcs:ignore
				'last'   => $last ? array(
					'who'  => Sawa_Tracker_Game::person( (int) $last['user_id'] )['name'],
					'text' => $last['audio'] ? '🎤 Voice message' : ( '' !== (string) $last['body'] ? wp_trim_words( (string) $last['body'], 10, '…' ) : 'Sticker' ),
					'at'   => mysql2date( 'c', $last['created_at'] ),
				) : null,
			);
			if ( 'clan' === $r['type'] ) {
				$c             = self::clan( (int) $r['clan_id'] );
				$row['emoji']  = $c ? $c['emoji'] : '🛡️';
				$row['leader'] = self::clan_leader( (int) $r['clan_id'] );
			} elseif ( 'town' === $r['type'] ) {
				$row['members'] = array();
			} elseif ( 'group' === $r['type'] || 'party' === $r['type'] ) {
				$row['members']  = array_map( array( 'Sawa_Tracker_Game', 'person' ), self::group_members( $id ) );
				$row['owner']    = (int) $r['created_by'];
			}
			$out[] = $row;
		}
		return $out;
	}

	public static function message_out( $m ) {
		$out = array(
			'id'         => (int) $m['id'],
			'who'        => Sawa_Tracker_Game::person( (int) $m['user_id'] ),
			'body'       => $m['deleted'] ? '' : (string) $m['body'],
			'audio'      => $m['deleted'] ? '' : (string) $m['audio'],
			'dur'        => (int) ( $m['duration'] ?? 0 ),
			'transcript' => $m['deleted'] ? '' : (string) ( $m['transcript'] ?? '' ),
			'kind'       => $m['deleted'] ? '' : (string) ( $m['kind'] ?? '' ),
			'media'      => $m['deleted'] ? '' : (string) ( $m['media'] ?? '' ),
			// Written in Arabic and sent after AI translation; only the writer sees the original.
			'translated' => ! $m['deleted'] && '' !== (string) ( $m['orig'] ?? '' ),
			'orig'       => ! $m['deleted'] && (int) $m['user_id'] === get_current_user_id() ? (string) ( $m['orig'] ?? '' ) : '',
			'gone'       => (bool) $m['deleted'],
			'thread'     => (int) ( $m['thread_id'] ?? 0 ),
			'at'         => mysql2date( 'c', $m['created_at'] ),
		);
		// Mentions: the names to highlight (@Name), @everyone / @clan, and whether this message pings the viewer.
		$tags = array_values( array_filter( explode( ',', (string) ( $m['mentions'] ?? '' ) ) ) );
		if ( $tags && ! $m['deleted'] ) {
			$ids          = array_map( 'intval', array_filter( $tags, 'is_numeric' ) );
			$out['tags']  = array_values( array_filter( array_map( function ( $id ) { $u = get_userdata( $id ); return $u ? $u->display_name : ''; }, $ids ) ) );
			$out['ping']  = in_array( 'all', $tags, true ) ? 'everyone' : ( in_array( 'clan', $tags, true ) ? 'clan' : '' );
			$out['pingsMe'] = (int) $m['user_id'] !== get_current_user_id() && ( '' !== $out['ping'] || in_array( get_current_user_id(), $ids, true ) );
		}
		if ( ! empty( $m['reply_to'] ) ) {
			$p = self::message_row( (int) $m['reply_to'] );
			if ( $p ) {
				$out['reply'] = array(
					'id'   => (int) $p['id'],
					'who'  => Sawa_Tracker_Game::person( (int) $p['user_id'] )['name'],
					'text' => $p['deleted'] ? '' : ( '' !== (string) $p['body'] ? wp_trim_words( (string) $p['body'], 14, '…' ) : ( 'sticker' === ( $p['kind'] ?? '' ) ? self::sticker_label( $p['media'] ) : ( 'gif' === ( $p['kind'] ?? '' ) ? 'GIF' : '' ) ) ),
					'voice' => '' !== (string) $p['audio'],
					'gone' => (bool) $p['deleted'],
				);
			}
		}
		return $out;
	}

	public static function message_row( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'messages' ) . ' WHERE id = %d', $id ), ARRAY_A ); // phpcs:ignore
	}

	/** Franco-Arabic: Arabic written with English letters and numbers ("ana 3ayez aroo7"). */
	public static function franco( $text ) {
		static $words = null;
		if ( null === $words ) {
			$words = array_flip( explode( ' ', 'ana enta enty inta inti ente ehna e7na howa hwa heya hya homa 3ayez 3ayz 3awz 3awez 3ayza 3awza msh mesh mish mush ezay ezayak ezayek izzay izay keda kda kedda leh leih lih feen fein fen ahe aho ahy ahoh yalla yala yallah khalas 5alas 5las tayeb tayyeb tyb awy awi 2awy 2awi kteer ktir ketir wallahi wallah walahy walla inshallah insha2allah habibi 7abibi habibti mafeesh mafish mafesh delwa2ty dlwa2ty delwa2ti delwaqti dlw2ty bokra bokhra embare7 emba re7 ba2a ba2ah bardo kaman kman lessa lissa 3shan 3ashan alashan 3alashan 3la 3ala ma3a m3a ma3ak ma3aya ya3ni yaani ya3ny yani tamam mashy mashi ma3lesh maalesh ma3lsh shokran shukran sho2ran a7san ahsan gamed gamda gameel 7elw helw 7lw ra7 roo7 aroo7 bta3 bta3y bta3ak beta3 ezayko 3amel 3amla 3amlen 3amlo eih izayak sabah masa2 lazem lazm momken mmkn' ) );
		}
		preg_match_all( "/[a-z0-9']+/", strtolower( (string) $text ), $m );
		$hits  = 0;
		$mixed = 0;
		foreach ( $m[0] as $w ) {
			$hits  += isset( $words[ $w ] ) ? 1 : 0;
			$mixed += preg_match( '/[a-z][2356789]|[2356789][a-z]/', $w ) && ! preg_match( '/^[0-9]+(st|nd|rd|th|s|am|pm|k|m)$/', $w ) ? 1 : 0;
		}
		return $mixed > 0 || $hits >= 2 || ( $hits >= 1 && count( $m[0] ) <= 3 );
	}

	/** Share of letters in Arabic script (0–1). */
	public static function arabic_share( $text ) {
		$ar  = preg_match_all( '/[\x{0600}-\x{06FF}\x{0750}-\x{077F}\x{FB50}-\x{FDFF}\x{FE70}-\x{FEFF}]/u', (string) $text );
		$all = preg_match_all( '/\p{L}/u', (string) $text );
		return $all ? $ar / $all : 0;
	}

	/** Spam protection: how many of the latest messages in this room are this student's, in a row (last 15 minutes). */
	private static function in_a_row( $uid, $room_id, $thread = 0 ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT user_id, created_at FROM ' . self::t( 'messages' ) . ' WHERE room_id = %d AND thread_id = %d AND deleted = 0 ORDER BY id DESC LIMIT 40', $room_id, $thread ), ARRAY_A ); // phpcs:ignore
		$n    = 0;
		$from = strtotime( Sawa_Tracker_Game::now_mysql() ) - 15 * MINUTE_IN_SECONDS;
		foreach ( (array) $rows as $r ) {
			if ( (int) $r['user_id'] !== $uid || strtotime( $r['created_at'] ) < $from ) {
				break;
			}
			$n++;
		}
		return $n;
	}

	public static function messages( $room_id, $after = 0, $before = 0 ) {
		global $wpdb;
		$t = self::t( 'messages' );
		if ( $after ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE room_id = %d AND thread_id = 0 AND id > %d ORDER BY id ASC LIMIT 100", $room_id, $after ), ARRAY_A ); // phpcs:ignore
		} else {
			$cond = $before ? $wpdb->prepare( 'AND id < %d', $before ) : '';
			$rows = array_reverse( $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t WHERE room_id = %d AND thread_id = 0 $cond ORDER BY id DESC LIMIT 50", $room_id ), ARRAY_A ) ); // phpcs:ignore
		}
		return array_map( array( __CLASS__, 'message_out' ), $rows );
	}

	/* ------------------------------------------------------------------ threads (any message can start one) */

	/** Replies in a thread, oldest first. */
	public static function thread_messages( $root_id, $after = 0 ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'messages' ) . ' WHERE thread_id = %d AND id > %d ORDER BY id ASC LIMIT 300', $root_id, $after ), ARRAY_A ); // phpcs:ignore
		return array_map( array( __CLASS__, 'message_out' ), $rows );
	}

	/** Unread replies in a thread for this student (replies by others after their read marker). */
	private static function thread_unread( $uid, $root_id, $last_read ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'messages' ) . ' WHERE thread_id = %d AND id > %d AND user_id <> %d AND deleted = 0', $root_id, $last_read, $uid ) ); // phpcs:ignore
	}

	/** "N replies · last reply 5m ago" for the threads under the messages of a room: { rootId: {n, last, unread, following} }. */
	public static function thread_meta( $room_id, $uid, $since_id = 0 ) {
		global $wpdb;
		$m    = self::t( 'messages' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT thread_id, COUNT(*) n, MAX(created_at) last FROM $m WHERE room_id = %d AND thread_id >= %d AND thread_id > 0 AND deleted = 0 GROUP BY thread_id", $room_id, $since_id ), ARRAY_A ); // phpcs:ignore
		if ( ! $rows ) {
			return (object) array();
		}
		$ids   = implode( ',', array_map( 'intval', wp_list_pluck( $rows, 'thread_id' ) ) );
		$reads = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT thread_id, last_read, followed FROM ' . self::t( 'thread_reads' ) . " WHERE user_id = %d AND thread_id IN ($ids)", $uid ), ARRAY_A ) as $x ) { // phpcs:ignore
			$reads[ (int) $x['thread_id'] ] = $x;
		}
		$out = array();
		foreach ( $rows as $x ) {
			$tid         = (int) $x['thread_id'];
			$follow      = ! empty( $reads[ $tid ]['followed'] );
			$out[ $tid ] = array(
				'n'         => (int) $x['n'],
				'last'      => mysql2date( 'c', $x['last'] ),
				'unread'    => $follow ? self::thread_unread( $uid, $tid, (int) $reads[ $tid ]['last_read'] ) : 0,
				'following' => $follow,
			);
		}
		return (object) $out;
	}

	/** Threads this student follows that have replies, newest first, with unread counts. */
	public static function thread_inbox( $uid ) {
		global $wpdb;
		$m    = self::t( 'messages' );
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT r.thread_id, r.last_read, MAX(m.id) last_id, MAX(m.created_at) last, COUNT(*) n FROM ' . self::t( 'thread_reads' ) . " r JOIN $m m ON m.thread_id = r.thread_id AND m.deleted = 0 WHERE r.user_id = %d AND r.followed = 1 GROUP BY r.thread_id, r.last_read ORDER BY last_id DESC LIMIT 20", $uid ), ARRAY_A ); // phpcs:ignore
		$out  = array();
		foreach ( (array) $rows as $x ) {
			$root = self::message_row( (int) $x['thread_id'] );
			if ( ! $root || ! self::can_access( $uid, self::room( (int) $root['room_id'] ) ) ) {
				continue;
			}
			$out[] = array(
				'id'     => (int) $root['id'],
				'room'   => (int) $root['room_id'],
				'who'    => Sawa_Tracker_Game::person( (int) $root['user_id'] )['name'],
				'text'   => $root['deleted'] ? '' : ( '' !== (string) $root['body'] ? wp_trim_words( (string) $root['body'], 10, '…' ) : ( '' !== (string) $root['audio'] ? '🎤' : self::sticker_label( $root['media'] ) ) ),
				'n'      => (int) $x['n'],
				'last'   => mysql2date( 'c', $x['last'] ),
				'unread' => (int) $x['last_id'] > (int) $x['last_read'] ? min( 99, self::thread_unread( $uid, (int) $root['id'], (int) $x['last_read'] ) ) : 0,
			);
		}
		return $out;
	}

	/** Follows a thread (or stops following). $last_read moves the read marker forward. */
	public static function follow_thread( $uid, $root_id, $on = true, $last_read = 0 ) {
		global $wpdb;
		$t = self::t( 'thread_reads' );
		$wpdb->query( $wpdb->prepare( "INSERT INTO $t (thread_id, user_id, last_read, followed) VALUES (%d, %d, %d, %d) ON DUPLICATE KEY UPDATE last_read = GREATEST(last_read, VALUES(last_read)), followed = VALUES(followed)", $root_id, $uid, $last_read, $on ? 1 : 0 ) ); // phpcs:ignore
	}

	/** Moves the read marker of a followed thread forward. */
	public static function read_thread( $uid, $root_id, $msg_id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::t( 'thread_reads' ) . ' SET last_read = %d WHERE thread_id = %d AND user_id = %d AND last_read < %d', $msg_id, $root_id, $uid, $msg_id ) ); // phpcs:ignore
	}

	public static function thread_following( $uid, $root_id ) {
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT followed FROM ' . self::t( 'thread_reads' ) . ' WHERE thread_id = %d AND user_id = %d', $root_id, $uid ) ); // phpcs:ignore
	}

	/** The message a thread hangs on, if this student may see it (a thread reply cannot start its own thread). */
	public static function thread_root( $uid, $root_id ) {
		$root = self::message_row( (int) $root_id );
		if ( ! $root || (int) $root['thread_id'] || ! self::can_access( $uid, self::room( (int) $root['room_id'] ) ) ) {
			return null;
		}
		return $root;
	}

	/**
	 * Tells everyone who follows a thread about a new reply, once per batch: only followers who had read
	 * everything before it get a bell notification (the rest already see the unread marker).
	 */
	private static function notify_thread( $uid, $root, $id, $prev_last, $skip, $data ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT user_id, last_read FROM ' . self::t( 'thread_reads' ) . ' WHERE thread_id = %d AND followed = 1 AND user_id <> %d LIMIT 50', $root['id'], $uid ), ARRAY_A ); // phpcs:ignore
		foreach ( (array) $rows as $r ) {
			$to = (int) $r['user_id'];
			if ( $to === $skip || (int) $r['last_read'] < $prev_last ) {
				continue;
			}
			Sawa_Tracker_Game::event( $uid, 'thread_reply', $to, $data + array( 'thread' => (int) $root['id'], 'mine' => (int) $root['user_id'] === $to ) );
		}
	}

	const REACTS = array( '👍', '❤️', '😂', '😮', '👏', '🔥' );

	/** Built-in sticker pack: big emoji + a useful English phrase, so every sticker teaches something. */
	const STICKERS = array(
		'welldone' => array( '👏', 'Well done!' ),
		'fire'     => array( '🔥', 'You\'re on fire!' ),
		'keepgoing' => array( '💪', 'Keep going!' ),
		'lol'      => array( '😂', 'LOL, that\'s hilarious!' ),
		'same'     => array( '🤝', 'Same here!' ),
		'thanks'   => array( '🙏', 'Thanks a lot!' ),
		'morning'  => array( '☀️', 'Good morning!' ),
		'night'    => array( '🌙', 'Good night!' ),
		'study'    => array( '📚', 'Study time!' ),
		'what'     => array( '🤔', 'What do you mean?' ),
		'noway'    => array( '😮', 'No way!' ),
		'love'     => array( '❤️', 'Love it!' ),
		'congrats' => array( '🎉', 'Congrats!' ),
		'tired'    => array( '😴', 'I\'m so tired…' ),
		'coffee'   => array( '☕', 'Coffee first.' ),
		'done'     => array( '✅', 'Done!' ),
		'gotit'    => array( '👌', 'Got it!' ),
		'sorry'    => array( '😅', 'Oops, my bad!' ),
		'agree'    => array( '💯', 'I totally agree.' ),
		'brb'      => array( '⏳', 'Be right back!' ),
	);

	public static function sticker_label( $id ) {
		return isset( self::STICKERS[ $id ] ) ? self::STICKERS[ $id ][0] . ' ' . self::STICKERS[ $id ][1] : '';
	}

	/** GIFs only from GIPHY's media servers. */
	public static function gif_ok( $url ) {
		return (bool) preg_match( '~^https://(media\d?|i)\.giphy\.com/[\w./-]+\.(gif|webp)(\?[\w=&.-]*)?$~', $url );
	}

	/** Reactions for the latest messages in a room: { msgId: [ {e, n, mine} ] }. */
	public static function reactions( $room_id, $uid, $since_id = 0, $thread = 0 ) {
		global $wpdb;
		$cond = $thread ? $wpdb->prepare( 'AND ( m.thread_id = %d OR m.id = %d )', $thread, $thread ) : '';
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT r.message_id, r.emoji, COUNT(*) n, SUM(r.user_id = %d) mine FROM ' . self::t( 'msg_reacts' ) . ' r JOIN ' . self::t( 'messages' ) . " m ON m.id = r.message_id WHERE m.room_id = %d AND m.id >= %d $cond GROUP BY r.message_id, r.emoji", $uid, $room_id, $since_id ), ARRAY_A ); // phpcs:ignore
		$out  = array();
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['message_id'] ][] = array( 'e' => $r['emoji'], 'n' => (int) $r['n'], 'mine' => (bool) $r['mine'] );
		}
		return (object) $out;
	}

	public static function toggle_react( $uid, $msg_id, $emoji ) {
		global $wpdb;
		if ( ! in_array( $emoji, self::REACTS, true ) ) {
			return new WP_Error( 'emoji', 'الريأكشن ده مش موجود.' );
		}
		$t   = self::t( 'msg_reacts' );
		$has = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE message_id = %d AND user_id = %d AND emoji = %s", $msg_id, $uid, $emoji ) ); // phpcs:ignore
		if ( $has ) {
			$wpdb->delete( $t, array( 'message_id' => $msg_id, 'user_id' => $uid, 'emoji' => $emoji ) ); // phpcs:ignore
		} else {
			$wpdb->insert( $t, array( 'message_id' => $msg_id, 'user_id' => $uid, 'emoji' => $emoji ) ); // phpcs:ignore
		}
		return true;
	}

	public static function filter_words( $text ) {
		$words = array_filter( array_map( 'trim', explode( ',', (string) Sawa_Tracker_Game::settings()['blocked_words'] ) ) );
		foreach ( $words as $w ) {
			$text = preg_replace( '/' . preg_quote( $w, '/' ) . '/iu', str_repeat( '*', max( 3, mb_strlen( $w ) ) ), $text );
		}
		return $text;
	}

	const MENTION_MAX = 10;

	/**
	 * Who a message mentions: [ user ids, all | clan | empty ], or an error.
	 * @Name comes from the suggestion list of the composer ($picked ids) and must still be in the text;
	 * @everyone is for admins; @clan is for the clan leader (or an admin), in the clan chat, once per 10 minutes.
	 */
	private static function mentions( $uid, $room, $body, $picked ) {
		$admin = user_can( $uid, 'manage_options' );
		$ping  = '';
		if ( preg_match( '/(^|[^\w])@everyone\b/i', $body ) ) {
			if ( ! $admin ) {
				return new WP_Error( 'everyone', 'منشن @everyone للأدمن بس. اعمل منشن لزميلك باسمه.' );
			}
			$ping = 'all';
		} elseif ( preg_match( '/(^|[^\w])@clan\b/i', $body ) ) {
			if ( 'clan' !== $room['type'] ) {
				return new WP_Error( 'clan', 'منشن @clan بيشتغل في شات الكلان بس.' );
			}
			if ( ! $admin && self::clan_leader( (int) $room['clan_id'] ) !== $uid ) {
				return new WP_Error( 'clan', 'قائد الكلان بس هو اللي يقدر يعمل منشن @clan.' );
			}
			if ( ! $admin && get_transient( 'sawa_tr_clanping_' . $uid ) ) {
				return new WP_Error( 'clan', 'عملت منشن للكلان من شوية. استنى ١٠ دقايق.' );
			}
			$ping = 'clan';
		}
		$ids = array();
		foreach ( array_unique( array_map( 'intval', (array) $picked ) ) as $id ) {
			$u = $id && $id !== $uid ? get_userdata( $id ) : null;
			if ( $u && false !== mb_stripos( $body, '@' . $u->display_name ) && self::can_access( $id, $room ) ) {
				$ids[] = $id;
			}
			if ( count( $ids ) >= self::MENTION_MAX ) {
				break;
			}
		}
		return array( $ids, $ping );
	}

	/** Everyone a @everyone / @clan reaches in this room. */
	private static function ping_targets( $room, $ping ) {
		if ( 'clan' === $ping || 'clan' === $room['type'] ) {
			return self::clan_members( (int) $room['clan_id'] );
		}
		if ( 'group' === $room['type'] || 'party' === $room['type'] ) {
			return self::group_members( (int) $room['id'] );
		}
		$out = array();
		foreach ( Sawa_Tracker_Game::member_ids() as $id ) {
			if ( 'public' === $room['type'] || self::can_access( $id, $room ) ) {
				$out[] = (int) $id;
			}
		}
		return $out;
	}

	public static function send( $uid, $room_id, $body, $audio_url = '', $reply_to = 0, $duration = 0, $kind = '', $media = '', $orig = '', $thread = 0, $mentions = array() ) {
		global $wpdb;
		$room = self::room( $room_id );
		if ( ! self::can_access( $uid, $room ) ) {
			return new WP_Error( 'room', 'إنت مش في الشات ده.' );
		}
		$is_admin = user_can( $uid, 'manage_options' );
		$root     = null;
		if ( $thread ) {
			$root = self::thread_root( $uid, $thread );
			if ( ! $root || (int) $root['room_id'] !== (int) $room_id ) {
				return new WP_Error( 'thread', 'ملقيناش الثريد ده.' );
			}
		}
		if ( ! Sawa_Tracker_Game::settings()['chat_enabled'] && ! user_can( $uid, 'manage_options' ) ) {
			return new WP_Error( 'off', 'الشات متوقف دلوقتي.' );
		}
		$muted = (string) Sawa_Tracker_Game::m( $uid, 'muted_until', '' );
		if ( $muted && $muted >= Sawa_Tracker_Game::today() ) {
			return new WP_Error( 'muted', sprintf( 'تقدر تقرا الشات بس مش هتقدر تبعت لحد %s.', wp_date( 'M j', strtotime( $muted . ' 12:00' ) ) ) );
		}
		$body = trim( mb_substr( sanitize_textarea_field( $body ), 0, 1000 ) );
		// The chat is English only: Arabic (and Franco-Arabic) is written in the translate box and sent as English.
		if ( ! $is_admin && ( self::arabic_share( $body ) > 0 || ( '' === trim( (string) $orig ) && self::franco( $body ) ) ) ) {
			return new WP_Error( 'arabic', 'الشات بالإنجليزي بس. اكتب بالعربي ودوس إرسال، وهنترجمها لك بالإنجليزي قبل ما تتبعت.' );
		}
		$orig = '' !== $body ? trim( mb_substr( sanitize_textarea_field( (string) $orig ), 0, 1000 ) ) : '';
		if ( 'sticker' === $kind ) {
			if ( ! isset( self::STICKERS[ $media ] ) ) {
				return new WP_Error( 'sticker', 'الستيكر ده مش موجود.' );
			}
			$body = '';
		} elseif ( 'gif' === $kind ) {
			if ( ! self::gif_ok( $media ) ) {
				return new WP_Error( 'gif', 'الـ GIF ده مش راضي يتبعت.' );
			}
			$body = '';
		} else {
			$kind  = '';
			$media = '';
		}
		if ( '' === $body && '' === $audio_url && '' === $kind ) {
			return new WP_Error( 'empty', 'اكتب رسالة الأول.' );
		}
		if ( ! $is_admin && '' === (string) Sawa_Tracker_Game::m( $uid, 'avatar', '' ) ) {
			return new WP_Error( 'photo', 'ارفع صورتك الأول من الإعدادات عشان تقدر تكتب في الشات.' );
		}
		$max_row = (int) ( Sawa_Tracker_Game::settings()['chat_max_row'] ?? 5 );
		if ( ! $is_admin && self::in_a_row( $uid, $room_id, $root ? (int) $root['id'] : 0 ) >= $max_row ) {
			return new WP_Error( 'row', sprintf( 'بعت %d رسايل ورا بعض. استنى حد يرد عليك الأول، أو جرب كمان شوية.', $max_row ) );
		}
		$parent = null;
		if ( $reply_to ) {
			$parent = self::message_row( (int) $reply_to );
			if ( ! $parent || (int) $parent['room_id'] !== (int) $room_id || $parent['deleted'] ) {
				$parent = null;
			}
			// Inside a thread you can quote messages of that thread only.
			if ( $parent && $root && (int) $parent['id'] !== (int) $root['id'] && (int) $parent['thread_id'] !== (int) $root['id'] ) {
				$parent = null;
			}
		}
		$tagged = '' !== $body ? self::mentions( $uid, $room, $body, $mentions ) : array( array(), '' );
		if ( is_wp_error( $tagged ) ) {
			return $tagged;
		}
		$prev_last = $root ? (int) $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(id) FROM ' . self::t( 'messages' ) . ' WHERE thread_id = %d', $root['id'] ) ) : 0; // phpcs:ignore
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
				'duration'   => max( 0, min( 120, (int) $duration ) ),
				'reply_to'   => $parent ? (int) $parent['id'] : 0,
				'thread_id'  => $root ? (int) $root['id'] : 0,
				'mentions'   => $tagged[0] || $tagged[1] ? ',' . implode( ',', array_merge( $tagged[0], $tagged[1] ? array( $tagged[1] ) : array() ) ) . ',' : '',
				'kind'       => $kind,
				'media'      => $media,
				'orig'       => $orig,
				'created_at' => Sawa_Tracker_Game::now_mysql(),
			)
		);
		$id   = (int) $wpdb->insert_id;
		$note = array(
			'room'    => (int) $room_id,
			'msg'     => $id,
			'text'    => '' !== $body ? wp_trim_words( self::filter_words( $body ), 12, '…' ) : '',
			'voice'   => '' !== $audio_url,
			'sticker' => 'sticker' === $kind ? self::sticker_label( $media ) : ( 'gif' === $kind ? 'GIF' : '' ),
		);
		if ( $parent && (int) $parent['user_id'] !== $uid ) {
			// Notification for the author of the message being replied to (shows in their bell).
			Sawa_Tracker_Game::event( $uid, 'reply', (int) $parent['user_id'], $note + ( $root ? array( 'thread' => (int) $root['id'] ) : array() ) );
		}
		if ( $root ) {
			// The starter of a thread follows it from the first reply; whoever writes in a thread follows it too.
			$wpdb->query( $wpdb->prepare( 'INSERT IGNORE INTO ' . self::t( 'thread_reads' ) . ' (thread_id, user_id, last_read, followed) VALUES (%d, %d, %d, 1)', $root['id'], $root['user_id'], $root['id'] ) ); // phpcs:ignore
			self::notify_thread( $uid, $root, $id, $prev_last, $parent ? (int) $parent['user_id'] : 0, $note );
			self::follow_thread( $uid, (int) $root['id'], true, $id );
		}
		// Mentions: a bell notification for each person (they also follow the thread, if it is in one).
		$told = $parent ? array( (int) $parent['user_id'] ) : array();
		$to   = $tagged[0];
		if ( $tagged[1] ) {
			$to = array_merge( $to, self::ping_targets( $room, $tagged[1] ) );
			if ( 'clan' === $tagged[1] ) {
				set_transient( 'sawa_tr_clanping_' . $uid, 1, 10 * MINUTE_IN_SECONDS );
			}
		}
		foreach ( array_unique( $to ) as $who ) {
			if ( $who === $uid || in_array( $who, $told, true ) ) {
				continue;
			}
			$type = in_array( $who, $tagged[0], true ) ? 'mention' : ( 'all' === $tagged[1] ? 'mention_all' : 'mention_clan' );
			Sawa_Tracker_Game::event( $uid, $type, $who, $note + ( $root ? array( 'thread' => (int) $root['id'] ) : array() ) );
			if ( $root && in_array( $who, $tagged[0], true ) ) {
				$wpdb->query( $wpdb->prepare( 'INSERT IGNORE INTO ' . self::t( 'thread_reads' ) . ' (thread_id, user_id, last_read, followed) VALUES (%d, %d, %d, 1)', $root['id'], $who, $prev_last ? $prev_last : $root['id'] ) ); // phpcs:ignore
			}
		}
		do_action( 'sawa_tracker_message_sent', $uid, (int) $room_id, $id, $body, $audio_url );
		if ( ! $root ) {
			self::mark_read( $uid, $room_id, $id );
		}
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
			'sp'   => max( 0, (int) ( $q['sp'] ?? 2 ) ) * Sawa_Tracker_Game::SP_COINS, // coins
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
		Sawa_Tracker_Raids::add_coins( $uid, $q['sp'] );
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
			$lines[] = '🎯 Today\'s quest (+' . (int) $q['sp'] . ' 🪙): ' . $q['text'];
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
