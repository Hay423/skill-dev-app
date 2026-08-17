import type { Drill } from '$lib/types';

/**
 * The starting drill library.
 *
 * Ids are hard-coded and permanent: rep logs reference them, so a drill's id
 * must never change between releases. `slug` is the human-readable natural key
 * used to upsert on seed, so a drill's copy can be edited freely — only add
 * new ids, never recycle old ones.
 */
export const SEED_DRILLS: Drill[] = [
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a01',
		slug: 'wall-kick-repeaters',
		name: 'Wall kick repeaters',
		category: 'kicking',
		summary: 'Short drop punts against a wall or fence to groove a consistent ball drop.',
		setup: 'Stand 8–10 m from a solid wall. Mark a target the size of a chest-mark zone.',
		coaching_points: [
			'Ball held with the laces up, guided down — not tossed',
			'Drop from hip height so the ball meets the foot flat',
			'Follow through straight at the target, not across the body',
			'Same run-up every rep, even at short range'
		],
		equipment: ['Football', 'Wall or fence'],
		min_players: 1,
		duration_minutes: 10,
		difficulty: 1,
		tracks_reps: true,
		target_reps: 20
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a02',
		slug: 'weak-foot-ladder',
		name: 'Weak foot ladder',
		category: 'kicking',
		summary: 'Non-preferred foot kicking at increasing distance, 5 reps per rung.',
		setup: 'Cones at 15 m, 20 m, 25 m, 30 m. A partner or a net to receive.',
		coaching_points: [
			'Do not chase distance — a clean 15 m beats a wobbly 30 m',
			'Drop the ball with the same hand as the kicking foot',
			'Reset to the shortest rung whenever two in a row miss'
		],
		equipment: ['Football', 'Cones'],
		min_players: 1,
		duration_minutes: 15,
		difficulty: 2,
		tracks_reps: true,
		target_reps: 20
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a03',
		slug: 'kick-to-leading-target',
		name: 'Kick to a leading target',
		category: 'kicking',
		summary: 'Hit a moving lead in front of the target, not behind it.',
		setup: 'Partner leads hard from a cone 30 m away at a 45° angle.',
		coaching_points: [
			'Weight the kick to the space ahead of the lead',
			'Scan early — decide before the ball is dropped',
			'Flat, penetrating trajectory so the target runs onto it'
		],
		equipment: ['Football', 'Cones'],
		min_players: 2,
		duration_minutes: 15,
		difficulty: 2,
		tracks_reps: true,
		target_reps: 15
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a04',
		slug: 'set-shot-routine',
		name: 'Set shot routine',
		category: 'goalkicking',
		summary: 'Ten set shots from 40 m with a fixed pre-kick routine.',
		setup: 'Cones at 40 m out, directly in front and on both 45° angles.',
		coaching_points: [
			'Identical routine every shot — steps, breath, target',
			'Pick a point beyond the goals, not the goal line itself',
			'Walk the same line back that you will run in on',
			'Score only the shots that go through — near misses are misses'
		],
		equipment: ['Football', 'Goals', 'Cones'],
		min_players: 1,
		duration_minutes: 20,
		difficulty: 2,
		tracks_reps: true,
		target_reps: 10
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a05',
		slug: 'snap-shots-pocket',
		name: 'Snaps from the pocket',
		category: 'goalkicking',
		summary: 'Checkside and snap shots from both pockets under time pressure.',
		setup: 'Start 25 m out in the pocket. Ball on the ground, gather and shoot within 3 seconds.',
		coaching_points: [
			'Get the ball across the body early',
			'Round the foot through the ball to generate curve',
			'Shorten the run — balance beats power from the pocket'
		],
		equipment: ['Football', 'Goals'],
		min_players: 1,
		duration_minutes: 15,
		difficulty: 3,
		tracks_reps: true,
		target_reps: 12
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a06',
		slug: 'handball-both-hands',
		name: 'Handball — both hands',
		category: 'handball',
		summary: 'Alternating left and right handballs to a target at 8 m.',
		setup: 'Partner or wall target at 8 m. Alternate hands every rep.',
		coaching_points: [
			'Platform hand still — punch through, do not throw',
			'Contact with the fist, ball sits on the flat palm',
			'Step into the handball with the opposite foot'
		],
		equipment: ['Football'],
		min_players: 1,
		duration_minutes: 10,
		difficulty: 1,
		tracks_reps: true,
		target_reps: 30
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a07',
		slug: 'handball-under-pressure',
		name: 'Handball under pressure',
		category: 'handball',
		summary: 'Receive, absorb contact, and dish to a runner.',
		setup: 'One feeder, one tackler applying a bump, one runner on the outside.',
		coaching_points: [
			'Protect the ball into the body on contact',
			'Eyes up before the ball arrives, not after',
			'Release to the runner in front, on their outside shoulder'
		],
		equipment: ['Football', 'Tackle bag'],
		min_players: 3,
		duration_minutes: 15,
		difficulty: 3,
		tracks_reps: true,
		target_reps: 15
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a08',
		slug: 'chest-mark-repeaters',
		name: 'Chest mark repeaters',
		category: 'marking',
		summary: 'Front-on chest marks from a firm 20 m kick.',
		setup: 'Partner kicks flat and firm from 20 m. Attack the ball at pace.',
		coaching_points: [
			'Hands out early, thumbs together, elbows in',
			'Meet the ball — never wait for it to arrive',
			'Absorb into the chest and secure before turning'
		],
		equipment: ['Football'],
		min_players: 2,
		duration_minutes: 10,
		difficulty: 1,
		tracks_reps: true,
		target_reps: 20
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a09',
		slug: 'overhead-mark-contest',
		name: 'Overhead mark in a contest',
		category: 'marking',
		summary: 'Contested overhead marking against a spoiling opponent.',
		setup: 'High ball to a two-player contest 30 m out. Rotate attacker and spoiler.',
		coaching_points: [
			'Time the run — arrive late and moving, not early and standing',
			'Attack the drop zone with the knee up for protection',
			'Strong hands above the head, eyes on the ball through contact'
		],
		equipment: ['Football'],
		min_players: 3,
		duration_minutes: 15,
		difficulty: 3,
		tracks_reps: true,
		target_reps: 12
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a10',
		slug: 'ground-ball-pickups',
		name: 'Ground ball pick-ups',
		category: 'ground_ball',
		summary: 'Clean gathers at pace from a rolling ball, both sides of the body.',
		setup: 'Partner rolls the ball ahead. Gather at pace and dispose within two steps.',
		coaching_points: [
			'Bend the knees, get the eyes low over the ball',
			'Two hands where possible, soft hands always',
			'Do not break stride — gather and go'
		],
		equipment: ['Football', 'Cones'],
		min_players: 2,
		duration_minutes: 10,
		difficulty: 1,
		tracks_reps: true,
		target_reps: 20
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a11',
		slug: 'tackle-technique',
		name: 'Tackle technique',
		category: 'tackling',
		summary: 'Side-on tackling technique onto a bag, building to a live ball carrier.',
		setup: 'Tackle bag or padded partner walking, then jogging.',
		coaching_points: [
			'Head to the side, never across the front',
			'Wrap the arms and pin the ball',
			'Drive through the hips, take them to ground safely'
		],
		equipment: ['Tackle bag'],
		min_players: 2,
		duration_minutes: 15,
		difficulty: 2,
		tracks_reps: false,
		target_reps: null
	},
	{
		id: '6b1f0c9e-4a2d-4f31-9a7b-0c1d2e3f4a12',
		slug: 'evasion-agility-box',
		name: 'Evasion box',
		category: 'evasion',
		summary: 'Sidestep and fend through a four-cone box while carrying the ball.',
		setup: 'Four cones in a 5 m box, defender starting in the middle at half pace.',
		coaching_points: [
			'Sell the step with the shoulders before the feet',
			'Ball in two hands until the moment of the fend',
			'Accelerate out of the change of direction, not into it'
		],
		equipment: ['Football', 'Cones'],
		min_players: 2,
		duration_minutes: 10,
		difficulty: 2,
		tracks_reps: false,
		target_reps: null
	}
];
