<?php
/**
 * Plugin Name:       Sawa Tracker
 * Description:       A game-like study tracker for Sawa English learners: streaks, habit health, levels, classes and skills, a weekly community boss, badges, a live feed and a leaderboard. Put [sawa_tracker] on a page.
 * Version:           2.8.1
 * Author:            Sawa English
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       sawa-tracker
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SAWA_TR_VER', '2.8.1' );
define( 'SAWA_TR_DB', 5 );
define( 'SAWA_TR_FILE', __FILE__ );
define( 'SAWA_TR_URL', plugin_dir_url( __FILE__ ) );
define( 'SAWA_TR_DIR', plugin_dir_path( __FILE__ ) );

require_once SAWA_TR_DIR . 'includes/class-game.php';
require_once SAWA_TR_DIR . 'includes/class-social.php';
require_once SAWA_TR_DIR . 'includes/class-xp.php';
require_once SAWA_TR_DIR . 'includes/class-raids.php';
require_once SAWA_TR_DIR . 'includes/class-rpg.php';
require_once SAWA_TR_DIR . 'includes/class-world.php';
require_once SAWA_TR_DIR . 'includes/class-party.php';
require_once SAWA_TR_DIR . 'includes/class-play.php';
require_once SAWA_TR_DIR . 'includes/class-hero.php';
require_once SAWA_TR_DIR . 'includes/class-coop.php';
require_once SAWA_TR_DIR . 'includes/class-rest.php';
require_once SAWA_TR_DIR . 'includes/class-rest-social.php';
require_once SAWA_TR_DIR . 'includes/class-front.php';
if ( is_admin() ) {
	require_once SAWA_TR_DIR . 'includes/class-admin.php';
}

register_activation_hook( __FILE__, array( 'Sawa_Tracker_Game', 'install' ) );

add_action(
	'plugins_loaded',
	function () {
		if ( (int) get_option( 'sawa_tr_db' ) !== SAWA_TR_DB ) {
			Sawa_Tracker_Game::install();
		}
		Sawa_Tracker_Rest::init();
		Sawa_Tracker_Rest_Social::init();
		Sawa_Tracker_XP::init();
		Sawa_Tracker_Raids::init();
		Sawa_Tracker_World::init();
		Sawa_Tracker_Party::init();
		Sawa_Tracker_Play::init();
		Sawa_Tracker_Hero::init();
		Sawa_Tracker_Coop::init();
		Sawa_Tracker_Front::init();
		if ( is_admin() ) {
			Sawa_Tracker_Admin::init();
		}
	}
);

// Process every student's finished days once a day, so the leaderboard is always current.
add_action( 'sawa_tr_daily', array( 'Sawa_Tracker_Game', 'process_everyone' ) );
add_action( 'sawa_tr_hourly', array( 'Sawa_Tracker_Social', 'send_reminders' ) );
add_action(
	'init',
	function () {
		if ( ! wp_next_scheduled( 'sawa_tr_daily' ) ) {
			$next = new DateTimeImmutable( 'tomorrow 00:05', wp_timezone() );
			wp_schedule_event( $next->getTimestamp(), 'daily', 'sawa_tr_daily' );
		}
		if ( ! wp_next_scheduled( 'sawa_tr_hourly' ) ) {
			wp_schedule_event( ( (int) ( time() / 3600 ) + 1 ) * 3600 + 60, 'hourly', 'sawa_tr_hourly' );
		}
	}
);
register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( 'sawa_tr_daily' );
		wp_clear_scheduled_hook( 'sawa_tr_hourly' );
	}
);
