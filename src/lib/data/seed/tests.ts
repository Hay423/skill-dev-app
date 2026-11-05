import type { TestAttemptSpec, TestProtocol, TestSide } from '$lib/types';

/**
 * The bundled test protocols.
 *
 * Reference content, like drills and programs — identical for every player,
 * never owned, never pushed. Ids are hard-coded and permanent because results
 * reference them.
 *
 * **These rows are frozen once released.** A protocol's distances, attempt
 * count, target size and scoring are the only reason two results are
 * comparable; editing any of them silently changes what every stored result
 * means. Wording can be clarified, but a change to the protocol itself is a
 * new row with a new id and slug, and the old one is retired. That is a
 * stronger rule than the one on drills, where only the id is permanent.
 *
 * The protocol detail fixed here — a 5 m square target, three shots per set-shot
 * spot, a 30 second handball window — is the part `notes/product-direction.md`
 * deliberately left open ("protocol detail to fix when the tests are built").
 * It is chosen to be repeatable alone, scorable honestly by the player, and
 * hard enough at the top end that a range gap shows up. It is **provisional
 * until the S&C reviewer signs it off**, which is the one window in which it
 * can still change — before any player has a result against it.
 */

/**
 * Attempt slots for a distance-and-side accuracy test: every distance in turn,
 * and at each distance a set off each side.
 *
 * Distance is the outer loop because that is how the test is actually run —
 * you set the cones at 20 m, kick your ten, then move them. `index` is assigned
 * in that order and is permanent, so this generation is as frozen as the rows
 * it builds.
 */
function accuracyAttempts(
	distances: number[],
	sides: TestSide[],
	perSide: number
): TestAttemptSpec[] {
	const specs: TestAttemptSpec[] = [];
	for (const distance_m of distances) {
		for (const side of sides) {
			for (let i = 0; i < perSide; i++) {
				specs.push({ index: specs.length, distance_m, side, spot: null });
			}
		}
	}
	return specs;
}

/** The five set-shot positions, in the order they are taken. */
const SET_SHOT_SPOTS: Array<{ spot: string; distance_m: number }> = [
	{ spot: 'Directly in front', distance_m: 30 },
	{ spot: '45° to the left', distance_m: 30 },
	{ spot: '45° to the right', distance_m: 30 },
	{ spot: 'Left pocket', distance_m: 20 },
	{ spot: 'Right pocket', distance_m: 20 }
];

const SHOTS_PER_SPOT = 3;

function setShotAttempts(): TestAttemptSpec[] {
	const specs: TestAttemptSpec[] = [];
	for (const { spot, distance_m } of SET_SHOT_SPOTS) {
		for (let i = 0; i < SHOTS_PER_SPOT; i++) {
			specs.push({ index: specs.length, distance_m, side: null, spot });
		}
	}
	return specs;
}

/**
 * Both feet, strong foot first.
 *
 * Deliberately not "strong then weak" — the protocol cannot know which foot is
 * which, and relabelling the sides per player would make the per-side
 * breakdown incomparable between a left and a right footer. Right first is an
 * arbitrary fixed order; the breakdown reports left and right, and the player
 * knows which of theirs is which.
 */
const BOTH_SIDES: TestSide[] = ['right', 'left'];

const KICKING_RULES_COMMON = [
	'Drop punts only — a torp or a snap is a different skill and a different test',
	'Target is a 5 m × 5 m square of four cones, centred on the kicking line',
	'A hit is a ball that lands or first bounces inside the square',
	'Five kicks off one foot, then five off the other, before moving the cones',
	'Walk the same two-step approach every kick — this is accuracy, not distance',
	'Score every kick, including the bad ones. A test you flatter is a test you cannot use'
];

export const SEED_TEST_PROTOCOLS: TestProtocol[] = [
	{
		id: '7c2a1d4f-0b31-4e52-9c83-1a2b3c4d5e01',
		slug: 'kicking-accuracy-junior',
		name: 'Kicking accuracy (junior)',
		family: 'kicking_accuracy',
		tier: 'junior',
		category: 'kicking',
		age_groups: ['u11', 'u13'],
		scoring: 'hit_miss',
		summary: 'Thirty drop punts into a coned square — five off each foot at 15, 20 and 25 m.',
		setup:
			'Mark a kicking line. Set a 5 m square of cones 15 m away, then move it out to 20 m and 25 m as you go.',
		rules: KICKING_RULES_COMMON,
		equipment: ['Football', 'Four cones', 'Tape measure or counted paces'],
		equipment_required: ['park'],
		duration_minutes: 15,
		attempts: accuracyAttempts([15, 20, 25], BOTH_SIDES, 5),
		window_seconds: null,
		paired_slug: 'kicking-accuracy-senior'
	},
	{
		id: '7c2a1d4f-0b31-4e52-9c83-1a2b3c4d5e02',
		slug: 'kicking-accuracy-senior',
		name: 'Kicking accuracy',
		family: 'kicking_accuracy',
		tier: 'senior',
		category: 'kicking',
		age_groups: ['u15', 'u17', 'senior', 'masters'],
		scoring: 'hit_miss',
		summary: 'Thirty drop punts into a coned square — five off each foot at 20, 30 and 40 m.',
		setup:
			'Mark a kicking line. Set a 5 m square of cones 20 m away, then move it out to 30 m and 40 m as you go.',
		rules: KICKING_RULES_COMMON,
		equipment: ['Football', 'Four cones', 'Tape measure or counted paces'],
		equipment_required: ['oval'],
		duration_minutes: 20,
		attempts: accuracyAttempts([20, 30, 40], BOTH_SIDES, 5),
		window_seconds: null,
		paired_slug: 'kicking-accuracy-junior'
	},
	{
		id: '7c2a1d4f-0b31-4e52-9c83-1a2b3c4d5e03',
		slug: 'set-shots',
		name: 'Goalkicking set shots',
		family: 'set_shots',
		tier: 'open',
		category: 'goalkicking',
		age_groups: ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'],
		scoring: 'goal_behind_miss',
		summary:
			'Fifteen set shots from five marked spots, scored like a real game — goal 6, behind 1, miss 0.',
		setup:
			'Five spots: 30 m directly in front, 30 m on each 45° angle, and 20 m in each pocket. Three shots from each, in that order.',
		rules: [
			'Set shot only — walk back, line up, take your time',
			'Through the big sticks is a goal (6). Between a big and a small post is a behind (1)',
			'Short, out on the full or wide of the point posts is a miss (0)',
			'Kick off your preferred foot from every spot, as you would in a game',
			'Three shots from a spot before moving to the next one'
		],
		equipment: ['Football', 'Goals', 'Cones to mark the five spots'],
		equipment_required: ['goals'],
		duration_minutes: 20,
		attempts: setShotAttempts(),
		window_seconds: null,
		paired_slug: null
	},
	{
		id: '7c2a1d4f-0b31-4e52-9c83-1a2b3c4d5e04',
		slug: 'handball-accuracy',
		name: 'Handball accuracy',
		family: 'handball',
		tier: 'open',
		category: 'handball',
		age_groups: ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'],
		scoring: 'hit_miss',
		summary: 'Thirty handballs at a target — five off each hand at 5, 10 and 15 m.',
		setup:
			'A 1 m square marked on a wall at chest height, or a bin as the target. Stand off at 5 m, then 10 m, then 15 m.',
		rules: [
			'Punch it off a held ball — a throw is not a handball and does not count',
			'A hit is a ball that strikes inside the square, or hits the bin',
			'Five off one hand, then five off the other, before you move back',
			'The ball must travel flat and direct. A lobbed handball that drops in is a miss'
		],
		equipment: ['Football', 'Wall with a 1 m square marked, or a bin'],
		equipment_required: ['park'],
		duration_minutes: 10,
		attempts: accuracyAttempts([5, 10, 15], BOTH_SIDES, 5),
		window_seconds: null,
		paired_slug: null
	},
	{
		id: '7c2a1d4f-0b31-4e52-9c83-1a2b3c4d5e05',
		slug: 'handball-speed',
		name: 'Handball speed',
		family: 'handball',
		tier: 'open',
		category: 'handball',
		age_groups: ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'],
		scoring: 'timed_hits',
		summary: 'Clean handballs onto a wall target in thirty seconds, alternating hands.',
		setup: 'A 1 m square on a wall at chest height. Stand 3 m back.',
		rules: [
			'Thirty seconds. Count a hit only when the ball strikes inside the square',
			'Alternate hands every handball — two in a row off the same hand scores neither',
			'Catch or gather the rebound and go again. A dropped ball costs you the time, not a hit',
			'Start the timer on your first handball, not on the tap'
		],
		equipment: ['Football', 'Wall with a 1 m square marked'],
		equipment_required: ['wall'],
		duration_minutes: 5,
		attempts: [],
		window_seconds: 30,
		paired_slug: null
	}
];
