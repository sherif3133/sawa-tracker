<?php
/**
 * How monsters and travellers fight: every monster has its own attack style, and the traveller's class and job give
 * them a fighting style too. Sawa_Tracker_World runs the battle and calls these at each answer.
 *
 * Monster styles (what happens when you answer wrong, or what you can see coming):
 * - frenzy (beasts): every miss makes the next bite harder.
 * - poison (scorpions, snakes): a miss poisons you for 3 answers.
 * - thief (bandits, tricksters): a miss steals mana.
 * - haunt (ghosts, bats): a miss spooks you: less time for the next question.
 * - heavy (golems, boars, machines, guards): it charges up where you can see it. Miss while it is charged: double hit.
 *   Answer right while it is charged: you break its guard for extra damage.
 * - burn (djinns, drakes): a miss sets you on fire for 2 answers.
 * - swoop (birds): slow right answers only do half damage. Be quick!
 * - riddle (sphinx): a miss heals the sphinx.
 *
 * Roles (picked in the character creator; they also decide how a traveller helps others in a call for help):
 * Guardian (tank: takes 25% less damage), Healer (mends 4 health on every right answer and cleans off poison and
 * fire), Mage (spells: typing and sentence questions hit 40% harder), Trickster (3 right answers in a row freeze the
 * monster: its next attack misses). Jobs add one more: Thief (swift: fast answers hit even harder), Hunter
 * (marksman: +25% on listening and typing questions).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sawa_Tracker_Combat {

	/** [style, icon, short name, what it does]. */
	const STYLES = array(
		'frenzy' => array( '🐾', 'Frenzy', 'Every miss makes its next bite harder.' ),
		'poison' => array( '☠', 'Poison sting', 'A miss poisons you for 3 answers.' ),
		'thief'  => array( '🫳', 'Sticky fingers', 'A miss steals 10 of your mana.' ),
		'haunt'  => array( '👻', 'Spooky', 'A miss spooks you: 6 seconds less for the next question.' ),
		'heavy'  => array( '🪨', 'Heavy blow', 'It charges up. Miss while it is charged: double damage. Answer right: break its guard!' ),
		'burn'   => array( '🔥', 'Fire', 'A miss sets you on fire for 2 answers.' ),
		'swoop'  => array( '🪶', 'Swoop', 'Slow answers only do half damage. Be quick!' ),
		'riddle' => array( '❓', 'Riddles', 'A miss heals the sphinx.' ),
	);
	/** Monster → style. Bosses use their own style too, and get angry at half health. */
	const OF = array(
		'Paper Tiger' => 'frenzy', 'Lantern Ghost' => 'haunt', 'Rice Rat' => 'thief', 'Jade Dragon' => 'burn',
		'Sand Scorpion' => 'poison', 'Dune Bandit' => 'thief', 'Cave Bat' => 'haunt', 'Desert Wyrm' => 'poison',
		'Mountain Wolf' => 'frenzy', 'Stone Golem' => 'heavy', 'Bazaar Trickster' => 'thief', 'Snow Leopard King' => 'frenzy',
		'Night Assassin' => 'poison', 'Fire Djinn' => 'burn', 'Iron Boar' => 'heavy', 'Shadow Khan' => 'haunt',
		'Roc Chick' => 'swoop', 'Brass Automaton' => 'heavy', 'Riddling Sphinx' => 'riddle', 'Grand Vizier' => 'riddle',
		'Varangian Guard' => 'heavy', 'Fire Drake' => 'burn', 'Hippodrome Champion' => 'swoop', 'Iron Emperor' => 'heavy',
		'Bandit King' => 'thief', 'Sand Kraken' => 'heavy', 'Bone Dragon' => 'burn', 'Mamluk Warlord' => 'frenzy', 'Ghost Caravan' => 'haunt',
	);
	const ROLES = array(
		'guardian'  => array( '🛡', 'Guardian', 'Tank: you take 25% less damage.', 'Shield: your ally takes no damage from the first hits.' ),
		'healer'    => array( '💚', 'Healer', 'Mend: every right answer heals 4 health and cleans off poison and fire.', 'Heals: your ally gets healed when their health is low.' ),
		'mage'      => array( '🔮', 'Mage', 'Spells: typing and sentence questions hit 40% harder.', 'Fireball: big damage when your ally\'s battle starts.' ),
		'trickster' => array( '❄', 'Trickster', 'Freeze: 3 right answers in a row freeze the monster, and its next attack misses.', 'Freeze: the monster\'s first attacks miss.' ),
	);
	const ME = array(
		'thief'   => array( '🗡', 'Thief', 'Swift: fast answers hit even harder.' ),
		'hunter'  => array( '🏹', 'Hunter', 'Marksman: +25% damage on listening and typing questions.' ),
	);

	public static function foe_style( $name ) {
		$s = self::OF[ $name ] ?? 'frenzy';
		return array( 'id' => $s, 'icon' => self::STYLES[ $s ][0], 'name' => self::STYLES[ $s ][1], 'text' => self::STYLES[ $s ][2] );
	}

	/** The traveller's Silk Road role. Before they pick one: the tracker's Healer class is a Healer, everyone else a Guardian. */
	public static function role( $uid ) {
		$r = (string) Sawa_Tracker_Game::m( $uid, 'role', '' );
		return isset( self::ROLES[ $r ] ) ? $r : ( 'healer' === Sawa_Tracker_Game::m( $uid, 'class' ) ? 'healer' : 'guardian' );
	}

	public static function roles() {
		$out = array();
		foreach ( self::ROLES as $k => $r ) {
			$out[] = array( 'id' => $k, 'icon' => $r[0], 'name' => $r[1], 'text' => $r[2], 'help' => $r[3] );
		}
		return $out;
	}

	/** The traveller's styles: role, plus job from stage 4. */
	public static function my_styles( $uid ) {
		$r   = self::role( $uid );
		$out = array( array( 'id' => $r, 'icon' => self::ROLES[ $r ][0], 'name' => self::ROLES[ $r ][1], 'text' => self::ROLES[ $r ][2] ) );
		$job = Sawa_Tracker_RPG::job( $uid );
		if ( isset( self::ME[ $job ] ) ) {
			$out[] = array( 'id' => $job, 'icon' => self::ME[ $job ][0], 'name' => self::ME[ $job ][1], 'text' => self::ME[ $job ][2] );
		}
		return $out;
	}

	private static function has( $b, $id ) {
		return in_array( $id, array_column( (array) ( $b['me']['styles'] ?? array() ), 'id' ), true );
	}

	/** What a helper gives, from their role and right answers (1–4). */
	public static function help_text( $role, $p ) {
		return array( 'guardian' => '🛡 a shield of ' . ( 10 * $p ) . ' health', 'healer' => '💚 ' . ( $p >= 3 ? 2 : 1 ) . ' heal' . ( $p >= 3 ? 's' : '' ) . ' when your health is low', 'mage' => '🔮 a fireball: ' . ( 12 * $p ) . ' damage at the start', 'trickster' => ( $p > 2 ? '❄ frost: the first 2 attacks miss' : '❄ frost: the first attack misses' ) )[ $role ] ?? '';
	}

	/** Allies from a call for help join the battle: shield, heals, a fireball at the start, frost. */
	public static function apply_support( &$foe, &$me, &$st, $sup ) {
		$me['allies'] = array();
		foreach ( (array) ( $sup['allies'] ?? array() ) as $a ) {
			$p = max( 1, min( 4, (int) $a['power'] ) );
			if ( 'guardian' === $a['role'] ) {
				$st['shield'] = (int) ( $st['shield'] ?? 0 ) + 10 * $p;
			} elseif ( 'healer' === $a['role'] ) {
				$st['heals'] = (int) ( $st['heals'] ?? 0 ) + ( $p >= 3 ? 2 : 1 );
			} elseif ( 'mage' === $a['role'] ) {
				$hit         = 12 * $p;
				$foe['hp']   = max( 1, (int) $foe['hp'] - $hit );
				$st['dealt'] = (int) $st['dealt'] + $hit;
				$a['fire']   = $hit;
			} elseif ( 'trickster' === $a['role'] ) {
				$st['frost'] = (int) ( $st['frost'] ?? 0 ) + (int) ceil( $p / 2 );
			}
			$a['help']      = self::help_text( $a['role'], $p );
			$me['allies'][] = $a;
		}
	}

	/** A hit on the traveller, after the allies: frost makes it miss, the shield takes it, a healer heals. */
	public static function allies( &$b, &$out, $hit ) {
		if ( $hit <= 0 ) {
			return $hit;
		}
		if ( ! empty( $b['st']['shield'] ) ) {
			$took             = min( $hit, (int) $b['st']['shield'] );
			$b['st']['shield'] -= $took;
			$hit             -= $took;
			$out['fx'][]      = array( 'k' => 'shield', 'n' => $took );
		}
		return $hit;
	}

	/** After a hit: a healer ally heals when health is low. */
	public static function ally_heal( &$b, &$out ) {
		if ( ! empty( $b['st']['heals'] ) && $b['me']['hp'] > 0 && $b['me']['hp'] < 0.4 * $b['me']['hpMax'] ) {
			--$b['st']['heals'];
			$n             = (int) round( 0.25 * $b['me']['hpMax'] );
			$b['me']['hp'] = min( $b['me']['hpMax'], $b['me']['hp'] + $n );
			$out['fx'][]   = array( 'k' => 'allyheal', 'n' => $n );
		}
	}

	/** Before an answer counts: poison and fire burn. Changes $b, adds what happened to $out['fx']. */
	public static function tick( &$b, &$out ) {
		foreach ( array( 'poison' => 3, 'burn' => 4 ) as $k => $per ) {
			if ( ! empty( $b['st'][ $k ] ) ) {
				$b['me']['hp'] = max( empty( $b['me']['noKo'] ) ? 0 : 1, $b['me']['hp'] - $per );
				$b['st']['taken'] += $per;
				--$b['st'][ $k ];
				$out['fx'][] = array( 'k' => $k, 'n' => $per );
			}
		}
	}

	/** A right answer: damage multipliers from styles, and the healer's mend. */
	public static function right( &$b, &$out, $dmg, $quick, $slow, $type ) {
		$s = $b['foe']['style']['id'] ?? '';
		if ( self::has( $b, 'thief' ) && $quick ) {
			$dmg = (int) round( $dmg * 1.2 );
		}
		if ( self::has( $b, 'hunter' ) && in_array( $type, array( 'listen', 'type' ), true ) ) {
			$dmg = (int) round( $dmg * 1.25 );
		}
		if ( self::has( $b, 'mage' ) && in_array( $type, array( 'type', 'order' ), true ) ) {
			$dmg = (int) round( $dmg * 1.4 );
			$out['fx'][] = array( 'k' => 'spell' );
		}
		if ( self::has( $b, 'trickster' ) && $b['st']['combo'] > 0 && 0 === $b['st']['combo'] % 3 ) {
			$b['st']['ice'] = 1;
			$out['fx'][] = array( 'k' => 'freeze' );
		}
		if ( 'swoop' === $s && $slow ) {
			$dmg = (int) round( $dmg / 2 );
			$out['fx'][] = array( 'k' => 'swoop' );
		}
		if ( 'heavy' === $s && ! empty( $b['st']['charged'] ) ) {
			$dmg = (int) round( $dmg * 1.5 );
			$out['fx'][] = array( 'k' => 'stagger' );
		}
		if ( self::has( $b, 'healer' ) ) {
			$b['me']['hp'] = min( $b['me']['hpMax'], $b['me']['hp'] + 4 );
			$b['st']['poison'] = 0;
			$b['st']['burn']   = 0;
			$out['fx'][] = array( 'k' => 'mend', 'n' => 4 );
		}
		$b['st']['rage']    = 0;
		$b['st']['charged'] = false;
		return $dmg;
	}

	/** A wrong answer (or no answer): the hit, and what the monster's style does. */
	public static function wrong( &$b, &$out, $hit, $uid ) {
		$s = $b['foe']['style']['id'] ?? '';
		if ( ! empty( $b['st']['frost'] ) ) { // an ally's frost: the whole attack misses
			--$b['st']['frost'];
			$out['fx'][] = array( 'k' => 'frost' );
			return 0;
		}
		if ( ! empty( $b['st']['ice'] ) ) { // frozen: this attack misses
			$b['st']['ice'] = 0;
			$out['fx'][]    = array( 'k' => 'frozen' );
			return 0;
		}
		if ( 'frenzy' === $s ) {
			$hit = (int) round( $hit * ( 1 + 0.25 * (int) ( $b['st']['rage'] ?? 0 ) ) );
			$b['st']['rage'] = min( 3, (int) ( $b['st']['rage'] ?? 0 ) + 1 );
			$out['fx'][] = array( 'k' => 'frenzy', 'n' => $b['st']['rage'] );
		} elseif ( 'poison' === $s ) {
			$b['st']['poison'] = 3;
			$out['fx'][] = array( 'k' => 'poisoned' );
		} elseif ( 'burn' === $s ) {
			$b['st']['burn'] = 2;
			$out['fx'][] = array( 'k' => 'burning' );
		} elseif ( 'thief' === $s ) {
			$hit  = (int) round( $hit * 0.8 );
			$took = min( 10, Sawa_Tracker_Hero::mana( $uid ) );
			if ( $took > 0 ) {
				Sawa_Tracker_Hero::add_mana( $uid, -$took );
				$out['fx'][] = array( 'k' => 'stole', 'n' => $took );
				$out['mana'] = Sawa_Tracker_Hero::mana( $uid );
			}
		} elseif ( 'haunt' === $s ) {
			$hit = (int) round( $hit * 0.85 );
			$b['st']['spooked'] = 1;
			$out['fx'][] = array( 'k' => 'spooked' );
		} elseif ( 'heavy' === $s && ! empty( $b['st']['charged'] ) ) {
			$hit = $hit * 2;
			$out['fx'][] = array( 'k' => 'smash' );
		} elseif ( 'riddle' === $s ) {
			$heal            = 12;
			$b['foe']['hp']  = min( $b['foe']['hpMax'], $b['foe']['hp'] + $heal );
			$out['fx'][]     = array( 'k' => 'riddle', 'n' => $heal );
		}
		$b['st']['charged'] = false;
		if ( self::has( $b, 'guardian' ) ) {
			$hit = (int) round( $hit * 0.75 );
		}
		return $hit;
	}

	/** After an answer: what the monster is getting ready to do next (shown to the traveller). */
	public static function next( &$b, &$out ) {
		$s = $b['foe']['style']['id'] ?? '';
		$out['spooked'] = ! empty( $b['st']['spooked'] );
		$b['st']['spooked'] = 0;
		if ( 'heavy' === $s && empty( $b['st']['charged'] ) && wp_rand( 1, 100 ) <= 40 ) {
			$b['st']['charged'] = true;
		}
		$out['charged'] = ! empty( $b['st']['charged'] );
		$out['status']  = array( 'poison' => (int) ( $b['st']['poison'] ?? 0 ), 'burn' => (int) ( $b['st']['burn'] ?? 0 ), 'rage' => (int) ( $b['st']['rage'] ?? 0 ), 'shield' => (int) ( $b['st']['shield'] ?? 0 ), 'frost' => (int) ( $b['st']['frost'] ?? 0 ), 'heals' => (int) ( $b['st']['heals'] ?? 0 ) );
	}
}
