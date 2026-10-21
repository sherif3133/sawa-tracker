<?php
/**
 * The [sawa_tracker] shortcode: prints the app container and its starting config.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Front {

	public static function init() {
		add_shortcode( 'sawa_tracker', array( __CLASS__, 'shortcode' ) );
		// Students don't need the WordPress toolbar on the site.
		add_filter(
			'show_admin_bar',
			function ( $show ) {
				return current_user_can( 'edit_posts' ) ? $show : false;
			}
		);
		// Logged-in pages must never be served from a page cache: the app needs a fresh security token.
		add_action(
			'template_redirect',
			function () {
				global $post;
				if ( $post && has_shortcode( (string) $post->post_content, 'sawa_tracker' ) ) {
					// Everything now lives in the one Sawa English app at /app (Language Lens plugin).
					if ( class_exists( 'Sawa_Lens_App' ) && ! isset( $_GET['classic'] ) ) { // phpcs:ignore
						wp_safe_redirect( Sawa_Lens_App::url(), 302 );
						exit;
					}
					nocache_headers();
					if ( ! defined( 'DONOTCACHEPAGE' ) ) {
						define( 'DONOTCACHEPAGE', true );
					}
				}
			}
		);
	}

	public static function shortcode( $atts = array() ) {
		$atts = shortcode_atts( array( 'embedded' => '', 'view' => '' ), (array) $atts );
		$url = is_singular() ? get_permalink() : '';
		if ( $url && get_option( 'sawa_tr_page' ) !== $url ) {
			update_option( 'sawa_tr_page', $url, false );
		}
		if ( ! $url || class_exists( 'Sawa_Lens_App' ) ) {
			// Inside the one app (/app): sign-in and sign-out come back there.
			$url = class_exists( 'Sawa_Lens_App' ) ? Sawa_Lens_App::url() : home_url( '/' );
		}
		$uid    = get_current_user_id();
		$status = $uid ? ( Sawa_Tracker_Game::is_member( $uid ) ? 'approved' : ( 'denied' === Sawa_Tracker_Game::m( $uid, 'status' ) ? 'denied' : 'pending' ) ) : 'guest';
		$acts   = array();
		foreach ( Sawa_Tracker_Game::ACTIVITIES as $name => $a ) {
			$acts[] = array( 'name' => $name ) + $a;
		}
		$cfg = array(
			'rest'       => esc_url_raw( rest_url( Sawa_Tracker_Rest::NS ) ),
			'nonce'      => $uid ? wp_create_nonce( 'wp_rest' ) : '',
			'status'     => $status,
			'name'       => $uid ? wp_get_current_user()->display_name : '',
			'css'        => SAWA_TR_URL . 'assets/app.css?v=' . SAWA_TR_VER,
			'loginUrl'   => site_url( 'wp-login.php', 'login_post' ),
			'lostUrl'    => wp_lostpassword_url( $url ),
			'logoutUrl'  => wp_logout_url( $url ),
			'here'       => $url,
			'activities' => $acts,
			'classes'    => Sawa_Tracker_Game::CLASSES,
			'levels'     => Sawa_Tracker_Game::LEVELS,
			'site'       => get_bloginfo( 'name' ),
			// Inside the one Sawa English app (/app): no own header or menu; the app shows one part at a time.
			'embedded'   => '' !== $atts['embedded'],
			'view'       => sanitize_key( $atts['view'] ),
		);
		// Other Sawa plugins (Language Lens) add their own data here.
		$cfg = apply_filters( 'sawa_tracker_front_cfg', $cfg, $uid );
		wp_enqueue_script( 'sawa-tracker', SAWA_TR_URL . 'assets/app.js', array(), SAWA_TR_VER, true );
		return '<div class="sawa-tracker-app" style="' . ( '' !== $atts['embedded'] ? '' : 'min-height:70vh' ) . '"></div><script type="application/json" class="sawa-tracker-config">'
			. wp_json_encode( $cfg, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . '</script>';
	}
}
