<?php
/**
 * Silk Road: jobs (Thief / Hunter / Trader), gear (weapon, armour, amulet in 6 grades = CEFR levels, upgraded
 * +1…+5 with elixirs) and combat skills unlocked by mastering English points in the skill tree. Everything that
 * makes a character stronger comes from learning: grades need your English level and mastered points, elixirs
 * come from mastery and perfect days, and battles are English questions.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_RPG {

	const JOBS = array(
		'thief'  => array( '🗡', 'Thief', 'Raid other students for coins. Steal more from Traders. Becomes "wanted" for 24 hours after a raid.' ),
		'hunter' => array( '🏹', 'Hunter', 'Hunt wanted thieves: win the battle, give half the stolen coins back to the victim and keep half as a bounty.' ),
		'trader' => array( '🐪', 'Trader', 'No fighting. Earn 25% more coins from learning — but thieves love traders.' ),
	);
	const GRADES = array( 1 => 'Bronze', 2 => 'Iron', 3 => 'Steel', 4 => 'Silver', 5 => 'Gold', 6 => 'Jade' );
	const SLOTS  = array(
		'weapon' => array( 'Weapon', 'attack' ),
		'armor'  => array( 'Armour', 'defence' ),
		'amulet' => array( 'Amulet', 'coins' ),
	);
	/** Weapon names per job. */
	const WEAPONS = array( 'thief' => 'Dagger', 'hunter' => 'Crossbow', 'trader' => 'Staff', '' => 'Sword' );
	const PRICES  = array( 1 => 30, 2 => 90, 3 => 200, 4 => 380, 5 => 650, 6 => 1000 );
	/** Combat skills: [name, track, mastered points needed in that track, effect text]. */
	const SKILLS = array(
		'second_wind' => array( 'Second Wind', 'grammar', 1, 'One wrong answer per battle is forgiven.' ),
		'eagle_eye'   => array( 'Eagle Eye', 'grammar', 2, '+5 seconds for every question.' ),
		'critical'    => array( 'Critical Strike', 'grammar', 4, '3 right answers in a row: +15 attack.' ),
		'iron_skin'   => array( 'Iron Skin', 'pron', 1, '+10 defence.' ),
		'fortress'    => array( 'Fortress', 'pron', 3, '+15% defence.' ),
		'silver'      => array( 'Silver Tongue', 'tone', 1, '+20% loot and bounties.' ),
		'sprint'      => array( 'Sprint', 'tone', 2, '+1 raid or hunt a day.' ),
	);

	public static function get( $uid ) {
		$r = Sawa_Tracker_Game::m( $uid, 'rpg', array() );
		$r = is_array( $r ) ? $r : array();
		return $r + array( 'job' => '', 'job_changed' => '', 'gear' => array(), 'owned' => array(), 'elixirs' => 0, 'skills' => array() );
	}

	public static function save( $uid, $r ) {
		Sawa_Tracker_Game::set( $uid, 'rpg', $r );
	}

	public static function job( $uid ) {
		return self::get( $uid )['job'];
	}

	public static function add_elixirs( $uid, $n ) {
		$r            = self::get( $uid );
		$r['elixirs'] = max( 0, (int) $r['elixirs'] + (int) $n );
		self::save( $uid, $r );
	}

	/** The learner's English for gating: level from the level test (1–6) and mastered points per track. */
	public static function english( $uid ) {
		$pl      = get_user_meta( $uid, 'sawa_lens_placement', true );
		$level   = is_array( $pl ) ? (int) $pl['levelNum'] : (int) get_user_meta( $uid, 'sawa_lens_level', true );
		$mastery = (array) apply_filters( 'sawa_tracker_mastery', array( 'grammar' => 0, 'pron' => 0, 'tone' => 0 ), $uid );
		return array( 'level' => max( 1, $level ), 'mastery' => $mastery, 'mastered' => array_sum( $mastery ) );
	}

	/** Can this grade be bought? Needs the English level and (grade − 1) × 2 mastered points. */
	public static function grade_ok( $uid, $grade, $eng = null ) {
		$eng = $eng ? $eng : self::english( $uid );
		return $eng['level'] >= $grade && $eng['mastered'] >= ( $grade - 1 ) * 2;
	}

	/** Bonus from one slot: 5% a grade + 2% a plus. */
	public static function slot_bonus( $r, $slot ) {
		$g = $r['gear'][ $slot ] ?? null;
		return $g ? ( 5 * (int) $g['grade'] + 2 * (int) $g['plus'] ) / 100 : 0;
	}

	public static function skill_on( $uid, $skill ) {
		return in_array( $skill, (array) self::get( $uid )['skills'], true ) && self::skill_unlocked( $uid, $skill );
	}

	public static function skill_unlocked( $uid, $skill, $eng = null ) {
		$eng = $eng ? $eng : self::english( $uid );
		$k   = self::SKILLS[ $skill ] ?? null;
		return $k && ( $eng['mastery'][ $k[1] ] ?? 0 ) >= $k[2];
	}

	/**
	 * Attack from a battle: 20 per right answer, Second Wind forgives one wrong answer, Warriors +10,
	 * Critical Strike +15 after 3 right in a row, all times the weapon bonus. $oks = list of true/false per question.
	 */
	public static function attack( $uid, $oks ) {
		$right  = count( array_filter( $oks ) );
		$eff    = $right + ( $right < count( $oks ) && self::skill_on( $uid, 'second_wind' ) ? 1 : 0 );
		$streak = 0;
		$best   = 0;
		foreach ( $oks as $ok ) {
			$streak = $ok ? $streak + 1 : 0;
			$best   = max( $best, $streak );
		}
		$base = $eff * 20 + ( 'warrior' === Sawa_Tracker_Game::m( $uid, 'class' ) ? 10 : 0 ) + ( $best >= 3 && self::skill_on( $uid, 'critical' ) ? 15 : 0 );
		return (int) round( $base * ( 1 + self::slot_bonus( self::get( $uid ), 'weapon' ) ) );
	}

	/** Coins earned from learning, with Trader and amulet bonuses. */
	public static function learn_multiplier( $uid ) {
		$r = self::get( $uid );
		return 1 + ( 'trader' === $r['job'] ? 0.25 : 0 ) + self::slot_bonus( $r, 'amulet' );
	}

	/** Everything the character screen needs. */
	public static function sheet( $uid ) {
		$r   = self::get( $uid );
		$eng = self::english( $uid );
		$gear = array();
		foreach ( self::SLOTS as $slot => $info ) {
			$g           = $r['gear'][ $slot ] ?? null;
			$gear[ $slot ] = array(
				'slot'  => $info[0],
				'stat'  => $info[1],
				'grade' => $g ? (int) $g['grade'] : 0,
				'plus'  => $g ? (int) $g['plus'] : 0,
				'name'  => $g ? self::GRADES[ (int) $g['grade'] ] . ' ' . self::item_name( $slot, $r['job'] ) . ( $g['plus'] ? ' +' . (int) $g['plus'] : '' ) : '',
				'bonus' => (int) round( 100 * self::slot_bonus( $r, $slot ) ),
				'next'  => $g && (int) $g['plus'] < 5 ? (int) $g['plus'] + 1 : 0,
			);
		}
		$shop = array();
		foreach ( self::SLOTS as $slot => $info ) {
			foreach ( self::GRADES as $gr => $gname ) {
				$shop[] = array(
					'slot'  => $slot,
					'grade' => $gr,
					'name'  => $gname . ' ' . self::item_name( $slot, $r['job'] ),
					'price' => self::PRICES[ $gr ],
					'ok'    => self::grade_ok( $uid, $gr, $eng ),
					'need'  => array( 'level' => array( 1 => 'A1', 2 => 'A2', 3 => 'B1', 4 => 'B2', 5 => 'C1', 6 => 'C2' )[ $gr ], 'mastered' => ( $gr - 1 ) * 2 ),
					'bonus' => 5 * $gr,
				);
			}
		}
		$skills = array();
		foreach ( self::SKILLS as $id => $k ) {
			$skills[] = array( 'id' => $id, 'name' => $k[0], 'track' => $k[1], 'need' => $k[2], 'text' => $k[3], 'unlocked' => self::skill_unlocked( $uid, $id, $eng ), 'on' => in_array( $id, (array) $r['skills'], true ) );
		}
		return array(
			'job'      => $r['job'],
			'jobs'     => self::JOBS,
			'canJob'   => ! $r['job_changed'] || $r['job_changed'] <= Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -7 ),
			'gear'     => $gear,
			'shop'     => $shop,
			'elixirs'  => (int) $r['elixirs'],
			'skills'   => $skills,
			'english'  => $eng,
			'attack'   => (int) round( 100 * self::slot_bonus( $r, 'weapon' ) ),
			'armour'   => (int) round( 100 * self::slot_bonus( $r, 'armor' ) ),
		);
	}

	public static function item_name( $slot, $job ) {
		if ( 'weapon' === $slot ) {
			return self::WEAPONS[ $job ] ?? 'Sword';
		}
		return 'armor' === $slot ? ( 'thief' === $job ? 'Leather' : ( 'hunter' === $job ? 'Mail' : 'Robe' ) ) : 'Amulet';
	}

	/* ------------------------------------------------------------------ actions */

	public static function set_job( $uid, $job ) {
		if ( ! isset( self::JOBS[ $job ] ) ) {
			return new WP_Error( 'job', 'Choose Thief, Hunter or Trader.', array( 'status' => 400 ) );
		}
		$r = self::get( $uid );
		if ( $r['job'] && $r['job'] !== $job && $r['job_changed'] && $r['job_changed'] > Sawa_Tracker_Game::add_days( Sawa_Tracker_Game::today(), -7 ) ) {
			return new WP_Error( 'job', 'You can change your job once a week.', array( 'status' => 400 ) );
		}
		if ( $r['job'] !== $job ) {
			$r['job_changed'] = $r['job'] ? Sawa_Tracker_Game::today() : '';
			$r['job']         = $job;
		}
		self::save( $uid, $r );
		return true;
	}

	public static function buy( $uid, $slot, $grade ) {
		if ( ! isset( self::SLOTS[ $slot ] ) || ! isset( self::GRADES[ $grade ] ) ) {
			return new WP_Error( 'item', 'Unknown item.', array( 'status' => 400 ) );
		}
		if ( ! self::grade_ok( $uid, $grade ) ) {
			return new WP_Error( 'grade', 'Your English isn\'t ready for this grade yet. Level up your English to unlock it!', array( 'status' => 400 ) );
		}
		$r   = self::get( $uid );
		$cur = $r['gear'][ $slot ] ?? null;
		if ( $cur && (int) $cur['grade'] >= $grade ) {
			return new WP_Error( 'have', 'You already have this grade or better.', array( 'status' => 400 ) );
		}
		$price = self::PRICES[ $grade ];
		if ( Sawa_Tracker_Raids::coins( $uid ) < $price ) {
			return new WP_Error( 'coins', 'Not enough coins yet.', array( 'status' => 400 ) );
		}
		Sawa_Tracker_Raids::add_coins( $uid, -$price );
		$r['gear'][ $slot ] = array( 'grade' => $grade, 'plus' => 0 );
		self::save( $uid, $r );
		return true;
	}

	/** +1 costs as many elixirs as the new plus (+1 = 1 … +5 = 5). Never fails, never breaks. */
	public static function upgrade( $uid, $slot ) {
		$r   = self::get( $uid );
		$cur = $r['gear'][ $slot ] ?? null;
		if ( ! $cur || (int) $cur['plus'] >= 5 ) {
			return new WP_Error( 'upgrade', 'Nothing to upgrade here.', array( 'status' => 400 ) );
		}
		$cost = (int) $cur['plus'] + 1;
		if ( (int) $r['elixirs'] < $cost ) {
			return new WP_Error( 'elixirs', 'You need ' . $cost . ' elixir' . ( $cost > 1 ? 's' : '' ) . '. Master a skill or have a perfect day to get more.', array( 'status' => 400 ) );
		}
		$r['elixirs']              -= $cost;
		$r['gear'][ $slot ]['plus'] = (int) $cur['plus'] + 1;
		self::save( $uid, $r );
		return true;
	}

	public static function toggle_skill( $uid, $skill ) {
		if ( ! self::skill_unlocked( $uid, $skill ) ) {
			return new WP_Error( 'skill', 'Master the English points it needs first.', array( 'status' => 400 ) );
		}
		$r  = self::get( $uid );
		$on = (array) $r['skills'];
		if ( in_array( $skill, $on, true ) ) {
			$on = array_values( array_diff( $on, array( $skill ) ) );
		} elseif ( count( $on ) >= 3 ) {
			return new WP_Error( 'skill', 'You can use 3 skills at a time. Switch one off first.', array( 'status' => 400 ) );
		} else {
			$on[] = $skill;
		}
		$r['skills'] = $on;
		self::save( $uid, $r );
		return true;
	}
}
