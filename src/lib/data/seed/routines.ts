import type { RoutineFocus } from '$lib/domain/routines';
import type { ItemSpec } from './programs';

/**
 * Warm-up and cool-down routines, written once and stamped into every program
 * session that needs them by `expand` in `programs.ts`.
 *
 * A routine is authoring shorthand rather than stored content: once expanded,
 * its items are ordinary `ProgramItem` rows with `section` set, ticked like any
 * other and counting towards the session being done. That is what lets a
 * routine change here reach every program at the next re-seed without a single
 * session being re-authored.
 *
 * Which routine a session gets is decided by `routineFocus` in
 * `domain/routines.ts`, from the session's main work. A session spec can name a
 * different one, or `null` for none.
 *
 * ## What every routine here holds to
 *
 * - **No kit.** Every movement is bodyweight, and the easy cardio is "whatever
 *   you have" — a routine is stamped into programs that declare anything from a
 *   full gym to nothing at all, and the equipment test holds them all to it.
 * - **Every age.** Every exercise sits at `u11`. The youngest player in the
 *   youngest running block warms up the same way a senior does.
 * - **Never scaled.** The week's intensity modifier does not reach these items
 *   (see `program-plan.ts`): a deload week is lighter work, not a shorter
 *   warm-up.
 * - **Heart rate only on the cardio.** The easy jog carries a band so it stays
 *   easy; the stretches and drills carry nothing, and `domain/heart-rate.ts`
 *   prints nothing for them.
 */
export interface RoutineSpec {
	slug: string;
	/** Heads the section in the session view: "Warm-up · Before fast running · 12 min". */
	name: string;
	minutes: number;
	items: ItemSpec[];
}

/** Easy cardio to open a gym warm-up — no machine assumed. */
const EASY_CARDIO: ItemSpec = {
	work_seconds: 240,
	hr: [55, 65],
	notes: 'Easy cardio — bike, rower, skipping rope or a jog around the block'
};

/**
 * Build-up sets before the first working set. The single most useful minute of
 * a lifting warm-up, and the one most often skipped.
 */
const RAMP_UP_SETS: ItemSpec = {
	reps: '2–3 lighter sets',
	notes: 'Build-up sets of your first lift — climb to your working weight, never start on it'
};

const EASY_JOG = (seconds: number): ItemSpec => ({
	work_seconds: seconds,
	hr: [55, 65],
	notes: 'Easy jog — start slower than feels necessary'
});

const WARM_UPS: Record<RoutineFocus, RoutineSpec> = {
	gym_lower: {
		slug: 'warm-up-gym-lower',
		name: 'Before a lower-body lift',
		minutes: 10,
		items: [
			EASY_CARDIO,
			{ exercise_slug: 'leg-swings', reps: '10 each way, each leg' },
			{ exercise_slug: 'worlds-greatest-stretch', reps: '3 each side' },
			{ exercise_slug: 'bodyweight-squat', reps: '10', notes: 'Slow down, pause at the bottom' },
			{ exercise_slug: 'glute-bridge', reps: '10' },
			RAMP_UP_SETS
		]
	},
	gym_upper: {
		slug: 'warm-up-gym-upper',
		name: 'Before an upper-body lift',
		minutes: 8,
		items: [
			{ ...EASY_CARDIO, work_seconds: 180 },
			{ exercise_slug: 'arm-circles', reps: '10 forwards, 10 back' },
			{ exercise_slug: 'open-book', reps: '6 each side' },
			{ exercise_slug: 'inchworm', reps: '5' },
			{ exercise_slug: 'push-up', reps: '8', notes: 'Easy reps — this is the warm-up' },
			RAMP_UP_SETS
		]
	},
	run_easy: {
		slug: 'warm-up-run-easy',
		name: 'Before an easy run',
		minutes: 6,
		items: [
			EASY_JOG(180),
			{ exercise_slug: 'leg-swings', reps: '10 each way, each leg' },
			{ exercise_slug: 'walking-knee-hug', reps: '6 each leg' },
			{ exercise_slug: 'walking-hip-openers', reps: '5 each way, each leg' }
		]
	},
	run_fast: {
		slug: 'warm-up-run-fast',
		name: 'Before fast running',
		minutes: 12,
		items: [
			EASY_JOG(240),
			{ exercise_slug: 'leg-swings', reps: '10 each way, each leg' },
			{ exercise_slug: 'walking-knee-hug', reps: '6 each leg' },
			{ exercise_slug: 'worlds-greatest-stretch', reps: '3 each side' },
			{ exercise_slug: 'ankling', reps_count: 2, distance_m: 20, recovery_seconds: 30 },
			{ exercise_slug: 'a-skip', reps_count: 2, distance_m: 20, recovery_seconds: 30 },
			{ exercise_slug: 'carioca', reps_count: 2, distance_m: 20, recovery_seconds: 30 },
			{
				reps_count: 3,
				distance_m: 40,
				recovery_seconds: 45,
				hr: [70, 85],
				notes: 'Build-ups — about 60%, 75%, then 90% of top pace'
			}
		]
	},
	jump: {
		slug: 'warm-up-jump',
		name: 'Before jumping',
		minutes: 10,
		items: [
			EASY_JOG(180),
			{ exercise_slug: 'leg-swings', reps: '10 each way, each leg' },
			{ exercise_slug: 'walking-hip-openers', reps: '5 each way, each leg' },
			{ exercise_slug: 'ankling', reps_count: 2, distance_m: 20, recovery_seconds: 30 },
			{ exercise_slug: 'a-skip', reps_count: 2, distance_m: 20, recovery_seconds: 30 },
			{ exercise_slug: 'bodyweight-squat', reps: '10', notes: 'Land-ready: knees out, chest up' }
		]
	}
};

const GYM_LOWER_COOL_DOWN: RoutineSpec = {
	slug: 'cool-down-gym-lower',
	name: 'After a lower-body lift',
	minutes: 6,
	items: [
		{ exercise_slug: 'hip-flexor-stretch', reps: '30 s each side' },
		{ exercise_slug: 'hamstring-stretch', reps: '30 s each leg' },
		{ exercise_slug: 'quad-stretch', reps: '30 s each leg' },
		{ exercise_slug: 'glute-stretch', reps: '30 s each side' },
		{ exercise_slug: 'groin-stretch', reps: '30 s' },
		{ exercise_slug: 'recovery-breathing', reps: '1 min' }
	]
};

const GYM_UPPER_COOL_DOWN: RoutineSpec = {
	slug: 'cool-down-gym-upper',
	name: 'After an upper-body lift',
	minutes: 5,
	items: [
		{ exercise_slug: 'chest-stretch', reps: '30 s each side' },
		{ exercise_slug: 'childs-pose', reps: '45 s' },
		{ exercise_slug: 'hip-flexor-stretch', reps: '30 s each side' },
		{ exercise_slug: 'recovery-breathing', reps: '1 min' }
	]
};

/** Running and jumping finish the same way: bring the heart rate down, then the calves and hips. */
const FIELD_COOL_DOWN: RoutineSpec = {
	slug: 'cool-down-field',
	name: 'After running or jumping',
	minutes: 8,
	items: [
		{ work_seconds: 180, hr: [50, 60], notes: 'Easy jog, easing down to a walk' },
		{ exercise_slug: 'calf-stretch', reps: '30 s each leg' },
		{ exercise_slug: 'hamstring-stretch', reps: '30 s each leg' },
		{ exercise_slug: 'quad-stretch', reps: '30 s each leg' },
		{ exercise_slug: 'hip-flexor-stretch', reps: '30 s each side' },
		{ exercise_slug: 'groin-stretch', reps: '30 s' }
	]
};

const COOL_DOWNS: Record<RoutineFocus, RoutineSpec> = {
	gym_lower: GYM_LOWER_COOL_DOWN,
	gym_upper: GYM_UPPER_COOL_DOWN,
	run_easy: FIELD_COOL_DOWN,
	run_fast: FIELD_COOL_DOWN,
	jump: FIELD_COOL_DOWN
};

/** Every routine, by slug, for a session spec that names one explicitly. */
export const ROUTINES: ReadonlyMap<string, RoutineSpec> = new Map(
	[...Object.values(WARM_UPS), ...Object.values(COOL_DOWNS)].map((r) => [r.slug, r])
);

/** The default warm-up and cool-down for a session of this focus. */
export function routinesFor(focus: RoutineFocus): { warm_up: RoutineSpec; cool_down: RoutineSpec } {
	return { warm_up: WARM_UPS[focus], cool_down: COOL_DOWNS[focus] };
}

/** A routine by slug. Throws at module load on a typo, as `exerciseId` does. */
export function routineBySlug(slug: string): RoutineSpec {
	const routine = ROUTINES.get(slug);
	if (!routine) throw new Error(`Unknown routine slug in program content: ${slug}`);
	return routine;
}
