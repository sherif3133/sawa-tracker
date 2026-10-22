<?php
/**
 * CS lists (admin only): who to message today. One tab in Sawa Tracker → "CS lists" with
 * joined today / this week · day 3 with no study · 5 and 10 days gone · on a 7-day run · day 30,
 * each with names to copy and a CSV download. Reads the tracker's own data only; changes nothing.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_CS {

	/** Section key => array( title, what it means ). Order = order on the page. */
	const SECTIONS = array(
		'today'   => array( 'Joined today', 'Joined today: welcome them.' ),
		'week'    => array( 'Joined this week', 'Joined in the last 7 days (including today).' ),
		'day3'    => array( 'Day 3, no study yet', 'Joined 3 to 5 days ago and have not studied even once. The 3-day window means a missed day is still caught.' ),
		'gone5'   => array( '5 days without activity', 'Last activity 5 to 9 days ago (or none since joining 5+ days ago).' ),
		'gone10'  => array( '10+ days without activity', 'Last activity 10 or more days ago (or none since joining 10+ days ago).' ),
		'run7'    => array( 'Hit a 7-day run', 'Current streak is 7 to 13 days: a good moment to congratulate them.' ),
		'day30'   => array( 'Day 30', 'Joined 30 to 32 days ago: the 30-day check-in.' ),
	);

	public static function init() {
		add_action( 'admin_post_sawa_tr_cs_csv', array( __CLASS__, 'csv' ) );
	}

	/** Days between two Y-m-d dates (b - a). */
	private static function diff( $a, $b ) {
		return (int) floor( ( strtotime( $b . ' 12:00:00 UTC' ) - strtotime( $a . ' 12:00:00 UTC' ) ) / DAY_IN_SECONDS );
	}

	/** Every approved student with the numbers the lists need. */
	public static function students( $today = null ) {
		global $wpdb;
		$today = $today ? $today : Sawa_Tracker_Game::today();
		$ids   = array_filter(
			Sawa_Tracker_Game::member_ids(),
			function ( $id ) {
				return ! user_can( $id, 'manage_options' ); // staff are not students
			}
		);
		$last = array();
		if ( $ids ) {
			$logs = Sawa_Tracker_Game::table( 'logs' );
			$in   = implode( ',', array_map( 'intval', $ids ) );
			foreach ( $wpdb->get_results( "SELECT user_id, MAX(day) d FROM $logs WHERE user_id IN ($in) GROUP BY user_id" ) as $r ) { // phpcs:ignore
				$last[ (int) $r->user_id ] = $r->d;
			}
		}
		$out = array();
		foreach ( $ids as $id ) {
			$u = get_userdata( $id );
			if ( ! $u ) {
				continue;
			}
			Sawa_Tracker_Game::process_user( $id );
			$l      = Sawa_Tracker_Game::live( $id );
			$join   = (string) Sawa_Tracker_Game::m( $id, 'join_date', '' ); // set by the Skool import later; until then the account date
			$join   = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $join ) ? $join : get_date_from_gmt( $u->user_registered, 'Y-m-d' );
			$out[] = array(
				'id'     => (int) $id,
				'name'   => $u->display_name,
				'email'  => $u->user_email,
				'join'   => $join,
				'age'    => max( 0, self::diff( $join, $today ) ),
				'last'   => $last[ $id ] ?? '',
				'gone'   => isset( $last[ $id ] ) ? max( 0, self::diff( $last[ $id ], $today ) ) : max( 0, self::diff( $join, $today ) ),
				'streak' => (int) $l['streak'],
				'best'   => (int) $l['bestStreak'],
				'days'   => (int) $l['studyDays'],
			);
		}
		return $out;
	}

	/** Sorts students into the sections (a student can be in several). */
	public static function lists( $students ) {
		$out = array_fill_keys( array_keys( self::SECTIONS ), array() );
		foreach ( $students as $s ) {
			if ( 0 === $s['age'] ) {
				$out['today'][] = $s;
			}
			if ( $s['age'] <= 6 ) {
				$out['week'][] = $s;
			}
			if ( $s['age'] >= 3 && $s['age'] <= 5 && 0 === $s['days'] ) {
				$out['day3'][] = $s;
			}
			if ( $s['age'] >= 5 && $s['gone'] >= 5 && $s['gone'] <= 9 ) {
				$out['gone5'][] = $s;
			}
			if ( $s['age'] >= 10 && $s['gone'] >= 10 ) {
				$out['gone10'][] = $s;
			}
			if ( $s['streak'] >= 7 && $s['streak'] <= 13 ) {
				$out['run7'][] = $s;
			}
			if ( $s['age'] >= 30 && $s['age'] <= 32 ) {
				$out['day30'][] = $s;
			}
		}
		foreach ( $out as $k => $rows ) {
			usort(
				$rows,
				function ( $a, $b ) {
					return strcmp( $b['join'], $a['join'] ) ?: strcmp( $a['name'], $b['name'] );
				}
			);
			$out[ $k ] = $rows;
		}
		return $out;
	}

	private static function row_cells( $s ) {
		return array( $s['name'], $s['email'], $s['join'], $s['last'] ? $s['last'] : 'never', $s['streak'], $s['days'] );
	}

	public static function csv() {
		if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'sawa_tr_cs_csv' ) ) {
			wp_die( 'Not allowed.' );
		}
		$key   = isset( $_GET['list'] ) ? sanitize_key( $_GET['list'] ) : ''; // phpcs:ignore
		$lists = self::lists( self::students() );
		if ( ! isset( $lists[ $key ] ) ) {
			wp_die( 'Unknown list.' );
		}
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="sawa-cs-' . $key . '-' . Sawa_Tracker_Game::today() . '.csv"' );
		$f = fopen( 'php://output', 'w' );
		fwrite( $f, "\xEF\xBB\xBF" ); // so Excel reads the Arabic names
		fputcsv( $f, array( 'Name', 'Email', 'Joined', 'Last activity', 'Streak', 'Study days' ) );
		foreach ( $lists[ $key ] as $s ) {
			// A name or email starting with = + - @ would run as a formula in Excel.
			fputcsv( $f, array_map( function ( $v ) { return is_string( $v ) && preg_match( '/^[=+\-@]/', $v ) ? "'" . $v : $v; }, self::row_cells( $s ) ) );
		}
		fclose( $f ); // phpcs:ignore
		exit;
	}

	/** The tab body. */
	public static function render() {
		$students = self::students();
		$lists    = self::lists( $students );
		echo '<p>' . count( $students ) . ' students with access. Read-only: this page changes nothing. "Last activity" is the last day they logged any study (the app counts automatically). Joined = the account date until the Skool join date is stored.</p>';
		echo '<p class="description">Anyone who is in none of the lists is doing fine.</p>';
		foreach ( self::SECTIONS as $key => $info ) {
			$rows = $lists[ $key ];
			$id   = 'sawa-cs-' . $key;
			echo '<h2 style="margin-top:28px">' . esc_html( $info[0] ) . ' <span style="font-weight:400;color:#646970">(' . count( $rows ) . ')</span></h2>';
			echo '<p class="description">' . esc_html( $info[1] ) . '</p>';
			if ( ! $rows ) {
				echo '<p><em>Nobody.</em></p>';
				continue;
			}
			$names = implode( "\n", wp_list_pluck( $rows, 'name' ) );
			$csv   = wp_nonce_url( admin_url( 'admin-post.php?action=sawa_tr_cs_csv&list=' . $key ), 'sawa_tr_cs_csv' );
			echo '<p><button type="button" class="button sawa-cs-copy" data-names="' . esc_attr( $names ) . '">Copy names</button> ';
			echo '<a class="button" href="' . esc_url( $csv ) . '">Download CSV</a></p>';
			echo '<table class="widefat striped" id="' . esc_attr( $id ) . '" style="max-width:900px"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Last activity</th><th>Streak</th><th>Study days</th></tr></thead><tbody>';
			foreach ( $rows as $s ) {
				echo '<tr><td dir="auto"><strong>' . esc_html( $s['name'] ) . '</strong></td><td>' . esc_html( $s['email'] ) . '</td><td>' . esc_html( $s['join'] ) . '</td><td>' . esc_html( $s['last'] ? $s['last'] . ' (' . $s['gone'] . 'd ago)' : 'never' ) . '</td><td>' . (int) $s['streak'] . ' 🔥</td><td>' . (int) $s['days'] . '</td></tr>';
			}
			echo '</tbody></table>';
		}
		?>
		<script>
		document.querySelectorAll('.sawa-cs-copy').forEach(function (b) {
			b.addEventListener('click', function () {
				var t = b.getAttribute('data-names'), done = function () { var o = b.textContent; b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = o; }, 1500); };
				if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(done); return; }
				var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) {} a.remove();
			});
		});
		</script>
		<?php
	}
}
