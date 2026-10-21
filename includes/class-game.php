<?php
/**
 * The game rules: study days, habit health, streaks, levels, skills, the weekly boss and badges.
 *
 * One rule for everything: a student's finished days are "processed" exactly once, in order,
 * and each processed day stores the health and streak it ended with. The dashboard, the
 * leaderboard and the trend chart all read from that same record, so they always agree.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Game {

	/** Skill points became coins (one currency to spend): 1 SP = 3 coins. */
	const SP_COINS = 3;

	const ACTIVITIES = array(
		'Flashcards'            => array( 'emoji' => '🃏', 'cards' => true, 'color' => '#7c5cff' ),
		'Active Immersion'      => array( 'emoji' => '👀', 'cards' => false, 'color' => '#e0633a' ),
		'Passive Immersion'     => array( 'emoji' => '🎧', 'cards' => false, 'color' => '#2f8fd8' ),
		'Music'                 => array( 'emoji' => '🎵', 'cards' => false, 'color' => '#e3a21a' ),
		'Pronunciation/Grammar' => array( 'emoji' => '🗣️', 'cards' => false, 'color' => '#2aa876' ),
		'Others'                => array( 'emoji' => '📝', 'cards' => false, 'color' => '#8a8f98' ),
	);

	/** [level, study days needed, title] */
	const LEVELS = array(
		array( 1, 0, 'Apprentice' ),
		array( 2, 3, 'Novice' ),
		array( 3, 7, 'Adept' ),
		array( 4, 14, 'Skilled' ),
		array( 5, 21, 'Veteran' ),
		array( 6, 30, 'Expert' ),
		array( 7, 50, 'Master' ),
		array( 8, 75, 'Champion' ),
		array( 9, 100, 'Legend' ),
		array( 10, 150, 'Mythic' ),
	);

	const CLASSES = array(
		'warrior' => array(
			'name'    => 'Warrior',
			'icon'    => '⚔️',
			'tagline' => 'Protects streaks. Shields teammates from losing their progress.',
		),
		'healer'  => array(
			'name'    => 'Healer',
			'icon'    => '💚',
			'tagline' => 'Restores health. Lifts up teammates who are falling behind.',
		),
	);

	const BOSSES = array(
		array( 'The Procrastination Dragon', '🐉' ),
		array( 'The Grammar Goblin', '👺' ),
		array( 'The Silent Ghost', '👻' ),
		array( 'The Forgetful Fog', '🌀' ),
		array( 'The Accent Ogre', '👹' ),
		array( 'The Scroll Serpent', '🐍' ),
		array( 'The Perfectionist Golem', '🗿' ),
		array( 'The Fear Kraken', '🐙' ),
	);

	const BADGES = array(
		'first_log'   => array( 'First step', '🌱', 'Logged your first activity' ),
		'streak_7'    => array( '7-day streak', '🔥', 'Studied 7 days in a row' ),
		'streak_30'   => array( '30-day streak', '⚡', 'Studied 30 days in a row' ),
		'streak_100'  => array( '100-day streak', '👑', 'Studied 100 days in a row' ),
		'hours_10'    => array( '10 hours', '⏱️', '10 hours of study in total' ),
		'hours_50'    => array( '50 hours', '🏅', '50 hours of study in total' ),
		'hours_100'   => array( '100 hours', '🏆', '100 hours of study in total' ),
		'cards_1000'  => array( '1,000 cards', '🧠', 'Reviewed 1,000 flashcards' ),
		'helper_10'   => array( 'Helping hand', '🤝', 'Used 10 skills on other students' ),
		'boss_slayer' => array( 'Boss slayer', '🗡️', 'Helped defeat a weekly boss' ),
	);

	public static function skills() {
		return array(
			'warrior' => array(
				array( 'battle_stance', 'Battle Stance', '🛡️', 1, 'self', 2, 3, 'Freeze your own streak for 1 day', 'جمّد الستريك بتاعك ليوم واحد', 'freeze_self' ),
				array( 'shield_ally', 'Shield Ally', '🛡️', 3, 'other', 3, 3, 'Give another student a streak freeze', 'ادّي طالب تاني streak freeze', 'freeze_other' ),
				array( 'rally', 'Rally', '📣', 4, 'other', 2, 2, "Send a nudge to a student who hasn't studied today", 'ابعت تشجيع لطالب لسه مذاكرش النهارده', 'nudge' ),
				array( 'war_cry', 'War Cry', '⚔️', 5, 'other', 4, 2, "Boost another student's health by 10%", 'زوّد صحة طالب تاني بـ 10%', 'health_10' ),
				array( 'fortify', 'Fortify', '🏰', 7, 'other', 5, 5, 'Protect a student from health loss for 2 days', 'احمي طالب من نزول الصحة ليومين', 'shield_2' ),
				array( 'unbreakable', 'Unbreakable', '💎', 9, 'other', 8, 7, 'Ultimate: a streak freeze plus 3 days of health protection', 'الألتيميت: streak freeze + حماية صحة لـ 3 أيام', 'ultimate_warrior' ),
			),
			'healer'  => array(
				array( 'inner_peace', 'Inner Peace', '🧘', 1, 'self', 2, 3, 'Restore 10% of your own habit health', 'رجّع 10% من صحتك', 'health_self_10' ),
				array( 'heal', 'Heal', '💚', 3, 'other', 3, 2, "Restore 15% of another student's health", 'رجّع 15% من صحة طالب تاني', 'health_15' ),
				array( 'empower', 'Empower', '✨', 4, 'other', 2, 2, 'Give a student +2 bonus skill points on their next activity', 'ادّي طالب +2 نقاط مهارة على النشاط الجاي', 'sp_boost' ),
				array( 'revitalize', 'Revitalize', '💖', 5, 'other', 4, 3, 'Boost health by 10% and give a streak freeze', 'زوّد الصحة 10% وادّي streak freeze', 'health_10_freeze' ),
				array( 'sanctuary', 'Sanctuary', '🏛️', 7, 'other', 6, 7, 'Protect a student from health loss for 3 days', 'احمي طالب من نزول الصحة لـ 3 أيام', 'shield_3' ),
				array( 'guardian_angel', 'Guardian Angel', '👼', 9, 'other', 8, 7, 'Ultimate: restore 20% health plus 3 days of protection', 'الألتيميت: رجّع 20% صحة + حماية لـ 3 أيام', 'ultimate_healer' ),
			),
		);
	}

	public static function skill( $class, $id ) {
		foreach ( self::skills()[ $class ] ?? array() as $s ) {
			if ( $s[0] === $id ) {
				return array(
					'id'          => $s[0],
					'name'        => $s[1],
					'icon'        => $s[2],
					'unlock'      => $s[3],
					'target'      => $s[4],
					'cost'        => $s[5] * self::SP_COINS, // in coins
					'cooldown'    => $s[6],
					'description' => $s[7],
					'descriptionAr' => $s[8],
					'effect'      => $s[9],
				);
			}
		}
		return null;
	}

	/* ------------------------------------------------------------------ settings */

	public static function defaults() {
		return array(
			'daily_goal'   => 30,
			'gain_goal'    => 10,
			'gain_partial' => 7,
			'decay'        => 10,
			'start_health' => 50,
			'sp_daily_cap' => 6,
			'boss_hp'      => 3000,
			'notify_admin' => 1,
			'chat_enabled' => 1,
			'chat_max_row' => 5,
			'giphy_key'    => '',
			'blocked_words' => '',
			'skool_url'    => 'https://www.skool.com/sawa-english-7655',
			'clan_size'    => 8,
		);
	}

	public static function settings() {
		$s = get_option( 'sawa_tr_settings', array() );
		return wp_parse_args( is_array( $s ) ? $s : array(), self::defaults() );
	}

	/* ------------------------------------------------------------------ install */

	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'sawa_tr_' . $name;
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		dbDelta(
			'CREATE TABLE ' . self::table( 'logs' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			activity varchar(40) NOT NULL,
			minutes smallint(5) unsigned NOT NULL DEFAULT 0,
			cards int(10) unsigned NOT NULL DEFAULT 0,
			notes varchar(500) NOT NULL DEFAULT '',
			day date NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY user_day (user_id,day),
			KEY day (day)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::table( 'days' ) . " (
			user_id bigint(20) unsigned NOT NULL,
			day date NOT NULL,
			minutes int(10) unsigned NOT NULL DEFAULT 0,
			health tinyint(3) unsigned DEFAULT NULL,
			streak int(10) unsigned DEFAULT NULL,
			state varchar(10) NOT NULL DEFAULT '',
			finished tinyint(1) NOT NULL DEFAULT 0,
			mood_before tinyint(3) unsigned DEFAULT NULL,
			mood_after tinyint(3) unsigned DEFAULT NULL,
			teacher_note text,
			PRIMARY KEY  (user_id,day),
			KEY day (day)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::table( 'events' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			type varchar(20) NOT NULL,
			target_id bigint(20) unsigned DEFAULT NULL,
			data text,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY target (target_id,id),
			KEY user_type (user_id,type)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::table( 'reactions' ) . " (
			event_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			emoji varchar(16) NOT NULL,
			PRIMARY KEY  (event_id,user_id,emoji)
			) $c;"
		);
		Sawa_Tracker_Social::install();
		update_option( 'sawa_tr_db', SAWA_TR_DB );
	}

	/* ------------------------------------------------------------------ dates */

	public static function today() {
		return ( new DateTimeImmutable( 'now', wp_timezone() ) )->format( 'Y-m-d' );
	}

	public static function add_days( $day, $n ) {
		return ( new DateTimeImmutable( $day, wp_timezone() ) )->modify( ( $n >= 0 ? '+' : '' ) . (int) $n . ' days' )->format( 'Y-m-d' );
	}

	public static function now_mysql() {
		return current_time( 'mysql' );
	}

	public static function week_start( $day = null ) {
		$d     = new DateTimeImmutable( $day ? $day : self::today(), wp_timezone() );
		$start = (int) get_option( 'start_of_week', 6 );
		$diff  = ( (int) $d->format( 'w' ) - $start + 7 ) % 7;
		return $d->modify( '-' . $diff . ' days' )->format( 'Y-m-d' );
	}

	/* ------------------------------------------------------------------ members */

	public static function m( $uid, $key, $default = '' ) {
		$v = get_user_meta( $uid, 'sawa_' . $key, true );
		return ( '' === $v || null === $v || false === $v ) ? $default : $v;
	}

	public static function set( $uid, $key, $value ) {
		update_user_meta( $uid, 'sawa_' . $key, $value );
	}

	public static function is_member( $uid ) {
		return $uid && ( 'approved' === self::m( $uid, 'status' ) || user_can( $uid, 'manage_options' ) );
	}

	public static function goal( $uid ) {
		return max( 5, (int) self::m( $uid, 'goal', self::settings()['daily_goal'] ) );
	}

	public static function level_for( $study_days ) {
		$cur = self::LEVELS[0];
		$nxt = null;
		foreach ( self::LEVELS as $i => $l ) {
			if ( $study_days >= $l[1] ) {
				$cur = $l;
				$nxt = self::LEVELS[ $i + 1 ] ?? null;
			}
		}
		return array(
			'level'    => $cur[0],
			'title'    => $cur[2],
			'from'     => $cur[1],
			'next'     => $nxt ? $nxt[1] : null,
			'nextLevel' => $nxt ? $nxt[0] : null,
		);
	}

	/* ------------------------------------------------------------------ day rows */

	private static function day_row( $uid, $day ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table( 'days' ) . ' WHERE user_id = %d AND day = %s', $uid, $day ), ARRAY_A ); // phpcs:ignore
	}

	private static function upsert_day( $uid, $day, $fields ) {
		global $wpdb;
		$t = self::table( 'days' );
		if ( self::day_row( $uid, $day ) ) {
			$wpdb->update( $t, $fields, array( 'user_id' => $uid, 'day' => $day ) ); // phpcs:ignore
		} else {
			$wpdb->insert( $t, array_merge( array( 'user_id' => $uid, 'day' => $day ), $fields ) ); // phpcs:ignore
		}
	}

	public static function study_days( $uid ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table( 'days' ) . ' WHERE user_id = %d AND minutes > 0', $uid ) ); // phpcs:ignore
	}

	/* ------------------------------------------------------------------ processing */

	/** Starts the game for a student the first time they act. */
	public static function ensure_started( $uid ) {
		if ( '' === self::m( $uid, 'processed' ) ) {
			self::set( $uid, 'processed', self::add_days( self::today(), -1 ) );
			self::set( $uid, 'health', (int) self::settings()['start_health'] );
			self::set( $uid, 'streak', 0 );
			self::set( $uid, 'freezes', 0 );
			self::set( $uid, 'sp', 0 );
		}
	}

	/** Settles every finished day (before today) that hasn't been settled yet, in order. */
	public static function process_user( $uid ) {
		$processed = self::m( $uid, 'processed' );
		if ( '' === $processed ) {
			return;
		}
		$today = self::today();
		$day   = self::add_days( $processed, 1 );
		if ( $day >= $today ) {
			return;
		}
		// Someone who left for months: don't replay hundreds of days one by one.
		$floor = self::add_days( $today, -120 );
		if ( $day < $floor ) {
			$day = $floor;
		}
		global $wpdb;
		$s       = self::settings();
		$goal    = self::goal( $uid );
		$health  = (int) self::m( $uid, 'health', $s['start_health'] );
		$streak  = (int) self::m( $uid, 'streak', 0 );
		$freezes = (int) self::m( $uid, 'freezes', 0 );
		$shield  = (string) self::m( $uid, 'shield_until', '' );
		$best    = (int) self::m( $uid, 'best_streak', 0 );
		$yday    = self::add_days( $today, -1 );
		$rows    = $wpdb->get_results( $wpdb->prepare( 'SELECT day, minutes FROM ' . self::table( 'days' ) . ' WHERE user_id = %d AND day BETWEEN %s AND %s', $uid, $day, $yday ), OBJECT_K ); // phpcs:ignore

		for ( $d = $day; $d <= $yday; $d = self::add_days( $d, 1 ) ) {
			$minutes  = isset( $rows[ $d ] ) ? (int) $rows[ $d ]->minutes : 0;
			$shielded = $shield && $d <= $shield;
			$before   = $health;
			if ( $minutes > 0 ) {
				++$streak;
				$health = min( 100, $health + ( $minutes >= $goal ? (int) $s['gain_goal'] : (int) $s['gain_partial'] ) );
				$state  = 'studied';
			} else {
				if ( ! $shielded ) {
					$health = max( 0, $health - (int) $s['decay'] );
				}
				if ( $freezes > 0 && $streak > 0 ) {
					--$freezes;
					$state = 'frozen';
					self::event( $uid, 'freeze_used', null, array( 'streak' => $streak ) );
				} else {
					if ( $streak >= 3 ) {
						self::event( $uid, 'streak_lost', null, array( 'streak' => $streak ) );
					}
					$streak = 0;
					$state  = $shielded ? 'shield' : 'missed';
				}
			}
			if ( $before >= 25 && $health < 25 ) {
				self::event( $uid, 'health_low', null, array( 'health' => $health ) );
			}
			$best = max( $best, $streak );
			self::upsert_day(
				$uid,
				$d,
				array(
					'minutes' => $minutes,
					'health'  => $health,
					'streak'  => $streak,
					'state'   => $state,
				)
			);
		}
		self::set( $uid, 'health', $health );
		self::set( $uid, 'streak', $streak );
		self::set( $uid, 'freezes', $freezes );
		self::set( $uid, 'best_streak', $best );
		self::set( $uid, 'processed', $yday );
	}

	/** A log added to (or removed from) yesterday after it was settled: settle it again. */
	private static function reopen_yesterday( $uid ) {
		$yday = self::add_days( self::today(), -1 );
		if ( self::m( $uid, 'processed' ) < $yday ) {
			return;
		}
		$y    = self::day_row( $uid, $yday );
		$prev = self::day_row( $uid, self::add_days( $yday, -1 ) );
		if ( $y && 'frozen' === $y['state'] ) {
			self::set( $uid, 'freezes', (int) self::m( $uid, 'freezes', 0 ) + 1 );
		}
		self::set( $uid, 'health', $prev && null !== $prev['health'] ? (int) $prev['health'] : (int) self::settings()['start_health'] );
		self::set( $uid, 'streak', $prev && null !== $prev['streak'] ? (int) $prev['streak'] : 0 );
		self::set( $uid, 'processed', self::add_days( $yday, -1 ) );
	}

	public static function process_everyone() {
		foreach ( self::member_ids() as $uid ) {
			self::process_user( $uid );
		}
		delete_transient( 'sawa_tr_board_consistency' );
	}

	public static function member_ids() {
		$approved = get_users(
			array(
				'meta_key'   => 'sawa_status', // phpcs:ignore
				'meta_value' => 'approved', // phpcs:ignore
				'fields'     => 'ID',
			)
		);
		$admins   = get_users(
			array(
				'role'     => 'administrator',
				'meta_key' => 'sawa_class', // phpcs:ignore
				'fields'   => 'ID',
			)
		);
		return array_map( 'intval', array_unique( array_merge( $approved, $admins ) ) );
	}

	/* ------------------------------------------------------------------ current state */

	/** Health, streak and today's numbers, including what the student has done so far today. */
	public static function live( $uid ) {
		$s     = self::settings();
		$today = self::today();
		$row   = self::day_row( $uid, $today );
		$tmin  = $row ? (int) $row['minutes'] : 0;
		$goal  = self::goal( $uid );
		$h     = (int) self::m( $uid, 'health', $s['start_health'] );
		$st    = (int) self::m( $uid, 'streak', 0 );
		if ( $tmin > 0 ) {
			$h = min( 100, $h + ( $tmin >= $goal ? (int) $s['gain_goal'] : (int) $s['gain_partial'] ) );
			++$st;
		}
		$days = self::study_days( $uid );
		return array(
			'health'       => $h,
			'streak'       => $st,
			'bestStreak'   => max( $st, (int) self::m( $uid, 'best_streak', 0 ) ),
			'todayMinutes' => $tmin,
			'goal'         => $goal,
			'studiedToday' => $tmin > 0,
			'dayFinished'  => $row ? (bool) $row['finished'] : false,
			'studyDays'    => $days,
			'freezes'      => (int) self::m( $uid, 'freezes', 0 ),
			'shieldUntil'  => (string) self::m( $uid, 'shield_until', '' ),
			'sp'           => class_exists( 'Sawa_Tracker_Raids' ) ? Sawa_Tracker_Raids::coins( $uid ) : 0, // coins (SP were merged into coins)
			'spBonus'      => (int) self::m( $uid, 'sp_bonus', 0 ),
		) + self::level_for( $days );
	}

	public static function person( $uid ) {
		$u = get_userdata( $uid );
		if ( ! $u ) {
			return array(
				'id'   => (int) $uid,
				'name' => 'Former student',
			);
		}
		$class = (string) self::m( $uid, 'class' );
		return array(
			'id'     => (int) $uid,
			'name'   => $u->display_name,
			'avatar' => (string) self::m( $uid, 'avatar' ),
			'class'  => $class,
			'icon'   => self::CLASSES[ $class ]['icon'] ?? '',
		);
	}

	/* ------------------------------------------------------------------ events */

	public static function event( $uid, $type, $target = null, $data = array() ) {
		global $wpdb;
		$wpdb->insert( // phpcs:ignore
			self::table( 'events' ),
			array(
				'user_id'    => $uid,
				'type'       => $type,
				'target_id'  => $target,
				'data'       => wp_json_encode( $data ),
				'created_at' => self::now_mysql(),
			)
		);
		return (int) $wpdb->insert_id;
	}

	/* ------------------------------------------------------------------ logging */

	public static function add_log( $uid, $activity, $minutes, $cards, $notes, $day, $quiet = false ) {
		if ( ! isset( self::ACTIVITIES[ $activity ] ) ) {
			return new WP_Error( 'activity', 'اختار النشاط.' );
		}
		$minutes = (int) $minutes;
		if ( $minutes < 1 || $minutes > 720 ) {
			return new WP_Error( 'minutes', 'اكتب الدقايق من 1 لـ 720.' );
		}
		$today = self::today();
		$yday  = self::add_days( $today, -1 );
		if ( $day !== $today && $day !== $yday ) {
			return new WP_Error( 'day', 'تقدر تسجّل أنشطة النهارده أو امبارح بس.' );
		}
		self::ensure_started( $uid );
		self::process_user( $uid );
		if ( $day === $yday ) {
			self::reopen_yesterday( $uid );
		}
		$before = self::live( $uid );

		global $wpdb;
		$wpdb->insert( // phpcs:ignore
			self::table( 'logs' ),
			array(
				'user_id'    => $uid,
				'activity'   => $activity,
				'minutes'    => $minutes,
				'cards'      => self::ACTIVITIES[ $activity ]['cards'] ? max( 0, (int) $cards ) : 0,
				'notes'      => mb_substr( sanitize_text_field( $notes ), 0, 500 ),
				'day'        => $day,
				'created_at' => self::now_mysql(),
			)
		);
		$row = self::day_row( $uid, $day );
		self::upsert_day( $uid, $day, array( 'minutes' => ( $row ? (int) $row['minutes'] : 0 ) + $minutes ) );
		if ( $day === $yday ) {
			self::process_user( $uid );
		}

		// Skill points: 1 per activity (plus any Empower bonus), up to the daily cap.
		$sp_gain = 0;
		$cap     = (array) self::m( $uid, 'sp_day', array() );
		$count   = ( isset( $cap['day'] ) && $cap['day'] === $today ) ? (int) $cap['n'] : 0;
		if ( $count < (int) self::settings()['sp_daily_cap'] ) {
			$sp_gain = ( 1 + (int) self::m( $uid, 'sp_bonus', 0 ) ) * self::SP_COINS;
			self::set( $uid, 'sp_bonus', 0 );
			Sawa_Tracker_Raids::add_coins( $uid, $sp_gain, 'learn' );
			self::set(
				$uid,
				'sp_day',
				array(
					'day' => $today,
					'n'   => $count + 1,
				)
			);
		}

		if ( ! $quiet ) {
			self::event(
				$uid,
				'log',
				null,
				array(
					'activity' => $activity,
					'minutes'  => $minutes,
					'cards'    => (int) $cards,
				)
			);
		}
		$after = self::live( $uid );
		if ( $after['level'] > $before['level'] ) {
			self::event(
				$uid,
				'level_up',
				null,
				array(
					'level' => $after['level'],
					'title' => $after['title'],
				)
			);
		}
		self::boss_hit( $minutes );
		$badges = self::check_badges( $uid );
		self::bust_boards();
		return array(
			'sp'      => $sp_gain,
			'levelUp' => $after['level'] > $before['level'] ? $after['level'] : null,
			'badges'  => $badges,
		);
	}

	public static function delete_log( $uid, $id ) {
		global $wpdb;
		$log = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table( 'logs' ) . ' WHERE id = %d AND user_id = %d', $id, $uid ), ARRAY_A ); // phpcs:ignore
		if ( ! $log ) {
			return new WP_Error( 'missing', 'ملقيناش النشاط ده.' );
		}
		$today = self::today();
		$yday  = self::add_days( $today, -1 );
		if ( $log['day'] !== $today && $log['day'] !== $yday ) {
			return new WP_Error( 'old', 'تقدر تمسح أنشطة النهارده أو امبارح بس.' );
		}
		self::process_user( $uid );
		if ( $log['day'] === $yday ) {
			self::reopen_yesterday( $uid );
		}
		$wpdb->delete( self::table( 'logs' ), array( 'id' => $id ) ); // phpcs:ignore
		$row = self::day_row( $uid, $log['day'] );
		self::upsert_day( $uid, $log['day'], array( 'minutes' => max( 0, ( $row ? (int) $row['minutes'] : 0 ) - (int) $log['minutes'] ) ) );
		self::process_user( $uid );
		self::bust_boards();
		return true;
	}

	/** The 7-step "Log your day": several activities plus a reflection. */
	public static function log_day( $uid, $day, $entries, $mood_before, $mood_after, $note ) {
		$results = array();
		$gained  = 0;
		$levels  = null;
		$badges  = array();
		foreach ( $entries as $e ) {
			$r = self::add_log( $uid, (string) ( $e['activity'] ?? '' ), (int) ( $e['minutes'] ?? 0 ), (int) ( $e['cards'] ?? 0 ), (string) ( $e['notes'] ?? '' ), $day );
			if ( is_wp_error( $r ) ) {
				return $r;
			}
			$gained += $r['sp'];
			$levels  = $r['levelUp'] ? $r['levelUp'] : $levels;
			$badges  = array_merge( $badges, $r['badges'] );
			$results[] = $e;
		}
		$fields = array( 'finished' => 1 );
		if ( $mood_before ) {
			$fields['mood_before'] = max( 1, min( 10, (int) $mood_before ) );
		}
		if ( $mood_after ) {
			$fields['mood_after'] = max( 1, min( 10, (int) $mood_after ) );
		}
		if ( '' !== trim( $note ) ) {
			$fields['teacher_note'] = mb_substr( sanitize_textarea_field( $note ), 0, 2000 );
		}
		if ( ! self::day_row( $uid, $day ) ) {
			self::ensure_started( $uid );
		}
		self::upsert_day( $uid, $day, $fields );
		$study_days = self::study_days( $uid );
		self::event(
			$uid,
			'day_done',
			null,
			array(
				'day'  => $study_days,
				'mood' => $mood_after ? (int) $mood_after : null,
				'up'   => ( $mood_before && $mood_after ) ? (int) $mood_after - (int) $mood_before : null,
			)
		);
		return array(
			'sp'       => $gained,
			'levelUp'  => $levels,
			'badges'   => array_values( array_unique( $badges ) ),
			'dayNumber' => $study_days,
		);
	}

	/* ------------------------------------------------------------------ skills */

	public static function cast( $uid, $skill_id, $target ) {
		$class = (string) self::m( $uid, 'class' );
		$sk    = self::skill( $class, $skill_id );
		if ( ! $sk ) {
			return new WP_Error( 'skill', 'المهارة دي بتاعة كلاس تاني.' );
		}
		self::ensure_started( $uid );
		self::process_user( $uid );
		$me    = self::live( $uid );
		$today = self::today();
		if ( $me['level'] < $sk['unlock'] ) {
			return new WP_Error( 'locked', sprintf( '%s بتتفتح في مستوى %d.', $sk['name'], $sk['unlock'] ) );
		}
		if ( $me['sp'] < $sk['cost'] ) {
			return new WP_Error( 'sp', sprintf( 'You need %d coins for %s. You have %d. Learning earns coins.', $sk['cost'], $sk['name'], $me['sp'] ) );
		}
		$cds = (array) self::m( $uid, 'cooldowns', array() );
		if ( ! empty( $cds[ $skill_id ] ) && $cds[ $skill_id ] > $today ) {
			return new WP_Error( 'cooldown', sprintf( '%s بتستريح. جاهزة تاني يوم %s.', $sk['name'], wp_date( 'M j', strtotime( $cds[ $skill_id ] . ' 12:00' ) ) ) );
		}
		if ( 'self' === $sk['target'] ) {
			$target = $uid;
		} else {
			$target = (int) $target;
			if ( $target === $uid ) {
				return new WP_Error( 'target', 'المهارة دي لمساعدة زميل. اختار حد من الترتيب.' );
			}
			if ( ! self::is_member( $target ) ) {
				return new WP_Error( 'target', 'ملقيناش الطالب ده.' );
			}
			self::ensure_started( $target );
			self::process_user( $target );
		}

		$heal   = function ( $n ) use ( $target ) {
			self::set( $target, 'health', min( 100, (int) self::m( $target, 'health', 50 ) + $n ) );
		};
		$freeze = function () use ( $target ) {
			self::set( $target, 'freezes', min( 3, (int) self::m( $target, 'freezes', 0 ) + 1 ) );
		};
		$shield = function ( $days ) use ( $target, $today ) {
			$until = self::add_days( $today, $days - 1 );
			self::set( $target, 'shield_until', max( (string) self::m( $target, 'shield_until', '' ), $until ) );
		};
		switch ( $sk['effect'] ) {
			case 'freeze_self':
			case 'freeze_other':
				$freeze();
				break;
			case 'nudge':
				if ( self::live( $target )['studiedToday'] ) {
					return new WP_Error( 'nudge', 'ذاكر النهارده خلاص. خلي الـ Rally لحد محتاجها.' );
				}
				break;
			case 'health_self_10':
			case 'health_10':
				$heal( 10 );
				break;
			case 'health_15':
				$heal( 15 );
				break;
			case 'sp_boost':
				self::set( $target, 'sp_bonus', (int) self::m( $target, 'sp_bonus', 0 ) + 2 );
				break;
			case 'health_10_freeze':
				$heal( 10 );
				$freeze();
				break;
			case 'shield_2':
				$shield( 2 );
				break;
			case 'shield_3':
				$shield( 3 );
				break;
			case 'ultimate_warrior':
				$freeze();
				$shield( 3 );
				break;
			case 'ultimate_healer':
				$heal( 20 );
				$shield( 3 );
				break;
		}
		Sawa_Tracker_Raids::add_coins( $uid, -$sk['cost'] );
		$cds[ $skill_id ] = self::add_days( $today, $sk['cooldown'] );
		self::set( $uid, 'cooldowns', $cds );
		if ( $target !== $uid ) {
			self::set( $uid, 'helped', (int) self::m( $uid, 'helped', 0 ) + 1 );
		}
		self::event(
			$uid,
			'skill',
			$target,
			array(
				'skill' => $sk['id'],
				'name'  => $sk['name'],
				'icon'  => $sk['icon'],
			)
		);
		self::check_badges( $uid );
		self::bust_boards();
		return array( 'skill' => $sk );
	}

	public static function skills_for( $uid ) {
		$class = (string) self::m( $uid, 'class' );
		$live  = self::live( $uid );
		$cds   = (array) self::m( $uid, 'cooldowns', array() );
		$today = self::today();
		$out   = array();
		foreach ( self::skills()[ $class ] ?? array() as $s ) {
			$sk           = self::skill( $class, $s[0] );
			$sk['locked'] = $live['level'] < $sk['unlock'];
			$sk['readyOn'] = ( ! empty( $cds[ $sk['id'] ] ) && $cds[ $sk['id'] ] > $today ) ? $cds[ $sk['id'] ] : null;
			$out[]        = $sk;
		}
		return $out;
	}

	/* ------------------------------------------------------------------ boss */

	public static function boss() {
		$week = self::week_start();
		$b    = get_option( 'sawa_tr_boss', array() );
		if ( empty( $b['week'] ) || $b['week'] !== $week ) {
			$n    = (int) floor( strtotime( $week ) / WEEK_IN_SECONDS );
			$pick = self::BOSSES[ $n % count( self::BOSSES ) ];
			$b    = array(
				'week'     => $week,
				'name'     => $pick[0],
				'icon'     => $pick[1],
				'hp'       => max( 100, (int) self::settings()['boss_hp'] ),
				'defeated' => '',
			);
			update_option( 'sawa_tr_boss', $b, false );
		}
		global $wpdb;
		$end    = self::add_days( $week, 6 );
		$damage = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(minutes),0) FROM ' . self::table( 'logs' ) . ' WHERE day BETWEEN %s AND %s', $week, $end ) ); // phpcs:ignore
		$top    = $wpdb->get_results( $wpdb->prepare( 'SELECT user_id, SUM(minutes) AS m FROM ' . self::table( 'logs' ) . ' WHERE day BETWEEN %s AND %s GROUP BY user_id ORDER BY m DESC LIMIT 5', $week, $end ), ARRAY_A ); // phpcs:ignore
		$fighters = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(DISTINCT user_id) FROM ' . self::table( 'logs' ) . ' WHERE day BETWEEN %s AND %s', $week, $end ) ); // phpcs:ignore
		return array(
			'name'     => $b['name'],
			'icon'     => $b['icon'],
			'hp'       => (int) $b['hp'],
			'damage'   => min( $damage, (int) $b['hp'] ),
			'defeated' => (string) $b['defeated'],
			'ends'     => $end,
			'fighters' => $fighters,
			'top'      => array_map(
				function ( $r ) {
					return self::person( (int) $r['user_id'] ) + array( 'minutes' => (int) $r['m'] );
				},
				$top
			),
		);
	}

	private static function boss_hit( $minutes ) {
		$boss = self::boss();
		if ( $boss['defeated'] || $boss['damage'] < $boss['hp'] ) {
			return;
		}
		$b             = get_option( 'sawa_tr_boss', array() );
		$b['defeated'] = self::now_mysql();
		update_option( 'sawa_tr_boss', $b, false );
		global $wpdb;
		$ids = $wpdb->get_col( $wpdb->prepare( 'SELECT DISTINCT user_id FROM ' . self::table( 'logs' ) . ' WHERE day BETWEEN %s AND %s', $b['week'], self::add_days( $b['week'], 6 ) ) ); // phpcs:ignore
		foreach ( $ids as $id ) {
			Sawa_Tracker_Raids::add_coins( (int) $id, 3 * self::SP_COINS );
			self::award( (int) $id, 'boss_slayer' );
		}
		self::event(
			0,
			'boss_down',
			null,
			array(
				'name'     => $b['name'],
				'icon'     => $b['icon'],
				'fighters' => count( $ids ),
			)
		);
	}

	/* ------------------------------------------------------------------ badges */

	private static function award( $uid, $badge ) {
		$have = (array) self::m( $uid, 'badges', array() );
		if ( isset( $have[ $badge ] ) ) {
			return false;
		}
		$have[ $badge ] = self::today();
		self::set( $uid, 'badges', $have );
		self::event(
			$uid,
			'badge',
			null,
			array(
				'badge' => $badge,
				'name'  => self::BADGES[ $badge ][0],
				'icon'  => self::BADGES[ $badge ][1],
			)
		);
		return true;
	}

	public static function check_badges( $uid ) {
		global $wpdb;
		$new  = array();
		$live = self::live( $uid );
		$tot  = $wpdb->get_row( $wpdb->prepare( 'SELECT COUNT(*) AS n, COALESCE(SUM(minutes),0) AS m, COALESCE(SUM(cards),0) AS c FROM ' . self::table( 'logs' ) . ' WHERE user_id = %d', $uid ) ); // phpcs:ignore
		$want = array(
			'first_log'  => $tot->n >= 1,
			'streak_7'   => $live['bestStreak'] >= 7,
			'streak_30'  => $live['bestStreak'] >= 30,
			'streak_100' => $live['bestStreak'] >= 100,
			'hours_10'   => $tot->m >= 600,
			'hours_50'   => $tot->m >= 3000,
			'hours_100'  => $tot->m >= 6000,
			'cards_1000' => $tot->c >= 1000,
			'helper_10'  => (int) self::m( $uid, 'helped', 0 ) >= 10,
		);
		foreach ( $want as $b => $ok ) {
			if ( $ok && self::award( $uid, $b ) ) {
				$new[] = $b;
			}
		}
		return $new;
	}

	/* ------------------------------------------------------------------ leaderboard */

	public static function bust_boards() {
		delete_transient( 'sawa_tr_board_consistency' );
		delete_transient( 'sawa_tr_board_week' );
		delete_transient( 'sawa_tr_board_all' );
	}

	public static function board( $tab ) {
		$tab    = in_array( $tab, array( 'consistency', 'week', 'all', 'xp' ), true ) ? $tab : 'consistency';
		$cached = get_transient( 'sawa_tr_board_' . $tab );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		global $wpdb;
		$ids = self::member_ids();
		if ( ! $ids ) {
			return array();
		}
		update_meta_cache( 'user', $ids );
		cache_users( $ids );
		$in       = implode( ',', $ids );
		$today    = self::today();
		$week     = self::week_start();
		$minutes  = array();
		if ( 'week' === $tab || 'all' === $tab ) {
			$where = 'week' === $tab ? $wpdb->prepare( 'AND day BETWEEN %s AND %s', $week, self::add_days( $week, 6 ) ) : '';
			foreach ( $wpdb->get_results( 'SELECT user_id, SUM(minutes) AS m FROM ' . self::table( 'logs' ) . " WHERE user_id IN ($in) $where GROUP BY user_id" ) as $r ) { // phpcs:ignore
				$minutes[ (int) $r->user_id ] = (int) $r->m;
			}
		}
		$rows = array();
		foreach ( $ids as $uid ) {
			if ( '' === self::m( $uid, 'class' ) ) {
				continue; // Hasn't started playing yet.
			}
			self::process_user( $uid );
			$l      = self::live( $uid );
			$rows[] = self::person( $uid ) + array(
				'level'   => $l['level'],
				'health'  => $l['health'],
				'streak'  => $l['streak'],
				'days'    => $l['studyDays'],
				'today'   => $l['studiedToday'],
				'minutes' => $minutes[ $uid ] ?? 0,
				'xp'      => 'xp' === $tab ? Sawa_Tracker_XP::week( $uid ) : 0,
				'xpLevel' => 'xp' === $tab ? Sawa_Tracker_XP::level( Sawa_Tracker_XP::total( $uid ) )['level'] : 0,
			);
		}
		usort(
			$rows,
			function ( $a, $b ) use ( $tab ) {
				if ( 'xp' === $tab ) {
					return array( $b['xp'], $b['streak'] ) <=> array( $a['xp'], $a['streak'] );
				}
				if ( 'consistency' === $tab ) {
					return array( $b['health'], $b['streak'], $b['days'] ) <=> array( $a['health'], $a['streak'], $a['days'] );
				}
				return array( $b['minutes'], $b['streak'] ) <=> array( $a['minutes'], $a['streak'] );
			}
		);
		foreach ( $rows as $i => &$r ) {
			$r['rank'] = $i + 1;
		}
		unset( $r );
		set_transient( 'sawa_tr_board_' . $tab, $rows, 90 );
		return $rows;
	}
}
