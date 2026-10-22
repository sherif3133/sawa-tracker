<?php
/**
 * Beta feedback: students tell us what they think while they use the app and the game.
 *
 * - A "Beta feedback" button on every screen (assets/feedback.js): one tap for a reaction (I don't understand,
 *   what does this do, I like it, I don't like it, boring, something broke, an idea), then an optional note in
 *   Arabic or English. "Show me" lets them tap the thing they mean.
 * - Where they were is saved with it (screen, the town, panel or battle question in the game, stage, level,
 *   device), so "this is boring" can be acted on.
 * - Follow-up questions follow The Mom Test: they ask about what the student was doing and expected, not for
 *   opinions or wishes.
 * - Script errors are saved too (kind "error"), so bugs testers don't notice still reach us.
 * - wp-admin → Sawa Tracker → Beta feedback: counts by screen and reaction, filters, CSV, and a status. Marking a
 *   note "fixed" with a reply sends the student a notification.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Feedback {

	const DB     = 1;
	const KINDS  = array(
		'confused' => array( '😕', 'I don\'t understand' ),
		'what'     => array( '❓', 'What does this do?' ),
		'like'     => array( '👍', 'I like this' ),
		'dislike'  => array( '👎', 'I don\'t like this' ),
		'boring'   => array( '😴', 'Boring' ),
		'bug'      => array( '🐞', 'Something broke' ),
		'idea'     => array( '💡', 'Idea' ),
		'error'    => array( '⚠️', 'Script error (automatic)' ),
	);
	const STATUS = array( 'new' => 'New', 'seen' => 'Seen', 'planned' => 'Planned', 'fixed' => 'Fixed', 'wontdo' => 'Won\'t do' );
	const PER_DAY = 30;
	const COINS   = 5; // for the first feedback of the day

	public static function t() {
		global $wpdb;
		return $wpdb->prefix . 'sawa_tr_feedback';
	}

	public static function init() {
		if ( (int) get_option( 'sawa_tr_fb_db' ) !== self::DB ) {
			self::install();
		}
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 20 );
		add_action( 'admin_post_sawa_tr_fb_csv', array( __CLASS__, 'csv' ) );
		add_filter( 'sawa_tracker_front_cfg', function ( $cfg ) { $cfg['beta'] = self::on(); $cfg['feedbackJs'] = SAWA_TR_URL . 'assets/feedback.js?v=' . SAWA_TR_VER; return $cfg; } );
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta(
			'CREATE TABLE ' . self::t() . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			kind varchar(12) NOT NULL DEFAULT '',
			body text NOT NULL,
			area varchar(120) NOT NULL DEFAULT '',
			target varchar(160) NOT NULL DEFAULT '',
			ctx text NOT NULL,
			prompt varchar(40) NOT NULL DEFAULT '',
			version varchar(20) NOT NULL DEFAULT '',
			status varchar(10) NOT NULL DEFAULT 'new',
			reply varchar(500) NOT NULL DEFAULT '',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY kind_status (kind,status),
			KEY area (area),
			KEY created (created_at)
			) " . $wpdb->get_charset_collate() . ';'
		);
		update_option( 'sawa_tr_fb_db', self::DB );
	}

	/** Is the beta button shown to students? (wp-admin switch, on by default) */
	public static function on() {
		return '0' !== (string) get_option( 'sawa_tr_beta', '1' );
	}

	public static function routes() {
		register_rest_route( Sawa_Tracker_Rest::NS, '/feedback', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'add' ), 'permission_callback' => array( 'Sawa_Tracker_Rest', 'member' ) ) );
	}

	public static function add( WP_REST_Request $r ) {
		global $wpdb;
		$uid  = get_current_user_id();
		$kind = (string) $r->get_param( 'kind' );
		if ( ! isset( self::KINDS[ $kind ] ) ) {
			return new WP_Error( 'feedback', 'Choose a reaction.', array( 'status' => 400 ) );
		}
		$day = Sawa_Tracker_Game::m( $uid, 'fb_day', array() );
		$n   = is_array( $day ) && ( $day['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $day['n'] : 0;
		if ( $n >= self::PER_DAY ) {
			return new WP_Error( 'feedback', 'Thank you! That is a lot of feedback for one day — send more tomorrow.', array( 'status' => 429 ) );
		}
		$body = mb_substr( trim( sanitize_textarea_field( (string) $r->get_param( 'text' ) ) ), 0, 2000 );
		if ( 'error' === $kind && $n >= 5 ) {
			return array( 'ok' => true ); // automatic error reports: a few a day is enough
		}
		$ctx = $r->get_param( 'ctx' );
		$ctx = is_array( $ctx ) ? $ctx : array();
		$ctx['stage'] = (int) $r->get_param( 'stage' );
		$ctx['level'] = class_exists( 'Sawa_Tracker_Hero' ) ? Sawa_Tracker_Hero::level( $uid ) : 0;
		$ctx['town']  = $ctx['town'] ?? ( class_exists( 'Sawa_Tracker_World' ) ? Sawa_Tracker_World::TOWNS[ Sawa_Tracker_World::at( $uid ) ][0] : '' );
		$wpdb->insert( // phpcs:ignore
			self::t(),
			array(
				'user_id'    => $uid,
				'kind'       => $kind,
				'body'       => $body,
				'area'       => mb_substr( sanitize_text_field( (string) $r->get_param( 'area' ) ), 0, 120 ),
				'target'     => mb_substr( sanitize_text_field( (string) $r->get_param( 'target' ) ), 0, 160 ),
				'ctx'        => mb_substr( wp_json_encode( $ctx, JSON_UNESCAPED_UNICODE ), 0, 4000 ),
				'prompt'     => sanitize_key( (string) $r->get_param( 'prompt' ) ),
				'version'    => SAWA_TR_VER . ( defined( 'SAWA_LENS_VER' ) ? '/' . SAWA_LENS_VER : '' ),
				'created_at' => current_time( 'mysql' ),
			)
		);
		Sawa_Tracker_Game::set( $uid, 'fb_day', array( 'day' => Sawa_Tracker_Game::today(), 'n' => $n + 1 ) );
		$coins = 0;
		if ( 'error' !== $kind && 0 === (int) Sawa_Tracker_Game::m( $uid, 'fb_paid_' . Sawa_Tracker_Game::today(), 0 ) ) {
			Sawa_Tracker_Game::set( $uid, 'fb_paid_' . Sawa_Tracker_Game::today(), 1 );
			$coins = Sawa_Tracker_Raids::add_coins( $uid, self::COINS );
		}
		return array( 'ok' => true, 'coins' => $coins, 'total' => (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t() . " WHERE user_id = %d AND kind <> 'error'", $uid ) ) ); // phpcs:ignore
	}

	/* ------------------------------------------------------------------ wp-admin */

	public static function menu() {
		global $wpdb;
		$new = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::t() . " WHERE status = 'new' AND kind <> 'error'" ); // phpcs:ignore
		add_submenu_page( 'sawa-tracker', 'Beta feedback', 'Beta feedback' . ( $new ? ' <span class="awaiting-mod">' . $new . '</span>' : '' ), 'manage_options', 'sawa-tracker-feedback', array( __CLASS__, 'page' ) );
	}

	private static function where( $f ) {
		global $wpdb;
		$w = array( '1=1' );
		if ( $f['kind'] ) {
			$w[] = $wpdb->prepare( 'kind = %s', $f['kind'] );
		} else {
			$w[] = "kind <> 'error'";
		}
		if ( $f['status'] ) {
			$w[] = $wpdb->prepare( 'status = %s', $f['status'] );
		}
		if ( $f['area'] ) {
			$w[] = $wpdb->prepare( 'area = %s', $f['area'] );
		}
		if ( $f['days'] ) {
			$w[] = $wpdb->prepare( 'created_at >= %s', gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - $f['days'] * DAY_IN_SECONDS ) ); // phpcs:ignore
		}
		return implode( ' AND ', $w );
	}

	private static function filters() {
		$g = wp_unslash( $_GET ); // phpcs:ignore
		return array(
			'kind'   => isset( self::KINDS[ $g['kind'] ?? '' ] ) ? $g['kind'] : '',
			'status' => isset( self::STATUS[ $g['status'] ?? '' ] ) ? $g['status'] : '',
			'area'   => sanitize_text_field( $g['area'] ?? '' ),
			'days'   => max( 0, (int) ( $g['days'] ?? 0 ) ),
		);
	}

	public static function page() {
		global $wpdb;
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$t = self::t();
		if ( isset( $_POST['sawa_fb_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['sawa_fb_nonce'] ), 'sawa_fb' ) ) {
			if ( isset( $_POST['summarize'] ) ) { // an AI summary of the last 7 days (Sawa Lens does the AI call)
				$notes = $wpdb->get_results( $wpdb->prepare( "SELECT kind, body, area, target FROM $t WHERE kind <> 'error' AND created_at >= %s ORDER BY id DESC LIMIT 300", gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 7 * DAY_IN_SECONDS ) ), ARRAY_A ); // phpcs:ignore
				$sum   = apply_filters( 'sawa_tracker_feedback_summary', new WP_Error( 'off', 'The AI summary needs the Sawa Lens plugin.' ), $notes );
				if ( is_wp_error( $sum ) ) {
					echo '<div class="error"><p>' . esc_html( $sum->get_error_message() ) . '</p></div>';
				} else {
					update_option( 'sawa_tr_fb_summary', $sum + array( 'at' => current_time( 'mysql' ), 'n' => count( $notes ) ), false );
				}
			}
			if ( isset( $_POST['beta'] ) ) {
				update_option( 'sawa_tr_beta', '1' === $_POST['beta'] ? '1' : '0', false );
			}
			foreach ( (array) ( $_POST['st'] ?? array() ) as $id => $st ) {
				$id    = (int) $id;
				$st    = sanitize_key( $st );
				$reply = sanitize_text_field( wp_unslash( $_POST['reply'][ $id ] ?? '' ) );
				$row   = $wpdb->get_row( $wpdb->prepare( "SELECT user_id, status, reply, body, kind FROM $t WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
				if ( ! $row || ! isset( self::STATUS[ $st ] ) || ( $row['status'] === $st && $row['reply'] === $reply ) ) {
					continue;
				}
				$wpdb->update( $t, array( 'status' => $st, 'reply' => $reply ), array( 'id' => $id ) ); // phpcs:ignore
				// Closing the loop: the student hears back when their feedback led to a change.
				if ( in_array( $st, array( 'fixed', 'planned' ), true ) && $row['status'] !== $st && (int) $row['user_id'] ) {
					Sawa_Tracker_Game::event( get_current_user_id(), 'feedback_' . $st, (int) $row['user_id'], array( 'text' => mb_substr( $row['body'], 0, 90 ), 'kind' => $row['kind'], 'reply' => $reply ) );
				}
			}
			echo '<div class="updated"><p>Saved.</p></div>';
		}
		$f     = self::filters();
		$where = self::where( $f );
		$kinds = $wpdb->get_results( "SELECT kind, COUNT(*) n FROM $t WHERE " . self::where( array( 'kind' => '', 'status' => '', 'area' => '', 'days' => $f['days'] ) ) . ' GROUP BY kind', ARRAY_A ); // phpcs:ignore
		$errs  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t WHERE kind = 'error'" ); // phpcs:ignore
		$areas = $wpdb->get_results( "SELECT area, kind, COUNT(*) n FROM $t WHERE " . self::where( array( 'kind' => '', 'status' => '', 'area' => '', 'days' => $f['days'] ) ) . ' GROUP BY area, kind', ARRAY_A ); // phpcs:ignore
		$rows  = $wpdb->get_results( "SELECT * FROM $t WHERE $where ORDER BY id DESC LIMIT 200", ARRAY_A ); // phpcs:ignore
		$base  = admin_url( 'admin.php?page=sawa-tracker-feedback' );
		$link  = function ( $args ) use ( $base, $f ) { return esc_url( add_query_arg( array_filter( array_merge( $f, $args ) ), $base ) ); };
		// screens with the most feedback: one row per screen, one column per reaction
		$grid = array();
		foreach ( (array) $areas as $a ) {
			$grid[ $a['area'] ][ $a['kind'] ] = (int) $a['n'];
		}
		uasort( $grid, function ( $a, $b ) { return array_sum( $b ) <=> array_sum( $a ); } );
		echo '<div class="wrap"><h1>Beta feedback</h1>';
		echo '<form method="post" style="margin:8px 0">' . wp_nonce_field( 'sawa_fb', 'sawa_fb_nonce', true, false ) . '<label><b>Feedback button for students:</b> <select name="beta"><option value="1"' . selected( self::on(), true, false ) . '>On (beta)</option><option value="0"' . selected( self::on(), false, false ) . '>Off</option></select></label> <button class="button">Save</button></form>';
		echo '<p>' . implode( ' · ', array_map( function ( $k ) use ( $link ) { return '<a href="' . $link( array( 'kind' => $k['kind'] ) ) . '">' . esc_html( self::KINDS[ $k['kind'] ][0] . ' ' . self::KINDS[ $k['kind'] ][1] ) . ': <b>' . (int) $k['n'] . '</b></a>'; }, array_filter( (array) $kinds, function ( $k ) { return isset( self::KINDS[ $k['kind'] ] ) && 'error' !== $k['kind']; } ) ) ) . ' · <a href="' . $link( array( 'kind' => 'error' ) ) . '">⚠️ script errors: ' . $errs . '</a></p>';
		echo '<p>Period: ' . implode( ' · ', array_map( function ( $d ) use ( $link, $f ) { return ( (int) $f['days'] === $d ? '<b>' : '' ) . '<a href="' . $link( array( 'days' => $d ) ) . '">' . ( $d ? 'last ' . $d . ' days' : 'all time' ) . '</a>' . ( (int) $f['days'] === $d ? '</b>' : '' ); }, array( 0, 1, 7, 30 ) ) ) . ' · <a href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=sawa_tr_fb_csv' ), 'sawa_fb_csv' ) ) . '">Download CSV</a>' . ( array_filter( $f ) ? ' · <a href="' . esc_url( $base ) . '">Clear filters</a>' : '' ) . '</p>';
		$sum = get_option( 'sawa_tr_fb_summary' );
		echo '<form method="post" style="margin:10px 0">' . wp_nonce_field( 'sawa_fb', 'sawa_fb_nonce', true, false ) . '<button class="button" name="summarize" value="1">✨ Sum up the last 7 days with AI</button> <span class="description">Translates the Arabic notes and groups everything into themes (one AI call).</span></form>';
		if ( is_array( $sum ) ) {
			echo '<div class="card" style="max-width:980px;padding:12px 16px"><h2 style="margin-top:0">AI summary <small style="font-weight:400">(' . esc_html( $sum['at'] ) . ', ' . (int) $sum['n'] . ' notes)</small></h2><p>' . esc_html( $sum['summary'] ) . '</p>' . ( $sum['first'] ? '<p><b>Fix first:</b> ' . esc_html( $sum['first'] ) . '</p>' : '' ) . '<ol>';
			foreach ( (array) $sum['themes'] as $th ) {
				echo '<li><b>' . esc_html( ( 'praise' === ( $th['kind'] ?? '' ) ? '👍 ' : ( 'idea' === ( $th['kind'] ?? '' ) ? '💡 ' : '😕 ' ) ) . ( $th['title'] ?? '' ) ) . '</b> · ' . (int) ( $th['count'] ?? 0 ) . ' notes' . ( ! empty( $th['screens'] ) ? ' · ' . esc_html( implode( ', ', (array) $th['screens'] ) ) : '' ) . '<br><i>“' . esc_html( $th['example'] ?? '' ) . '”</i>' . ( ! empty( $th['fix'] ) ? '<br>→ ' . esc_html( $th['fix'] ) : '' ) . '</li>';
			}
			echo '</ol></div>';
		}
		if ( $grid ) {
			$cols = array_diff( array_keys( self::KINDS ), array( 'error' ) );
			echo '<h2>Where the feedback is</h2><table class="widefat striped" style="max-width:980px"><thead><tr><th>Screen</th>' . implode( '', array_map( function ( $k ) { return '<th title="' . esc_attr( self::KINDS[ $k ][1] ) . '">' . self::KINDS[ $k ][0] . '</th>'; }, $cols ) ) . '<th>All</th></tr></thead><tbody>';
			foreach ( array_slice( $grid, 0, 20, true ) as $area => $c ) {
				echo '<tr><td><a href="' . $link( array( 'area' => $area ) ) . '">' . esc_html( $area ? $area : '—' ) . '</a></td>' . implode( '', array_map( function ( $k ) use ( $c ) { $n = $c[ $k ] ?? 0; return '<td>' . ( $n ? '<b>' . $n . '</b>' : '' ) . '</td>'; }, $cols ) ) . '<td>' . array_sum( $c ) . '</td></tr>';
			}
			echo '</tbody></table>';
		}
		echo '<h2>Notes' . ( $f['area'] ? ': ' . esc_html( $f['area'] ) : '' ) . '</h2><p class="description">Change a status and save. <b>Planned</b> or <b>Fixed</b> sends the student a notification with your reply, so testers see their feedback matters.</p>';
		echo '<form method="post">' . wp_nonce_field( 'sawa_fb', 'sawa_fb_nonce', true, false ) . '<table class="widefat striped"><thead><tr><th style="width:120px">When / who</th><th style="width:150px">Reaction</th><th>What they said</th><th style="width:220px">Where</th><th style="width:220px">Status and reply</th></tr></thead><tbody>';
		foreach ( (array) $rows as $r ) {
			$who = $r['user_id'] ? Sawa_Tracker_Game::person( (int) $r['user_id'] )['name'] : '—';
			$ctx = json_decode( $r['ctx'], true );
			echo '<tr><td><small>' . esc_html( mysql2date( 'M j, H:i', $r['created_at'] ) ) . '</small><br>' . esc_html( $who ) . '</td>'
				. '<td>' . esc_html( ( self::KINDS[ $r['kind'] ][0] ?? '' ) . ' ' . ( self::KINDS[ $r['kind'] ][1] ?? $r['kind'] ) ) . ( $r['prompt'] ? '<br><small>asked after: ' . esc_html( $r['prompt'] ) . '</small>' : '' ) . '</td>'
				. '<td dir="auto" style="white-space:pre-wrap">' . esc_html( $r['body'] ) . '</td>'
				. '<td><b>' . esc_html( $r['area'] ) . '</b>' . ( $r['target'] ? '<br>tapped: <i>' . esc_html( $r['target'] ) . '</i>' : '' ) . '<details><summary><small>details</small></summary><pre style="white-space:pre-wrap;font-size:11px;max-width:260px">' . esc_html( wp_json_encode( $ctx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) ) . "\nv" . esc_html( $r['version'] ) . '</pre></details></td>'
				. '<td><select name="st[' . (int) $r['id'] . ']">' . implode( '', array_map( function ( $k, $l ) use ( $r ) { return '<option value="' . $k . '"' . selected( $r['status'], $k, false ) . '>' . $l . '</option>'; }, array_keys( self::STATUS ), self::STATUS ) ) . '</select><input name="reply[' . (int) $r['id'] . ']" value="' . esc_attr( $r['reply'] ) . '" placeholder="Reply to the student (optional)" style="width:100%;margin-top:4px" dir="auto"></td></tr>';
		}
		echo '</tbody></table>' . ( $rows ? '<p><button class="button button-primary">Save changes</button></p>' : '<p>No feedback yet.</p>' ) . '</form></div>';
	}

	public static function csv() {
		global $wpdb;
		if ( ! current_user_can( 'manage_options' ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ?? '' ), 'sawa_fb_csv' ) ) {
			wp_die( 'Not allowed.' );
		}
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=sawa-beta-feedback-' . gmdate( 'Y-m-d' ) . '.csv' );
		$out = fopen( 'php://output', 'w' );
		fwrite( $out, "\xEF\xBB\xBF" ); // Excel reads Arabic correctly with a BOM
		fputcsv( $out, array( 'id', 'date', 'student', 'reaction', 'text', 'screen', 'tapped', 'asked after', 'status', 'reply', 'version', 'details' ) );
		foreach ( (array) $wpdb->get_results( 'SELECT * FROM ' . self::t() . ' ORDER BY id DESC', ARRAY_A ) as $r ) { // phpcs:ignore
			fputcsv( $out, array( $r['id'], $r['created_at'], $r['user_id'] ? Sawa_Tracker_Game::person( (int) $r['user_id'] )['name'] : '', self::KINDS[ $r['kind'] ][1] ?? $r['kind'], $r['body'], $r['area'], $r['target'], $r['prompt'], $r['status'], $r['reply'], $r['version'], $r['ctx'] ) );
		}
		exit;
	}
}
