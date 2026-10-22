<?php
/**
 * Feedback & Dev: the public side of beta feedback, in the app (assets/board.js, Home → Feedback & Dev).
 *
 * - Roadmap: what's live, in progress, planned, later and won't do. The list is data/roadmap.json (the same data
 *   tools/features-md.js turns into the top-level FEATURES.md). wp-admin → Sawa Tracker → Roadmap can move an item
 *   to another column; those changes are kept as overrides and "Export JSON" gives the merged file to commit.
 * - Board: ideas, bugs and requests that students chose to share (rows of the beta feedback table with pub = 1).
 *   Members vote (+1 / −1, one vote each, can change it) and reply in a short thread. Sherif's replies are marked
 *   official. Students can hide their name. Admins can edit, hide, merge, set the status and link a roadmap item.
 * - Clarity check: a note that can't be acted on yet ("it doesn't work") is not posted. The student is asked
 *   what's missing (where, what they did, what happened and what they expected), in their language. A quick AI
 *   check (Sawa Lens, cheap model, cached) with a word-count / vague-words check when the AI is off. After one
 *   try to clarify, "Post anyway" is allowed.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Board {

	const DB = 1;
	// What students see: the stored status → the board's six words.
	const SHOW = array( 'new' => 'new', 'seen' => 'new', 'planned' => 'planned', 'progress' => 'progress', 'fixed' => 'done', 'later' => 'later', 'wontdo' => 'wontdo' );
	const ROAD = array( 'live', 'beta', 'progress', 'planned', 'later', 'wontdo' );
	const KINDS = array( 'idea', 'bug', 'request' ); // what can be posted on the board
	const REPLIES_PER_DAY = 30;

	public static function t( $what ) {
		global $wpdb;
		return $wpdb->prefix . 'sawa_tr_fb_' . $what;
	}

	public static function init() {
		if ( (int) get_option( 'sawa_tr_board_db' ) !== self::DB ) {
			self::install();
		}
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 21 );
		add_filter( 'sawa_tracker_front_cfg', function ( $cfg ) { $cfg['boardJs'] = SAWA_TR_URL . 'assets/board.js?v=' . SAWA_TR_VER; return $cfg; } );
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		dbDelta(
			'CREATE TABLE ' . self::t( 'votes' ) . " (
			fb_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			v tinyint(4) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (fb_id,user_id),
			KEY user_id (user_id)
			) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'replies' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			fb_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			body text NOT NULL,
			official tinyint(1) NOT NULL DEFAULT 0,
			hidden tinyint(1) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY fb_id (fb_id)
			) $c;"
		);
		update_option( 'sawa_tr_board_db', self::DB );
	}

	private static function admin() {
		return current_user_can( 'manage_options' );
	}

	public static function routes() {
		$m  = array( 'Sawa_Tracker_Rest', 'member' );
		$ns = Sawa_Tracker_Rest::NS;
		register_rest_route( $ns, '/ideas', array(
			array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'list_items' ), 'permission_callback' => $m ),
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'post' ), 'permission_callback' => $m ),
		) );
		register_rest_route( $ns, '/ideas/item', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'item' ), 'permission_callback' => $m ) );
		register_rest_route( $ns, '/ideas/vote', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'vote' ), 'permission_callback' => $m ) );
		register_rest_route( $ns, '/ideas/reply', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'reply' ), 'permission_callback' => $m ) );
		register_rest_route( $ns, '/ideas/mod', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'mod' ), 'permission_callback' => function () { return current_user_can( 'manage_options' ); } ) );
		register_rest_route( $ns, '/roadmap', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'roadmap_rest' ), 'permission_callback' => $m ) );
	}

	/* ------------------------------------------------------------------ the roadmap */

	/** data/roadmap.json with the wp-admin changes on top. */
	public static function roadmap() {
		static $r = null;
		if ( null !== $r ) {
			return $r;
		}
		$r    = json_decode( (string) file_get_contents( SAWA_TR_DIR . 'data/roadmap.json' ), true ); // phpcs:ignore
		$r    = is_array( $r ) ? $r : array( 'apps' => array(), 'items' => array() );
		$over = (array) get_option( 'sawa_tr_roadmap', array() );
		foreach ( $r['items'] as &$i ) {
			if ( isset( $over['st'][ $i['id'] ] ) && in_array( $over['st'][ $i['id'] ], self::ROAD, true ) ) {
				$i['status'] = $over['st'][ $i['id'] ];
				$i['moved']  = $over['at'][ $i['id'] ] ?? '';
			}
		}
		unset( $i );
		foreach ( (array) ( $over['add'] ?? array() ) as $a ) {
			$r['items'][] = $a;
		}
		return $r;
	}

	public static function roadmap_rest() {
		global $wpdb;
		$r     = self::roadmap();
		$admin = self::admin();
		$t     = Sawa_Tracker_Feedback::t();
		$links = array();
		foreach ( (array) $wpdb->get_results( "SELECT road, COUNT(*) n, SUM(score) s FROM $t WHERE pub = 1 AND hidden = 0 AND merged = 0 AND road <> '' GROUP BY road", ARRAY_A ) as $l ) { // phpcs:ignore
			$links[ $l['road'] ] = array( 'n' => (int) $l['n'], 'votes' => (int) $l['s'] );
		}
		$items = array();
		foreach ( $r['items'] as $i ) {
			if ( 'admin' === ( $i['audience'] ?? 'all' ) && ! $admin ) {
				continue;
			}
			$items[] = array(
				'id'     => $i['id'],
				'app'    => $i['app'],
				'group'  => $i['group'] ?? '',
				'title'  => $i['title'],
				'desc'   => $i['desc'] ?? '',
				'status' => $i['status'],
				'note'   => $i['note'] ?? '',
				'ver'    => $i['ver'] ?? '',
				'date'   => $i['date'] ?? '',
				'asks'   => $links[ $i['id'] ] ?? null,
			);
		}
		return array( 'apps' => $r['apps'], 'updated' => $r['updated'] ?? '', 'items' => $items );
	}

	private static function road_title( $id ) {
		foreach ( self::roadmap()['items'] as $i ) {
			if ( $i['id'] === $id ) {
				return array( 'id' => $id, 'title' => $i['title'], 'status' => $i['status'] );
			}
		}
		return null;
	}

	/* ------------------------------------------------------------------ the board */

	private static function shape( $row, $uid, $admin ) {
		$anon = (int) $row['anon'] && ! $admin;
		$who  = (int) $row['user_id'] ? Sawa_Tracker_Game::person( (int) $row['user_id'] ) : array( 'name' => '' );
		return array(
			'id'     => (int) $row['id'],
			'kind'   => $row['kind'],
			'text'   => $row['body'],
			'status' => self::SHOW[ $row['status'] ] ?? 'new',
			'reply'  => $row['reply'],
			'score'  => (int) $row['score'],
			'my'     => (int) ( $row['my'] ?? 0 ),
			'n'      => (int) $row['nrep'],
			'who'    => $anon ? '' : $who['name'],
			'avatar' => $anon ? '' : ( $who['avatar'] ?? '' ),
			'anon'   => (int) $row['anon'],
			'mine'   => (int) $row['user_id'] === $uid,
			'when'   => mysql2date( 'c', $row['created_at'] ),
			'area'   => $row['area'],
			'road'   => $row['road'] ? self::road_title( $row['road'] ) : null,
			'hidden' => $admin ? (int) $row['hidden'] : 0,
		);
	}

	public static function list_items( WP_REST_Request $r ) {
		global $wpdb;
		$uid   = get_current_user_id();
		$admin = self::admin();
		$t     = Sawa_Tracker_Feedback::t();
		$v     = self::t( 'votes' );
		$sort  = (string) $r->get_param( 'sort' );
		$order = 'new' === $sort ? 'f.id DESC'
			: ( 'status' === $sort ? "FIELD(f.status,'progress','planned','new','seen','later','fixed','wontdo'), f.score DESC, f.id DESC" : 'f.score DESC, f.nrep DESC, f.id DESC' );
		$where = "f.pub = 1 AND f.merged = 0 AND f.kind <> 'error'" . ( $admin ? '' : ' AND f.hidden = 0' );
		$st    = (string) $r->get_param( 'status' );
		$map   = array_keys( array_filter( self::SHOW, function ( $s ) use ( $st ) { return $s === $st; } ) );
		if ( $map ) {
			$where .= " AND f.status IN ('" . implode( "','", array_map( 'esc_sql', $map ) ) . "')";
		}
		if ( $r->get_param( 'mine' ) ) {
			$where .= $wpdb->prepare( ' AND f.user_id = %d', $uid );
		}
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT f.*, (SELECT v FROM $v WHERE fb_id = f.id AND user_id = %d) my FROM $t f WHERE $where ORDER BY $order LIMIT 150", $uid ), ARRAY_A ); // phpcs:ignore
		return array(
			'items' => array_map( function ( $row ) use ( $uid, $admin ) { return self::shape( $row, $uid, $admin ); }, (array) $rows ),
			'admin' => $admin,
		);
	}

	private static function row( $id ) {
		global $wpdb;
		$t = Sawa_Tracker_Feedback::t();
		$v = self::t( 'votes' );
		return $wpdb->get_row( $wpdb->prepare( "SELECT f.*, (SELECT v FROM $v WHERE fb_id = f.id AND user_id = %d) my FROM $t f WHERE f.id = %d AND f.pub = 1", get_current_user_id(), $id ), ARRAY_A ); // phpcs:ignore
	}

	private static function visible( $row ) {
		return $row && ( self::admin() || ( ! (int) $row['hidden'] && ! (int) $row['merged'] ) );
	}

	public static function item( WP_REST_Request $r ) {
		global $wpdb;
		$row = self::row( (int) $r->get_param( 'id' ) );
		if ( ! self::visible( $row ) ) {
			return new WP_Error( 'board', 'This post is not on the board any more.', array( 'status' => 404 ) );
		}
		$uid   = get_current_user_id();
		$admin = self::admin();
		$reps  = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'replies' ) . ' WHERE fb_id = %d' . ( $admin ? '' : ' AND hidden = 0' ) . ' ORDER BY id ASC LIMIT 200', (int) $row['id'] ), ARRAY_A ); // phpcs:ignore
		return array(
			'item'    => self::shape( $row, $uid, $admin ),
			'replies' => array_map( function ( $p ) use ( $uid, $admin ) {
				$who = Sawa_Tracker_Game::person( (int) $p['user_id'] );
				return array( 'id' => (int) $p['id'], 'text' => $p['body'], 'who' => $who['name'], 'avatar' => $who['avatar'] ?? '', 'official' => (int) $p['official'], 'mine' => (int) $p['user_id'] === $uid, 'when' => mysql2date( 'c', $p['created_at'] ), 'hidden' => $admin ? (int) $p['hidden'] : 0 );
			}, (array) $reps ),
			'admin'   => $admin,
		);
	}

	/** A new post on the board: a beta feedback note that is public. */
	public static function post( WP_REST_Request $r ) {
		$kind = (string) $r->get_param( 'kind' );
		if ( ! in_array( $kind, self::KINDS, true ) ) {
			return new WP_Error( 'board', 'Choose: idea, bug or request.', array( 'status' => 400 ) );
		}
		$r->set_param( 'pub', 1 );
		if ( ! $r->get_param( 'area' ) ) {
			$r->set_param( 'area', 'App › Feedback & Dev' );
		}
		return Sawa_Tracker_Feedback::add( $r );
	}

	private static function rescore( $id ) {
		global $wpdb;
		$s = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(v),0) FROM ' . self::t( 'votes' ) . ' WHERE fb_id = %d', $id ) ); // phpcs:ignore
		$wpdb->update( Sawa_Tracker_Feedback::t(), array( 'score' => $s ), array( 'id' => $id ) ); // phpcs:ignore
		return $s;
	}

	private static function renum( $id ) {
		global $wpdb;
		$n = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'replies' ) . ' WHERE fb_id = %d AND hidden = 0', $id ) ); // phpcs:ignore
		$wpdb->update( Sawa_Tracker_Feedback::t(), array( 'nrep' => $n ), array( 'id' => $id ) ); // phpcs:ignore
		return $n;
	}

	public static function vote( WP_REST_Request $r ) {
		global $wpdb;
		$uid = get_current_user_id();
		$row = self::row( (int) $r->get_param( 'id' ) );
		if ( ! self::visible( $row ) ) {
			return new WP_Error( 'board', 'This post is not on the board any more.', array( 'status' => 404 ) );
		}
		if ( (int) $row['user_id'] === $uid ) {
			return new WP_Error( 'board', 'You can\'t vote on your own post.', array( 'status' => 400 ) );
		}
		$v = max( -1, min( 1, (int) $r->get_param( 'v' ) ) );
		if ( $v ) {
			$wpdb->replace( self::t( 'votes' ), array( 'fb_id' => (int) $row['id'], 'user_id' => $uid, 'v' => $v, 'created_at' => current_time( 'mysql' ) ) ); // phpcs:ignore
		} else {
			$wpdb->delete( self::t( 'votes' ), array( 'fb_id' => (int) $row['id'], 'user_id' => $uid ) ); // phpcs:ignore
		}
		return array( 'score' => self::rescore( (int) $row['id'] ), 'my' => $v );
	}

	public static function reply( WP_REST_Request $r ) {
		global $wpdb;
		$uid = get_current_user_id();
		$row = self::row( (int) $r->get_param( 'id' ) );
		if ( ! self::visible( $row ) ) {
			return new WP_Error( 'board', 'This post is not on the board any more.', array( 'status' => 404 ) );
		}
		$text = mb_substr( trim( sanitize_textarea_field( (string) $r->get_param( 'text' ) ) ), 0, 600 );
		if ( mb_strlen( $text ) < 2 ) {
			return new WP_Error( 'board', 'Write a reply first.', array( 'status' => 400 ) );
		}
		$day = Sawa_Tracker_Game::m( $uid, 'fbr_day', array() );
		$n   = is_array( $day ) && ( $day['day'] ?? '' ) === Sawa_Tracker_Game::today() ? (int) $day['n'] : 0;
		if ( $n >= self::REPLIES_PER_DAY && ! self::admin() ) {
			return new WP_Error( 'board', 'That\'s a lot of replies for one day. More tomorrow!', array( 'status' => 429 ) );
		}
		Sawa_Tracker_Game::set( $uid, 'fbr_day', array( 'day' => Sawa_Tracker_Game::today(), 'n' => $n + 1 ) );
		$wpdb->insert( self::t( 'replies' ), array( 'fb_id' => (int) $row['id'], 'user_id' => $uid, 'body' => $text, 'official' => self::admin() ? 1 : 0, 'created_at' => current_time( 'mysql' ) ) ); // phpcs:ignore
		self::renum( (int) $row['id'] );
		return self::item( self::req( (int) $row['id'] ) );
	}

	private static function req( $id ) {
		$q = new WP_REST_Request( 'GET', '/' );
		$q->set_param( 'id', $id );
		return $q;
	}

	/** Admin moderation from the app: hide/show a post or a reply, edit, merge, status + official reply, roadmap link. */
	public static function mod( WP_REST_Request $r ) {
		global $wpdb;
		$t   = Sawa_Tracker_Feedback::t();
		$id  = (int) $r->get_param( 'id' );
		$rid = (int) $r->get_param( 'rid' );
		$act = (string) $r->get_param( 'action' );
		$val = $r->get_param( 'value' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore
		if ( ! $row ) {
			return new WP_Error( 'board', 'Not found.', array( 'status' => 404 ) );
		}
		if ( $rid && in_array( $act, array( 'hide', 'show' ), true ) ) {
			$wpdb->update( self::t( 'replies' ), array( 'hidden' => 'hide' === $act ? 1 : 0 ), array( 'id' => $rid, 'fb_id' => $id ) ); // phpcs:ignore
			self::renum( $id );
		} elseif ( in_array( $act, array( 'hide', 'show' ), true ) ) {
			$wpdb->update( $t, array( 'hidden' => 'hide' === $act ? 1 : 0 ), array( 'id' => $id ) ); // phpcs:ignore
		} elseif ( 'edit' === $act ) {
			$wpdb->update( $t, array( 'body' => mb_substr( trim( sanitize_textarea_field( (string) $val ) ), 0, 2000 ) ), array( 'id' => $id ) ); // phpcs:ignore
		} elseif ( 'road' === $act ) {
			$road = sanitize_key( (string) $val );
			$wpdb->update( $t, array( 'road' => self::road_title( $road ) ? $road : '' ), array( 'id' => $id ) ); // phpcs:ignore
		} elseif ( 'merge' === $act ) {
			$into = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $t WHERE id = %d AND pub = 1 AND merged = 0", (int) $val ), ARRAY_A ); // phpcs:ignore
			if ( ! $into || (int) $into['id'] === $id ) {
				return new WP_Error( 'board', 'Merge into which post? (its number)', array( 'status' => 400 ) );
			}
			$v = self::t( 'votes' );
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO $v (fb_id, user_id, v, created_at) SELECT %d, user_id, v, created_at FROM $v WHERE fb_id = %d", (int) $into['id'], $id ) ); // phpcs:ignore
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO $v (fb_id, user_id, v, created_at) VALUES (%d, %d, 1, %s)", (int) $into['id'], (int) $row['user_id'], current_time( 'mysql' ) ) ); // phpcs:ignore — the author agrees with the post theirs is merged into
			$wpdb->update( $t, array( 'merged' => (int) $into['id'] ), array( 'id' => $id ) ); // phpcs:ignore
			self::rescore( (int) $into['id'] );
			$wpdb->insert( self::t( 'replies' ), array( 'fb_id' => (int) $into['id'], 'user_id' => get_current_user_id(), 'body' => 'Merged #' . $id . ': ' . mb_substr( $row['body'], 0, 300 ), 'official' => 1, 'created_at' => current_time( 'mysql' ) ) ); // phpcs:ignore
			self::renum( (int) $into['id'] );
			return array( 'ok' => true, 'into' => (int) $into['id'] );
		} elseif ( 'status' === $act ) {
			$st    = sanitize_key( (string) $val );
			$reply = sanitize_text_field( (string) $r->get_param( 'reply' ) );
			if ( ! isset( Sawa_Tracker_Feedback::STATUS[ $st ] ) ) {
				return new WP_Error( 'board', 'Unknown status.', array( 'status' => 400 ) );
			}
			$wpdb->update( $t, array( 'status' => $st, 'reply' => $reply ), array( 'id' => $id ) ); // phpcs:ignore
			Sawa_Tracker_Feedback::notify( $row, $st, $reply );
		} else {
			return new WP_Error( 'board', 'Unknown action.', array( 'status' => 400 ) );
		}
		return self::item( self::req( $id ) );
	}

	/* ------------------------------------------------------------------ clarity */

	const ASK = array(
		'en' => array(
			'msg'      => 'Can you tell us a bit more? We want to act on this, but we can\'t tell yet exactly what you mean.',
			'idea'     => 'Nice! Help us picture it: what exactly would you like, and when would you use it?',
			'where'    => 'Where were you? (which screen or feature)',
			'did'      => 'What did you do?',
			'happened' => 'What happened?',
			'expected' => 'What did you expect to happen?',
			'both'     => 'What happened, and what did you expect to happen instead?',
			'what'     => 'What exactly would you like to have?',
			'why'      => 'When would you use it? What do you do now instead?',
			'shot'     => 'A screenshot helps: tap 👆 Point at it, or send one to Sherif in the chat.',
		),
		'ar' => array(
			'msg'      => 'ممكن تقولنا تفاصيل أكتر؟ عايزين نتصرّف، بس لسه مش فاهمين قصدك بالظبط.',
			'idea'     => 'فكرة حلوة! ساعدنا نتخيّلها: نفسك في إيه بالظبط، وهتستخدمها إمتى؟',
			'where'    => 'كنت فين؟ (أنهي صفحة أو ميزة)',
			'did'      => 'عملت إيه؟',
			'happened' => 'حصل إيه؟',
			'expected' => 'كنت متوقع يحصل إيه؟',
			'both'     => 'حصل إيه، وكنت متوقع يحصل إيه بداله؟',
			'what'     => 'نفسك في إيه بالظبط؟',
			'why'      => 'هتستخدمها إمتى؟ وبتعمل إيه دلوقتي بدالها؟',
			'shot'     => 'صورة للشاشة بتساعد: اضغط 👆 وريني فين، أو ابعتها لشريف في الشات.',
		),
	);

	/**
	 * Is the note clear enough to act on? null when it is, else what to ask.
	 * $has_where: the beta button already knows the screen and what was tapped.
	 */
	public static function clarity( $kind, $text, $has_where, $lang ) {
		$lang  = 'ar' === $lang ? 'ar' : 'en';
		$text  = trim( (string) $text );
		$words = $text ? count( preg_split( '/\s+/u', $text ) ) : 0;
		$idea  = in_array( $kind, array( 'idea', 'request' ), true );
		$res   = null;
		if ( $words >= 4 && class_exists( 'Sawa_Lens_AI' ) && method_exists( 'Sawa_Lens_AI', 'feedback_clarity' ) && Sawa_Lens_AI::ready() ) {
			$ai = Sawa_Lens_AI::feedback_clarity( $kind, $text, $has_where );
			if ( is_array( $ai ) ) {
				$res = $ai;
			}
		}
		if ( null === $res ) { // the simple check
			$vague = preg_match( '/\b(doesn\'?t work|not working|does not work|bad|broken|fix (it|this|the)|sucks|hate it|problem|bug|error|wrong)\b|مش شغال|مش بيشتغل|مبيشتغلش|وحش|بايظ|باظ|زفت|مشكلة|صلّ?ح|مش حلو|غلط/iu', $text );
			if ( $idea ) {
				$res = array( 'clear' => $words >= 6, 'missing' => $words >= 6 ? array() : array( 'what', 'why' ) );
			} else {
				$clear = $words >= 14 || ( $words >= 8 && ! $vague );
				$miss  = $clear ? array() : array_values( array_filter( array( $has_where ? '' : 'where', 'did', 'happened', 'expected' ) ) );
				$res   = array( 'clear' => $clear, 'missing' => $miss );
			}
		}
		if ( ! empty( $res['clear'] ) ) {
			return null;
		}
		$a    = self::ASK[ $lang ];
		$miss = array_values( array_intersect( (array) ( $res['missing'] ?? array() ), array( 'where', 'did', 'happened', 'expected', 'what', 'why' ) ) );
		if ( ! $miss ) {
			$miss = $idea ? array( 'what', 'why' ) : array( 'did', 'happened', 'expected' );
		}
		if ( $has_where ) {
			$miss = array_values( array_diff( $miss, array( 'where' ) ) );
		}
		$keys = $miss;
		if ( in_array( 'happened', $keys, true ) && in_array( 'expected', $keys, true ) ) { // one question: what happened, and what did you expect?
			$keys = array_values( array_diff( $keys, array( 'expected' ) ) );
			$keys[ array_search( 'happened', $keys, true ) ] = 'both';
		}
		$prompts = array_map( function ( $k ) use ( $a ) { return $a[ $k ]; }, array_slice( $keys, 0, 3 ) );
		if ( ! $idea ) {
			$prompts[] = $a['shot'];
		}
		return array( 'unclear' => true, 'msg' => $idea ? $a['idea'] : $a['msg'], 'missing' => $miss, 'prompts' => $prompts, 'lang' => $lang );
	}

	/* ------------------------------------------------------------------ wp-admin: Roadmap */

	public static function menu() {
		add_submenu_page( 'sawa-tracker', 'Roadmap', 'Roadmap', 'manage_options', 'sawa-tracker-roadmap', array( __CLASS__, 'page' ) );
	}

	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$over = (array) get_option( 'sawa_tr_roadmap', array() );
		if ( isset( $_POST['sawa_rm_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['sawa_rm_nonce'] ), 'sawa_rm' ) ) {
			$base = json_decode( (string) file_get_contents( SAWA_TR_DIR . 'data/roadmap.json' ), true ); // phpcs:ignore
			$orig = array();
			foreach ( (array) ( $base['items'] ?? array() ) as $i ) {
				$orig[ $i['id'] ] = $i['status'];
			}
			foreach ( (array) ( $_POST['st'] ?? array() ) as $id => $st ) {
				$id = sanitize_key( $id );
				$st = sanitize_key( $st );
				if ( ! in_array( $st, self::ROAD, true ) ) {
					continue;
				}
				if ( isset( $orig[ $id ] ) && $orig[ $id ] === $st ) {
					unset( $over['st'][ $id ], $over['at'][ $id ] );
				} elseif ( isset( $orig[ $id ] ) && ( $over['st'][ $id ] ?? '' ) !== $st ) {
					$over['st'][ $id ] = $st;
					$over['at'][ $id ] = current_time( 'Y-m-d' );
				}
				foreach ( (array) ( $over['add'] ?? array() ) as $k => $a ) {
					if ( $a['id'] === $id ) {
						$over['add'][ $k ]['status'] = $st;
					}
				}
			}
			$title = sanitize_text_field( wp_unslash( $_POST['new_title'] ?? '' ) );
			if ( $title ) {
				$app            = sanitize_key( $_POST['new_app'] ?? 'lens' );
				$over['add'][] = array( 'id' => $app . '-' . substr( sanitize_title( $title ), 0, 40 ) . '-' . wp_rand( 10, 99 ), 'app' => $app, 'group' => '', 'title' => $title, 'desc' => sanitize_text_field( wp_unslash( $_POST['new_desc'] ?? '' ) ), 'status' => in_array( $_POST['new_status'] ?? '', self::ROAD, true ) ? sanitize_key( $_POST['new_status'] ) : 'planned', 'note' => '', 'ver' => '', 'date' => current_time( 'Y-m-d' ), 'file' => '', 'audience' => 'all' );
			}
			update_option( 'sawa_tr_roadmap', $over, false );
			echo '<div class="updated"><p>Saved. Students see it in the app now.</p></div>';
		}
		$r      = self::roadmap();
		$labels = array( 'live' => 'Live', 'beta' => 'Beta', 'progress' => 'In progress', 'planned' => 'Planned', 'later' => 'Later', 'wontdo' => 'Won\'t do' );
		$sel    = function ( $name, $cur ) use ( $labels ) { return '<select name="' . esc_attr( $name ) . '">' . implode( '', array_map( function ( $k, $l ) use ( $cur ) { return '<option value="' . $k . '"' . selected( $cur, $k, false ) . '>' . $l . '</option>'; }, array_keys( $labels ), $labels ) ) . '</select>'; };
		echo '<div class="wrap"><h1>Roadmap</h1><p class="description">What students see in the app under <b>Home → Feedback &amp; Dev → Roadmap</b>. The list comes from <code>sawa-tracker/data/roadmap.json</code> (the same data as FEATURES.md). Moving an item here works right away; to keep it for good, copy <b>Export JSON</b> below into that file and run <code>node tools/features-md.js</code>. Student ideas and bugs are in <a href="' . esc_url( admin_url( 'admin.php?page=sawa-tracker-feedback' ) ) . '">Beta feedback</a> and in the app.</p>';
		echo '<form method="post">' . wp_nonce_field( 'sawa_rm', 'sawa_rm_nonce', true, false );
		echo '<h2>Add an item</h2><p><select name="new_app">' . implode( '', array_map( function ( $k, $l ) { return '<option value="' . esc_attr( $k ) . '">' . esc_html( $l ) . '</option>'; }, array_keys( $r['apps'] ), $r['apps'] ) ) . '</select> <input name="new_title" placeholder="What students get, in plain words" style="width:420px"> <input name="new_desc" placeholder="One more line (optional)" style="width:300px"> ' . $sel( 'new_status', 'planned' ) . '</p>';
		foreach ( array( 'progress', 'planned', 'later', 'wontdo', 'beta', 'live' ) as $col ) {
			$rows = array_filter( $r['items'], function ( $i ) use ( $col ) { return $i['status'] === $col; } );
			echo '<h2>' . esc_html( $labels[ $col ] ) . ' (' . count( $rows ) . ')</h2><table class="widefat striped" style="max-width:1100px"><tbody>';
			foreach ( $rows as $i ) {
				echo '<tr><td style="width:150px">' . esc_html( $r['apps'][ $i['app'] ] ?? $i['app'] ) . '</td><td>' . esc_html( $i['title'] ) . ( ! empty( $i['desc'] ) ? '<br><small>' . esc_html( $i['desc'] ) . '</small>' : '' ) . '<br><small><code>' . esc_html( $i['id'] ) . '</code>' . ( ! empty( $i['moved'] ) ? ' · moved ' . esc_html( $i['moved'] ) : '' ) . '</small></td><td style="width:110px">' . esc_html( $i['ver'] ?? '' ) . '</td><td style="width:140px">' . $sel( 'st[' . $i['id'] . ']', $i['status'] ) . '</td></tr>';
			}
			echo '</tbody></table>';
		}
		echo '<p><button class="button button-primary">Save</button></p></form>';
		$export = array( 'v' => 1, 'updated' => current_time( 'Y-m-d' ) ) + $r;
		foreach ( $export['items'] as &$i ) {
			unset( $i['moved'] );
		}
		unset( $i );
		echo '<h2>Export JSON</h2><textarea readonly style="width:100%;max-width:1100px;height:160px;font-family:monospace;font-size:11px">' . esc_textarea( wp_json_encode( $export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) . '</textarea></div>';
	}
}
