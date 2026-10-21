<?php
/**
 * Teacher dashboard in wp-admin: access requests, students, notes for the teacher, settings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_sawa_tr_access', array( __CLASS__, 'access' ) );
		add_action( 'admin_post_sawa_tr_settings', array( __CLASS__, 'save_settings' ) );
		add_action( 'admin_post_sawa_tr_clans', array( __CLASS__, 'clans_action' ) );
		add_action( 'admin_post_sawa_tr_quest', array( __CLASS__, 'save_quest' ) );
		add_action( 'admin_post_sawa_tr_mod', array( __CLASS__, 'mod_action' ) );
	}

	private static function guard( $nonce ) {
		check_admin_referer( $nonce );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
	}

	private static function back( $tab, $msg ) {
		set_transient( 'sawa_tr_admin_msg', $msg, 60 );
		wp_safe_redirect( admin_url( 'admin.php?page=sawa-tracker&tab=' . $tab . '&msg=1' ) );
		exit;
	}

	public static function clans_action() {
		self::guard( 'sawa_tr_clans' );
		$do = isset( $_POST['do'] ) ? sanitize_key( $_POST['do'] ) : '';
		$S  = 'Sawa_Tracker_Social';
		if ( 'create' === $do ) {
			$name  = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
			$emoji = sanitize_text_field( wp_unslash( $_POST['emoji'] ?? '' ) );
			$S::create_clan( $name, $emoji ? $emoji : '🛡️' );
			self::back( 'clans', 'Clan created.' );
		}
		if ( 'auto' === $do ) {
			$n = $S::auto_assign( (int) ( $_POST['size'] ?? 8 ) );
			self::back( 'clans', $n ? sprintf( '%d students were placed into clans.', $n ) : 'Everyone who has started playing is already in a clan.' );
		}
		if ( isset( $_POST['delete'] ) ) {
			$S::delete_clan( (int) $_POST['delete'] );
			self::back( 'clans', 'Clan deleted. Its members are now unassigned.' );
		}
		if ( 'save' === $do ) {
			foreach ( (array) ( $_POST['clan'] ?? array() ) as $id => $c ) {
				$S::update_clan( (int) $id, sanitize_text_field( wp_unslash( $c['name'] ?? '' ) ), sanitize_text_field( wp_unslash( $c['emoji'] ?? '' ) ) );
			}
			foreach ( (array) ( $_POST['member'] ?? array() ) as $uid => $clan ) {
				$S::set_clan( (int) $uid, (int) $clan );
			}
			self::back( 'clans', 'Clans saved.' );
		}
		if ( isset( $_POST['delete'] ) ) {
			$S::delete_clan( (int) $_POST['delete'] );
			self::back( 'clans', 'Clan deleted. Its members are now unassigned.' );
		}
		self::back( 'clans', 'Nothing changed.' );
	}

	public static function save_quest() {
		self::guard( 'sawa_tr_quest' );
		update_option(
			'sawa_tr_quest',
			array(
				'day'  => Sawa_Tracker_Game::today(),
				'text' => sanitize_text_field( wp_unslash( $_POST['text'] ?? '' ) ),
				'sp'   => max( 0, min( 10, (int) ( $_POST['sp'] ?? 2 ) ) ),
			),
			false
		);
		self::back( 'daily', '' === trim( (string) ( $_POST['text'] ?? '' ) ) ? 'Today\'s quest is cleared.' : 'Today\'s quest is live in the app.' );
	}

	public static function mod_action() {
		global $wpdb;
		self::guard( 'sawa_tr_mod' );
		list( $do, $rid ) = array_pad( explode( ':', sanitize_text_field( wp_unslash( $_POST['act'] ?? '' ) ) ), 2, 0 );
		$rep = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . Sawa_Tracker_Game::table( 'reports' ) . ' WHERE id = %d', (int) $rid ), ARRAY_A ); // phpcs:ignore
		if ( ! $rep ) {
			self::back( 'moderation', 'Report not found.' );
		}
		$msg = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . Sawa_Tracker_Game::table( 'messages' ) . ' WHERE id = %d', (int) $rep['message_id'] ), ARRAY_A ); // phpcs:ignore
		$all = array( 'resolved' => 1 );
		if ( 'delete' === $do || 'mute' === $do ) {
			$wpdb->update( Sawa_Tracker_Game::table( 'messages' ), array( 'deleted' => 1 ), array( 'id' => (int) $rep['message_id'] ) ); // phpcs:ignore
		}
		if ( 'mute' === $do && $msg ) {
			Sawa_Tracker_Game::set( (int) $msg['user_id'], 'muted_until', Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), 7 ) );
		}
		$wpdb->update( Sawa_Tracker_Game::table( 'reports' ), $all, array( 'message_id' => (int) $rep['message_id'] ) ); // phpcs:ignore
		$words = array(
			'delete'  => 'Message deleted.',
			'mute'    => 'Message deleted and the author muted for 7 days.',
			'dismiss' => 'Report dismissed.',
		);
		self::back( 'moderation', $words[ $do ] ?? 'Done.' );
	}

	private static function pending_ids() {
		return get_users(
			array(
				'meta_key'   => 'sawa_status', // phpcs:ignore
				'meta_value' => 'pending', // phpcs:ignore
				'fields'     => 'ID',
				'orderby'    => 'registered',
				'order'      => 'DESC',
			)
		);
	}

	public static function menu() {
		$n     = count( self::pending_ids() );
		$label = 'Sawa Tracker' . ( $n ? ' <span class="awaiting-mod"><span class="pending-count">' . $n . '</span></span>' : '' );
		add_menu_page( 'Sawa Tracker', $label, 'manage_options', 'sawa-tracker', array( __CLASS__, 'page' ), 'dashicons-awards', 26 );
	}

	public static function access() {
		check_admin_referer( 'sawa_tr_access' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		$do  = isset( $_POST['do'] ) ? sanitize_key( $_POST['do'] ) : '';
		$ids = isset( $_POST['ids'] ) ? array_map( 'intval', (array) $_POST['ids'] ) : array();
		if ( isset( $_POST['one'] ) ) {
			list( $do, $one ) = array_pad( explode( ':', sanitize_text_field( wp_unslash( $_POST['one'] ) ) ), 2, 0 );
			$ids              = array( (int) $one );
		}
		$page = get_option( 'sawa_tr_page', home_url( '/' ) );
		$n    = 0;
		foreach ( $ids as $id ) {
			$u = get_userdata( $id );
			if ( ! $u ) {
				continue;
			}
			if ( 'approve' === $do ) {
				Sawa_Tracker_Game::set( $id, 'status', 'approved' );
				wp_mail(
					$u->user_email,
					'اتفعلت! أهلًا بيك في تراكر سوا انجليش',
					sprintf( "أهلًا يا %s،\n\nحسابك في تراكر سوا انجليش اتفعل. ادخل من هنا واختار الكلاس وسجّل أول نشاط:\n%s\n\nنشوفك في الترتيب.\nسوا انجليش", $u->display_name, $page )
				);
				++$n;
			} elseif ( 'deny' === $do ) {
				Sawa_Tracker_Game::set( $id, 'status', 'denied' );
				++$n;
			} elseif ( 'revoke' === $do ) {
				Sawa_Tracker_Game::set( $id, 'status', 'denied' );
				++$n;
			}
		}
		Sawa_Tracker_Game::bust_boards();
		$tab = isset( $_POST['tab'] ) ? sanitize_key( $_POST['tab'] ) : 'requests';
		wp_safe_redirect( admin_url( 'admin.php?page=sawa-tracker&tab=' . $tab . '&done=' . $n . '&what=' . $do ) );
		exit;
	}

	public static function save_settings() {
		check_admin_referer( 'sawa_tr_settings' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		$in  = isset( $_POST['s'] ) ? (array) wp_unslash( $_POST['s'] ) : array(); // phpcs:ignore
		$d   = Sawa_Tracker_Game::defaults();
		$out = array();
		$lim = array(
			'daily_goal'   => array( 5, 600 ),
			'gain_goal'    => array( 0, 50 ),
			'gain_partial' => array( 0, 50 ),
			'decay'        => array( 0, 100 ),
			'start_health' => array( 0, 100 ),
			'sp_daily_cap' => array( 1, 50 ),
			'boss_hp'      => array( 100, 1000000 ),
		);
		foreach ( $lim as $k => $r ) {
			$out[ $k ] = max( $r[0], min( $r[1], (int) ( $in[ $k ] ?? $d[ $k ] ) ) );
		}
		$out['notify_admin']  = empty( $in['notify_admin'] ) ? 0 : 1;
		$out['chat_enabled']  = empty( $in['chat_enabled'] ) ? 0 : 1;
		$out['blocked_words'] = sanitize_textarea_field( $in['blocked_words'] ?? '' );
		$out['skool_url']     = esc_url_raw( $in['skool_url'] ?? $d['skool_url'] );
		$out['clan_size']     = max( 3, min( 20, (int) ( $in['clan_size'] ?? $d['clan_size'] ) ) );
		$out['chat_max_row']  = max( 2, min( 30, (int) ( $in['chat_max_row'] ?? $d['chat_max_row'] ) ) );
		$out['giphy_key']     = preg_replace( '/[^A-Za-z0-9]/', '', (string) ( $in['giphy_key'] ?? '' ) );
		update_option( 'sawa_tr_settings', $out );
		// Apply a new boss HP to the current week too.
		$b = get_option( 'sawa_tr_boss', array() );
		if ( $b ) {
			$b['hp'] = $out['boss_hp'];
			update_option( 'sawa_tr_boss', $b, false );
		}
		wp_safe_redirect( admin_url( 'admin.php?page=sawa-tracker&tab=settings&saved=1' ) );
		exit;
	}

	public static function page() {
		$tab  = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'requests'; // phpcs:ignore
		global $wpdb;
		$open_reports = (int) $wpdb->get_var( 'SELECT COUNT(DISTINCT message_id) FROM ' . Sawa_Tracker_Game::table( 'reports' ) . ' WHERE resolved = 0' ); // phpcs:ignore
		$tabs = array(
			'requests'   => 'Access requests',
			'daily'      => 'Daily post & quest',
			'students'   => 'Students',
			'clans'      => 'Clans',
			'notes'      => 'Notes for the teacher',
			'moderation' => 'Chat moderation' . ( $open_reports ? " ($open_reports)" : '' ),
			'settings'   => 'Settings',
		);
		if ( isset( $_GET['msg'] ) && ( $m = get_transient( 'sawa_tr_admin_msg' ) ) ) { // phpcs:ignore
			delete_transient( 'sawa_tr_admin_msg' );
			add_action(
				'sawa_tr_notice',
				function () use ( $m ) {
					echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $m ) . '</p></div>';
				}
			);
		}
		$page = get_option( 'sawa_tr_page' );
		echo '<div class="wrap"><h1>Sawa Tracker</h1>';
		if ( ! $page ) {
			echo '<div class="notice notice-info"><p>Create a page (for example <b>Tracker</b>), add a <b>Shortcode</b> widget or block with <code>[sawa_tracker]</code>, and publish it. That page is the app.</p></div>';
		} else {
			echo '<p>The app lives at <a href="' . esc_url( $page ) . '" target="_blank" rel="noopener">' . esc_html( $page ) . '</a>. Share that link with your students.</p>';
		}
		if ( isset( $_GET['done'] ) ) { // phpcs:ignore
			$words = array(
				'approve' => 'approved',
				'deny'    => 'declined',
				'revoke'  => 'removed from the tracker',
			);
			$what  = $words[ sanitize_key( $_GET['what'] ?? '' ) ] ?? 'updated'; // phpcs:ignore
			echo '<div class="notice notice-success is-dismissible"><p>' . (int) $_GET['done'] . ' student(s) ' . esc_html( $what ) . '.</p></div>'; // phpcs:ignore
		}
		if ( isset( $_GET['saved'] ) ) { // phpcs:ignore
			echo '<div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>';
		}
		do_action( 'sawa_tr_notice' );
		echo '<nav class="nav-tab-wrapper">';
		foreach ( $tabs as $k => $label ) {
			if ( 'requests' === $k ) {
				$n      = count( self::pending_ids() );
				$label .= $n ? " ($n)" : '';
			}
			echo '<a class="nav-tab' . ( $tab === $k ? ' nav-tab-active' : '' ) . '" href="' . esc_url( admin_url( 'admin.php?page=sawa-tracker&tab=' . $k ) ) . '">' . esc_html( $label ) . '</a>';
		}
		echo '</nav><div style="margin-top:16px">';
		call_user_func( array( __CLASS__, 'tab_' . ( isset( $tabs[ $tab ] ) ? $tab : 'requests' ) ) );
		echo '</div></div>';
	}

	private static function form_open( $tab ) {
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sawa_tr_access' );
		echo '<input type="hidden" name="action" value="sawa_tr_access"><input type="hidden" name="tab" value="' . esc_attr( $tab ) . '">';
	}

	private static function tab_requests() {
		$ids = self::pending_ids();
		if ( ! $ids ) {
			echo '<p>No one is waiting. New requests show up here, and you get an email for each one.</p>';
			return;
		}
		self::form_open( 'requests' );
		echo '<p><select name="do"><option value="approve">Approve selected</option><option value="deny">Decline selected</option></select> <button class="button button-primary">Apply</button></p>';
		echo '<table class="widefat striped"><thead><tr><td class="check-column"><input type="checkbox" onclick="document.querySelectorAll(\'.sawa-pick\').forEach(c=>c.checked=this.checked)"></td><th>Name</th><th>Email</th><th>Note</th><th>Asked</th><th></th></tr></thead><tbody>';
		foreach ( $ids as $id ) {
			$u = get_userdata( $id );
			echo '<tr><th class="check-column"><input type="checkbox" class="sawa-pick" name="ids[]" value="' . (int) $id . '"></th>';
			echo '<td><strong>' . esc_html( $u->display_name ) . '</strong></td><td>' . esc_html( $u->user_email ) . '</td>';
			echo '<td dir="auto">' . esc_html( (string) Sawa_Tracker_Game::m( $id, 'request_note' ) ) . '</td>';
			echo '<td>' . esc_html( human_time_diff( strtotime( $u->user_registered . ' UTC' ) ) ) . ' ago</td>';
			echo '<td><button class="button button-primary" name="one" value="approve:' . (int) $id . '">Approve</button> <button class="button" name="one" value="deny:' . (int) $id . '">Decline</button></td></tr>';
		}
		echo '</tbody></table></form>';
	}

	private static function tab_students() {
		$ids = Sawa_Tracker_Game::member_ids();
		$rows = array();
		global $wpdb;
		$logs = Sawa_Tracker_Game::table( 'logs' );
		$tot  = array();
		$last = array();
		if ( $ids ) {
			$in = implode( ',', $ids );
			foreach ( $wpdb->get_results( "SELECT user_id, SUM(minutes) m, MAX(day) d FROM $logs WHERE user_id IN ($in) GROUP BY user_id" ) as $r ) { // phpcs:ignore
				$tot[ (int) $r->user_id ]  = (int) $r->m;
				$last[ (int) $r->user_id ] = $r->d;
			}
		}
		foreach ( $ids as $id ) {
			Sawa_Tracker_Game::process_user( $id );
			$l      = Sawa_Tracker_Game::live( $id );
			$p      = Sawa_Tracker_Game::person( $id );
			$rows[] = $p + $l + array(
				'total' => $tot[ $id ] ?? 0,
				'last'  => $last[ $id ] ?? '',
				'email' => get_userdata( $id )->user_email,
			);
		}
		usort(
			$rows,
			function ( $a, $b ) {
				return strcmp( $b['last'], $a['last'] );
			}
		);
		echo '<p>' . count( $rows ) . ' students have access. Sorted by most recently active. Students marked <b>needs a nudge</b> have health under 30%.</p>';
		self::form_open( 'students' );
		echo '<table class="widefat striped"><thead><tr><th>Name</th><th>Class</th><th>Level</th><th>Health</th><th>Streak</th><th>Study days</th><th>Total time</th><th>Last active</th><th></th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$cls = $r['class'] ? Sawa_Tracker_Game::CLASSES[ $r['class'] ]['icon'] . ' ' . Sawa_Tracker_Game::CLASSES[ $r['class'] ]['name'] : '<em>not started</em>';
			echo '<tr><td><strong dir="auto">' . esc_html( $r['name'] ) . '</strong><br><small>' . esc_html( $r['email'] ) . '</small></td>';
			echo '<td>' . wp_kses_post( $cls ) . '</td><td>' . (int) $r['level'] . ' · ' . esc_html( $r['title'] ) . '</td>';
			echo '<td>' . (int) $r['health'] . '%' . ( $r['class'] && $r['health'] < 30 ? ' <span style="color:#b32d2e;font-weight:600">needs a nudge</span>' : '' ) . '</td>';
			echo '<td>' . (int) $r['streak'] . ' 🔥</td><td>' . (int) $r['studyDays'] . '</td>';
			echo '<td>' . esc_html( floor( $r['total'] / 60 ) . 'h ' . ( $r['total'] % 60 ) . 'm' ) . '</td>';
			echo '<td>' . esc_html( $r['last'] ? $r['last'] : '—' ) . '</td>';
			echo '<td>' . ( user_can( $r['id'], 'manage_options' ) ? '' : '<button class="button-link-delete" name="one" value="revoke:' . (int) $r['id'] . '" onclick="return confirm(\'Remove this student\\\'s access? Their history is kept.\')">Remove access</button>' ) . '</td></tr>';
		}
		echo '</tbody></table></form>';
	}

	private static function tab_notes() {
		global $wpdb;
		$t    = Sawa_Tracker_Game::table( 'days' );
		$rows = $wpdb->get_results( "SELECT * FROM $t WHERE (teacher_note IS NOT NULL AND teacher_note <> '') OR mood_after IS NOT NULL ORDER BY day DESC LIMIT 200", ARRAY_A ); // phpcs:ignore
		if ( ! $rows ) {
			echo '<p>When students finish <b>Log your day</b>, their mood and any note they leave for you appear here.</p>';
			return;
		}
		echo '<table class="widefat striped"><thead><tr><th>Day</th><th>Student</th><th>Mood</th><th>Studied</th><th>Note for you</th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$p    = Sawa_Tracker_Game::person( (int) $r['user_id'] );
			$mood = $r['mood_after'] ? ( $r['mood_before'] ? (int) $r['mood_before'] . ' → ' : '' ) . (int) $r['mood_after'] . '/10' : '—';
			echo '<tr><td>' . esc_html( $r['day'] ) . '</td><td dir="auto"><strong>' . esc_html( $p['name'] ) . '</strong></td><td>' . esc_html( $mood ) . '</td><td>' . (int) $r['minutes'] . ' min</td><td dir="auto" style="white-space:pre-line">' . esc_html( (string) $r['teacher_note'] ) . '</td></tr>';
		}
		echo '</tbody></table>';
	}

	private static function tab_daily() {
		$q     = get_option( 'sawa_tr_quest', array() );
		$today = Sawa_Tracker_Game::today();
		$live  = ! empty( $q['day'] ) && $q['day'] === $today;
		echo '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px;align-items:start">';
		echo '<div class="card" style="max-width:none;margin:0"><h2>Today\'s quest</h2><p>One small task for everyone today. Students tap <b>Done</b> in the app and get bonus skill points. It shows up in the feed and in your Skool post. A new day starts with no quest until you set one.</p>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sawa_tr_quest' );
		echo '<input type="hidden" name="action" value="sawa_tr_quest">';
		echo '<p><label for="q-text"><b>Quest</b></label><br><input id="q-text" name="text" class="large-text" maxlength="200" placeholder="e.g. Record a 1-minute voice note describing your morning" value="' . esc_attr( $live ? $q['text'] : '' ) . '"></p>';
		echo '<p><label>Bonus (× 3 coins) <input type="number" name="sp" min="0" max="10" value="' . (int) ( $live ? $q['sp'] : 2 ) . '" class="small-text"></label></p>';
		submit_button( $live ? 'Update today\'s quest' : 'Set today\'s quest', 'primary', 'submit', false );
		global $wpdb;
		$done = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . Sawa_Tracker_Game::table( 'events' ) . " WHERE type = 'quest_done' AND created_at >= %s", $today . ' 00:00:00' ) ); // phpcs:ignore
		echo $live ? '<p class="description">' . (int) $done . ' students finished it so far.</p>' : '';
		echo '</form></div>';
		echo '<div class="card" style="max-width:none;margin:0"><h2>Your Skool post for today</h2><p>Copy this into your daily check-in post on Skool. It updates every time you open this page.</p>';
		echo '<textarea id="sawa-post" class="large-text" rows="14" readonly dir="auto">' . esc_textarea( Sawa_Tracker_Social::daily_post() ) . '</textarea>';
		echo '<p><button type="button" class="button button-primary" onclick="var t=document.getElementById(\'sawa-post\');t.select();navigator.clipboard?navigator.clipboard.writeText(t.value).then(()=>{this.textContent=\'Copied!\'}):document.execCommand(\'copy\')">Copy post</button> ';
		echo '<a class="button" href="' . esc_url( Sawa_Tracker_Game::settings()['skool_url'] ) . '" target="_blank" rel="noopener">Open Skool</a></p></div></div>';
	}

	private static function tab_clans() {
		$S     = 'Sawa_Tracker_Social';
		$clans = $S::clans();
		$opts  = array( 0 => '— No clan —' );
		foreach ( $clans as $c ) {
			$opts[ (int) $c['id'] ] = $c['emoji'] . ' ' . $c['name'];
		}
		echo '<p>Clans are teams of students who study together. A clan\'s streak continues on days when at least 60% of its members study. Its weekly score is the average number of days members reached their daily goal.</p>';
		echo '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 20px">';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="card" style="margin:0">';
		wp_nonce_field( 'sawa_tr_clans' );
		echo '<input type="hidden" name="action" value="sawa_tr_clans"><input type="hidden" name="do" value="auto"><h3 style="margin-top:0">Auto-assign</h3><p>Puts every active student without a clan into one, mixing experienced and new students so clans are even. Creates new clans when needed.</p>';
		echo '<p><label>Clan size <input type="number" name="size" min="3" max="20" class="small-text" value="' . (int) Sawa_Tracker_Game::settings()['clan_size'] . '"></label> ';
		submit_button( 'Auto-assign students', 'primary', 'submit', false );
		echo '</p></form>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="card" style="margin:0">';
		wp_nonce_field( 'sawa_tr_clans' );
		echo '<input type="hidden" name="action" value="sawa_tr_clans"><input type="hidden" name="do" value="create"><h3 style="margin-top:0">New clan</h3>';
		echo '<p><input name="emoji" placeholder="🦁" class="small-text" maxlength="8" aria-label="Emoji"> <input name="name" placeholder="The Lions" maxlength="60" aria-label="Clan name" required> ';
		submit_button( 'Create clan', 'secondary', 'submit', false );
		echo '</p></form></div>';

		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sawa_tr_clans' );
		echo '<input type="hidden" name="action" value="sawa_tr_clans"><input type="hidden" name="do" value="save">';
		if ( $clans ) {
			echo '<h2>Clans this week</h2><table class="widefat striped" style="max-width:900px"><thead><tr><th>Emoji</th><th>Name</th><th>Members</th><th>Clan streak</th><th>Weekly score</th><th></th></tr></thead><tbody>';
			$stand = array();
			foreach ( $S::standings() as $st ) {
				$stand[ $st['id'] ] = $st;
			}
			foreach ( $clans as $c ) {
				$st = $stand[ (int) $c['id'] ] ?? array( 'size' => 0, 'streak' => 0, 'score' => 0 );
				echo '<tr><td><input name="clan[' . (int) $c['id'] . '][emoji]" value="' . esc_attr( $c['emoji'] ) . '" class="small-text"></td><td><input name="clan[' . (int) $c['id'] . '][name]" value="' . esc_attr( $c['name'] ) . '"></td>';
				echo '<td>' . (int) $st['size'] . '</td><td>' . (int) $st['streak'] . ' 🔥</td><td>' . esc_html( (string) $st['score'] ) . ' goal days per member</td>';
				echo '<td><button class="button-link-delete" name="delete" value="' . (int) $c['id'] . '" onclick="return confirm(\'Delete this clan and its chat? Members become unassigned.\')">Delete</button></td></tr>';
			}
			echo '</tbody></table>';
		}
		echo '<h2>Who is in which clan</h2><table class="widefat striped" style="max-width:900px"><thead><tr><th>Student</th><th>Level</th><th>Study days</th><th>Clan</th></tr></thead><tbody>';
		foreach ( Sawa_Tracker_Game::member_ids() as $uid ) {
			$p = Sawa_Tracker_Game::person( $uid );
			$l = Sawa_Tracker_Game::level_for( Sawa_Tracker_Game::study_days( $uid ) );
			echo '<tr><td dir="auto"><strong>' . esc_html( $p['name'] ) . '</strong> ' . esc_html( $p['icon'] ) . '</td><td>' . (int) $l['level'] . '</td><td>' . (int) Sawa_Tracker_Game::study_days( $uid ) . '</td><td>';
			echo self::select_html( 'member[' . (int) $uid . ']', $opts, $S::clan_of( $uid ) ); // phpcs:ignore
			echo '</td></tr>';
		}
		echo '</tbody></table>';
		submit_button( 'Save clans' );
		echo '</form>';
	}

	private static function select_html( $name, $opts, $cur ) {
		$h = '<select name="' . esc_attr( $name ) . '">';
		foreach ( $opts as $v => $l ) {
			$h .= '<option value="' . esc_attr( $v ) . '"' . selected( (string) $cur, (string) $v, false ) . '>' . esc_html( $l ) . '</option>';
		}
		return $h . '</select>';
	}

	private static function tab_moderation() {
		global $wpdb;
		$rt   = Sawa_Tracker_Game::table( 'reports' );
		$mt   = Sawa_Tracker_Game::table( 'messages' );
		$rows = $wpdb->get_results( "SELECT r.*, m.body, m.audio, m.user_id AS author, m.room_id, m.created_at AS sent, m.deleted FROM $rt r JOIN $mt m ON m.id = r.message_id WHERE r.id IN (SELECT MAX(id) FROM $rt WHERE resolved = 0 GROUP BY message_id) ORDER BY r.id DESC LIMIT 100", ARRAY_A ); // phpcs:ignore
		echo '<p>Students can report any chat message. Reported messages appear here with the messages just before them, so you can see the context. Muting stops someone from sending messages for 7 days. They can still read.</p>';
		if ( ! $rows ) {
			echo '<p><b>Nothing to review.</b></p>';
			return;
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sawa_tr_mod' );
		echo '<input type="hidden" name="action" value="sawa_tr_mod">';
		foreach ( $rows as $r ) {
			$room   = Sawa_Tracker_Social::room( (int) $r['room_id'] );
			$author = Sawa_Tracker_Game::person( (int) $r['author'] );
			$rep    = Sawa_Tracker_Game::person( (int) $r['reporter_id'] );
			$before = array_reverse( $wpdb->get_results( $wpdb->prepare( "SELECT user_id, body, audio FROM $mt WHERE room_id = %d AND id < %d ORDER BY id DESC LIMIT 4", $r['room_id'], $r['message_id'] ), ARRAY_A ) ); // phpcs:ignore
			echo '<div class="card" style="max-width:820px"><p style="margin-top:0"><b>' . esc_html( $author['name'] ) . '</b> in <b>' . esc_html( $room ? ( 'public' === $room['type'] ? 'Community' : $room['name'] ) : 'a deleted chat' ) . '</b> · reported by ' . esc_html( $rep['name'] ) . ( $r['reason'] ? ': “' . esc_html( $r['reason'] ) . '”' : '' ) . '</p>';
			foreach ( $before as $b ) {
				echo '<p style="color:#646970;margin:2px 0" dir="auto">' . esc_html( Sawa_Tracker_Game::person( (int) $b['user_id'] )['name'] ) . ': ' . esc_html( $b['audio'] ? '🎤 voice message' : $b['body'] ) . '</p>';
			}
			echo '<p style="background:#fcf0f1;padding:8px 10px;border-radius:4px" dir="auto"><b>' . esc_html( $author['name'] ) . ':</b> ' . esc_html( (string) $r['body'] ) . ( $r['audio'] ? ' <audio controls src="' . esc_url( $r['audio'] ) . '"></audio>' : '' ) . ( $r['deleted'] ? ' <em>(already deleted)</em>' : '' ) . '</p>';
			echo '<p><button class="button button-primary" name="act" value="delete:' . (int) $r['id'] . '">Delete message</button> <button class="button" name="act" value="mute:' . (int) $r['id'] . '">Delete and mute for 7 days</button> <button class="button-link" name="act" value="dismiss:' . (int) $r['id'] . '">Dismiss, it\'s fine</button></p></div>';
		}
		echo '</form>';
	}

	private static function tab_settings() {
		$s = Sawa_Tracker_Game::settings();
		$f = function ( $k, $label, $help, $unit = '' ) use ( $s ) {
			echo '<tr><th scope="row"><label for="s-' . esc_attr( $k ) . '">' . esc_html( $label ) . '</label></th><td><input id="s-' . esc_attr( $k ) . '" type="number" class="small-text" name="s[' . esc_attr( $k ) . ']" value="' . (int) $s[ $k ] . '"> ' . esc_html( $unit ) . '<p class="description">' . esc_html( $help ) . '</p></td></tr>';
		};
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sawa_tr_settings' );
		echo '<input type="hidden" name="action" value="sawa_tr_settings"><table class="form-table" role="presentation">';
		$f( 'daily_goal', 'Default daily goal', 'Minutes per day. Students can change their own goal in the app.', 'minutes' );
		$f( 'gain_goal', 'Health gained on a goal day', 'Habit health added when a student reaches their daily goal.', '%' );
		$f( 'gain_partial', 'Health gained on a short day', 'Added when they studied, but less than their goal.', '%' );
		$f( 'decay', 'Health lost on a missed day', 'Taken away for each day with no study, unless they are shielded.', '%' );
		$f( 'start_health', 'Starting health', 'Health a new student starts with.', '%' );
		$f( 'sp_daily_cap', 'Skill points per day (max)', 'Students earn 1 skill point per activity, up to this many a day.', 'SP' );
		$f( 'boss_hp', 'Weekly boss health', 'Every minute anyone studies does 1 damage. Pick a number your community can beat with effort.', 'minutes' );
		echo '<tr><th scope="row">Emails</th><td><label><input type="checkbox" name="s[notify_admin]" value="1" ' . checked( $s['notify_admin'], 1, false ) . '> Email me when someone asks to join or reports a chat message</label></td></tr>';
		$f( 'clan_size', 'Clan size for auto-assign', 'How many students go in each clan when you click Auto-assign. 6 to 8 works well.', 'students' );
		echo '<tr><th scope="row">Chat</th><td><label><input type="checkbox" name="s[chat_enabled]" value="1" ' . checked( $s['chat_enabled'], 1, false ) . '> Students can send chat messages</label><p class="description">Turn this off to pause all chats. You can still post.</p></td></tr>';
		echo '<tr><th scope="row"><label for="s-row">Messages in a row</label></th><td><input id="s-row" type="number" min="2" max="30" name="s[chat_max_row]" value="' . esc_attr( (int) ( $s['chat_max_row'] ?? 5 ) ) . '" class="small-text"><p class="description">Spam protection: a student can send at most this many messages in a row in one chat, until someone else writes (or 15 minutes pass).</p></td></tr>';
		echo '<tr><th scope="row"><label for="s-giphy">GIPHY API key</label></th><td><input id="s-giphy" class="regular-text" name="s[giphy_key]" value="' . esc_attr( (string) ( $s['giphy_key'] ?? '' ) ) . '" autocomplete="off"><p class="description">Optional. Turns on GIF search in the chat (family-friendly GIFs only). Free key: developers.giphy.com → Create an App → API. Without it, students still have the Sawa English sticker pack.</p></td></tr>';
		echo '<tr><th scope="row"><label for="s-words">Blocked words</label></th><td><textarea id="s-words" class="large-text" rows="3" name="s[blocked_words]" placeholder="word one, word two">' . esc_textarea( $s['blocked_words'] ) . '</textarea><p class="description">Comma-separated. These are replaced with *** in chat messages and group names. Works for English and Arabic.</p></td></tr>';
		echo '<tr><th scope="row"><label for="s-skool">Skool community link</label></th><td><input id="s-skool" type="url" class="regular-text" name="s[skool_url]" value="' . esc_attr( $s['skool_url'] ) . '"><p class="description">Used by the students\' "Share to Skool" button.</p></td></tr>';
		echo '</table>';
		submit_button( 'Save settings' );
		echo '</form>';
	}
}
