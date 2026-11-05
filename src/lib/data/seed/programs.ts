import type {
	ItemSection,
	ProgramItem,
	ProgramPlan,
	ProgramSession,
	ProgramWeek,
	TrainingProgram,
	Uuid
} from '$lib/types';
import { routineFocus } from '$lib/domain/routines';
import { SEED_EXERCISES } from './exercises';
import { routineBySlug, routinesFor, type RoutineSpec } from './routines';

/**
 * The starting program library: three strength blocks and three conditioning
 * blocks, each a real periodised plan rather than a placeholder.
 *
 * Reference content, and meant to be replaced — the Phase 2 importer (see
 * plans/player-profile.md) will emit this same shape from CSV.
 *
 * ## How a program is authored here
 *
 * Sessions are written once and repeated across every week; progression is
 * carried by the week's `intensity_modifier` rather than by re-authoring each
 * week's prescription. That is what the field is for, it keeps an eight-week
 * block readable in one screen, and it makes a deload a one-line change instead
 * of a rewritten week. `scaledLoad` in `domain/program-plan.ts` applies the
 * modifier at render time.
 *
 * ## Warm-ups and cool-downs are not written here
 *
 * A session lists its main work only. `expand` wraps it in the warm-up and
 * cool-down routines from `routines.ts`, chosen from the main work by
 * `routineFocus` — so a lower-body day gets leg swings and build-up sets, a
 * sprint day gets drills and build-ups, and neither is typed out a dozen times.
 * A session that needs something else names it with `warm_up`/`cool_down`.
 *
 * ## Duty of care, expressed as content
 *
 * - Every strength program sits at `min_age_group: 'u17'` or above. Below that
 *   the recommendation layer withholds strength entirely
 *   (`STRENGTH_MIN_AGE_GROUP`), so this is belt and braces: even a hand-typed
 *   URL resolves to a program the age gate rejects.
 * - `load_pct_1rm` appears only in senior programs. A U17 block is prescribed
 *   by RPE and rep range, because %1RM prescription implies a tested maximum
 *   and no junior should be testing one.
 * - Conditioning is open from `u11` up. Withholding strength from juniors must
 *   not leave them with nothing to train.
 *
 * ## Ids
 *
 * Programs carry hard-coded permanent UUIDs — an enrolment references a
 * `program_id`, so it must survive a re-seed. Weeks, sessions and items are
 * derived from the program's id by `childId` below: nothing user-owned points
 * at them, but they still have to be stable across boots, since the seeder
 * skips a program it has already written.
 */

/**
 * A session's or item's id, derived from its program so it is stable across
 * re-seeds without being hand-typed a few hundred times.
 *
 * Each program's UUID has a distinct first group, so keeping the first three
 * groups and encoding (week, day, order) into the last two makes collisions
 * structurally impossible rather than merely unlikely.
 */
function childId(
	program_id: Uuid,
	kind: 'session' | 'item',
	week: number,
	day: number,
	order = 0
): Uuid {
	const [g1, g2, g3] = program_id.split('-');
	const hex4 = (n: number) => n.toString(16).padStart(4, '0');
	return `${g1}-${g2}-${g3}-${kind === 'session' ? 'aa01' : 'aa02'}-${hex4(week)}${hex4(day)}${hex4(order)}`;
}

const EXERCISE_BY_SLUG = new Map(SEED_EXERCISES.map((e) => [e.slug, e]));

function exerciseBySlug(slug: string) {
	const exercise = EXERCISE_BY_SLUG.get(slug);
	// A typo in a slug would otherwise seed an item pointing at nothing, which
	// the UI would render as a blank line. Fail at module load instead.
	if (!exercise) throw new Error(`Unknown exercise slug in program content: ${slug}`);
	return exercise;
}

/** Strength prescription, or running prescription — an item carries one or the other. */
export interface ItemSpec {
	exercise_slug?: string;
	sets?: number;
	reps?: string;
	rpe?: number;
	load_pct_1rm?: number;
	rest_seconds?: number;
	distance_m?: number;
	work_seconds?: number;
	reps_count?: number;
	recovery_seconds?: number;
	/**
	 * Target working heart rate as a band in `%HRmax`, authored where the effort
	 * is what is being prescribed: running and jumping.
	 *
	 * Left off a lift deliberately. A set of five at 80% is prescribed by load,
	 * and `domain/heart-rate.ts` prints a between-sets recovery threshold for it
	 * instead of inventing a work band. Left off a running item, the same module
	 * falls back to a default read from the prescription's shape — but the
	 * default cannot tell a hard 400 from a jog to finish, which is why these are
	 * written out.
	 */
	hr?: [min: number, max: number];
	notes?: string;
}

interface SessionSpec {
	day_index: number;
	name: string;
	type: ProgramSession['type'];
	/** The main work only. The routines' minutes are added on top by `expand`. */
	duration_minutes: number;
	/** Main work only — see "Warm-ups and cool-downs are not written here". */
	items: ItemSpec[];
	/** A routine slug from `routines.ts` in place of the default, or null for none. */
	warm_up?: string | null;
	cool_down?: string | null;
}

/**
 * The routines a session is wrapped in: the ones it names, or the defaults for
 * the focus its main work reads as.
 */
function routinesForSession(session: SessionSpec): {
	warm_up: RoutineSpec | null;
	cool_down: RoutineSpec | null;
} {
	const focus = routineFocus(
		session.type,
		session.items.map((item) => ({
			movement_pattern: item.exercise_slug
				? exerciseBySlug(item.exercise_slug).movement_pattern
				: null,
			hr_pct_max: item.hr?.[1] ?? null
		}))
	);
	const defaults = focus ? routinesFor(focus) : null;
	const pick = (named: string | null | undefined, fallback: RoutineSpec | null) =>
		named === undefined ? fallback : named === null ? null : routineBySlug(named);
	return {
		warm_up: pick(session.warm_up, defaults?.warm_up ?? null),
		cool_down: pick(session.cool_down, defaults?.cool_down ?? null)
	};
}

interface WeekSpec {
	focus: string;
	intensity_modifier: number;
	is_deload?: boolean;
}

interface ProgramSpec {
	program: TrainingProgram;
	weeks: WeekSpec[];
	/** Repeated in every week. Progression comes from `WeekSpec.intensity_modifier`. */
	sessions: SessionSpec[];
}

function expand(spec: ProgramSpec): ProgramPlan {
	const { program } = spec;
	const weeks: ProgramWeek[] = spec.weeks.map((week, index) => ({
		program_id: program.id,
		week_number: index + 1,
		focus: week.focus,
		intensity_modifier: week.intensity_modifier,
		is_deload: week.is_deload ?? false
	}));

	const sessions: ProgramSession[] = [];
	const items: ProgramItem[] = [];

	for (const week of weeks) {
		for (const session of spec.sessions) {
			const session_id = childId(program.id, 'session', week.week_number, session.day_index);
			const { warm_up, cool_down } = routinesForSession(session);
			sessions.push({
				id: session_id,
				program_id: program.id,
				week_number: week.week_number,
				day_index: session.day_index,
				name: session.name,
				type: session.type,
				duration_minutes:
					session.duration_minutes + (warm_up?.minutes ?? 0) + (cool_down?.minutes ?? 0),
				warm_up_name: warm_up?.name ?? null,
				warm_up_minutes: warm_up?.minutes ?? null,
				cool_down_name: cool_down?.name ?? null,
				cool_down_minutes: cool_down?.minutes ?? null
			});

			// One running order across the three sections, so `order` still sorts
			// a session top to bottom and item ids stay unique within it.
			const sectioned: Array<[ItemSection, ItemSpec]> = [
				...(warm_up?.items ?? []).map((item): [ItemSection, ItemSpec] => ['warm_up', item]),
				...session.items.map((item): [ItemSection, ItemSpec] => ['main', item]),
				...(cool_down?.items ?? []).map((item): [ItemSection, ItemSpec] => ['cool_down', item])
			];
			sectioned.forEach(([section, item], index) => {
				items.push({
					id: childId(program.id, 'item', week.week_number, session.day_index, index + 1),
					session_id,
					order: index + 1,
					section,
					exercise_id: item.exercise_slug ? exerciseBySlug(item.exercise_slug).id : null,
					sets: item.sets ?? null,
					reps: item.reps ?? null,
					rpe: item.rpe ?? null,
					load_pct_1rm: item.load_pct_1rm ?? null,
					rest_seconds: item.rest_seconds ?? null,
					distance_m: item.distance_m ?? null,
					work_seconds: item.work_seconds ?? null,
					reps_count: item.reps_count ?? null,
					recovery_seconds: item.recovery_seconds ?? null,
					hr_pct_min: item.hr?.[0] ?? null,
					hr_pct_max: item.hr?.[1] ?? null,
					notes: item.notes ?? null
				});
			});
		}
	}

	return { program, weeks, sessions, items };
}

const SPECS: ProgramSpec[] = [
	// ---------------------------------------------------------------- strength
	{
		program: {
			id: '1a5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b01',
			slug: 'strength-foundations',
			name: 'Strength foundations',
			discipline: 'strength',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['max_strength', 'robustness'],
			min_age_group: 'u17',
			experience: ['first_year', 'developing'],
			weeks: 6,
			sessions_per_week: 2,
			equipment_required: ['home_weights'],
			summary:
				'Six weeks of technique-led lifting with a pair of dumbbells. Prescribed by effort and rep range, never by percentage of a maximum — the goal is a movement you own before you add weight to it.'
		},
		weeks: [
			{ focus: 'Learn the patterns', intensity_modifier: 0.9 },
			{ focus: 'Learn the patterns', intensity_modifier: 0.95 },
			{ focus: 'Add a little load', intensity_modifier: 1 },
			{ focus: 'Add a little load', intensity_modifier: 1.05 },
			{ focus: 'Deload — technique only', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Consolidate', intensity_modifier: 1.05 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Lower body and trunk',
				type: 'strength',
				duration_minutes: 35,
				items: [
					{ exercise_slug: 'goblet-squat', sets: 3, reps: '8-10', rpe: 6, rest_seconds: 90 },
					{
						exercise_slug: 'db-romanian-deadlift',
						sets: 3,
						reps: '8-10',
						rpe: 6,
						rest_seconds: 90
					},
					{
						exercise_slug: 'split-squat',
						sets: 2,
						reps: '8 each leg',
						rpe: 6,
						rest_seconds: 60
					},
					{ exercise_slug: 'plank', sets: 3, reps: '30 s hold', rest_seconds: 45 }
				]
			},
			{
				day_index: 2,
				name: 'Upper body and trunk',
				type: 'strength',
				duration_minutes: 40,
				items: [
					{ exercise_slug: 'push-up', sets: 3, reps: '8-12', rpe: 6, rest_seconds: 60 },
					{ exercise_slug: 'db-row', sets: 3, reps: '10 each side', rpe: 6, rest_seconds: 75 },
					{ exercise_slug: 'db-bench-press', sets: 3, reps: '8-10', rpe: 6, rest_seconds: 90 },
					{ exercise_slug: 'inverted-row', sets: 2, reps: '10', rpe: 7, rest_seconds: 60 },
					{ exercise_slug: 'dead-bug', sets: 3, reps: '8 each side', rest_seconds: 45 }
				]
			}
		]
	},
	{
		program: {
			id: '2b5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b02',
			slug: 'preseason-max-strength',
			name: 'Pre-season max strength',
			discipline: 'strength',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['max_strength', 'power'],
			min_age_group: 'senior',
			experience: ['developing', 'experienced'],
			weeks: 8,
			sessions_per_week: 3,
			equipment_required: ['full_gym'],
			summary:
				'Eight weeks of barbell strength and power across three sessions a week, built to be finished before round one. Three weeks up, a deload, three weeks heavier, then a week to freshen up.'
		},
		// The modifiers are deliberately narrow. Sessions carry the nominal
		// prescription (a top set of five at 80%), so a 1.15 peak would put five
		// reps at 92.5% — a number nobody hits for five, and the sort of
		// prescription that gets somebody hurt chasing it.
		weeks: [
			{ focus: 'Accumulate volume', intensity_modifier: 0.88 },
			{ focus: 'Accumulate volume', intensity_modifier: 0.94 },
			{ focus: 'Accumulate volume', intensity_modifier: 1 },
			{ focus: 'Deload', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Intensify', intensity_modifier: 1.03 },
			{ focus: 'Intensify', intensity_modifier: 1.06 },
			{ focus: 'Peak', intensity_modifier: 1.08 },
			{ focus: 'Freshen up', intensity_modifier: 0.85, is_deload: true }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Lower strength',
				type: 'strength',
				duration_minutes: 60,
				items: [
					{ exercise_slug: 'back-squat', sets: 4, reps: '5', load_pct_1rm: 80, rest_seconds: 180 },
					{
						exercise_slug: 'trap-bar-deadlift',
						sets: 3,
						reps: '5',
						load_pct_1rm: 75,
						rest_seconds: 150
					},
					{
						exercise_slug: 'walking-lunge',
						sets: 3,
						reps: '8 each leg',
						rpe: 7,
						rest_seconds: 90,
						notes: 'Dumbbells at the sides'
					},
					{ exercise_slug: 'nordic-curl-assisted', sets: 3, reps: '5', rest_seconds: 90 },
					{ exercise_slug: 'plank', sets: 3, reps: '45 s hold', rest_seconds: 45 }
				]
			},
			{
				day_index: 2,
				name: 'Upper strength',
				type: 'strength',
				duration_minutes: 50,
				items: [
					{
						exercise_slug: 'barbell-bench-press',
						sets: 4,
						reps: '5',
						load_pct_1rm: 80,
						rest_seconds: 180
					},
					{ exercise_slug: 'chin-up', sets: 4, reps: '5-8', rpe: 8, rest_seconds: 120 },
					{ exercise_slug: 'barbell-row', sets: 3, reps: '8', load_pct_1rm: 65, rest_seconds: 120 },
					{ exercise_slug: 'db-bench-press', sets: 2, reps: '10', rpe: 7, rest_seconds: 90 },
					{ exercise_slug: 'side-plank', sets: 3, reps: '30 s each side', rest_seconds: 45 }
				]
			},
			{
				day_index: 3,
				name: 'Power and landing',
				type: 'strength',
				duration_minutes: 45,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60 },
					{ exercise_slug: 'box-jump', sets: 5, reps: '3', rest_seconds: 120 },
					{
						exercise_slug: 'power-clean',
						sets: 4,
						reps: '3',
						load_pct_1rm: 70,
						rest_seconds: 180,
						notes: 'Technique before load — drop the weight the moment the bar path changes'
					},
					{ exercise_slug: 'barbell-hip-thrust', sets: 3, reps: '8', rpe: 8, rest_seconds: 120 },
					{ exercise_slug: 'drop-landing', sets: 3, reps: '5', rest_seconds: 60 }
				]
			}
		]
	},
	{
		program: {
			id: '3c5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b03',
			slug: 'in-season-strength-maintenance',
			name: 'In-season strength maintenance',
			discipline: 'strength',
			phase: 'in_season',
			target_positions: [],
			target_qualities: ['max_strength', 'robustness'],
			min_age_group: 'senior',
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 2,
			equipment_required: ['full_gym'],
			summary:
				'Two short sessions a week that hold onto pre-season strength without leaving you sore for the weekend. Low volume, moderate load, always finished at least 48 hours before a game.'
		},
		weeks: [
			{ focus: 'Hold the line', intensity_modifier: 1 },
			{ focus: 'Hold the line', intensity_modifier: 1 },
			{ focus: 'Hold the line', intensity_modifier: 1.05 },
			{ focus: 'Lighter week', intensity_modifier: 0.85, is_deload: true },
			{ focus: 'Hold the line', intensity_modifier: 1.05 },
			{ focus: 'Hold the line', intensity_modifier: 1 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Lower maintenance',
				type: 'strength',
				duration_minutes: 35,
				items: [
					{ exercise_slug: 'back-squat', sets: 3, reps: '4', load_pct_1rm: 75, rest_seconds: 150 },
					{
						exercise_slug: 'trap-bar-deadlift',
						sets: 2,
						reps: '4',
						load_pct_1rm: 70,
						rest_seconds: 150
					},
					{ exercise_slug: 'nordic-curl-assisted', sets: 2, reps: '4', rest_seconds: 90 },
					{ exercise_slug: 'side-plank', sets: 2, reps: '30 s each side', rest_seconds: 45 }
				]
			},
			{
				day_index: 2,
				name: 'Upper maintenance',
				type: 'strength',
				duration_minutes: 35,
				items: [
					{
						exercise_slug: 'barbell-bench-press',
						sets: 3,
						reps: '4',
						load_pct_1rm: 75,
						rest_seconds: 150
					},
					{ exercise_slug: 'chin-up', sets: 3, reps: '5', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'barbell-row', sets: 3, reps: '6', load_pct_1rm: 65, rest_seconds: 120 },
					{ exercise_slug: 'dead-bug', sets: 3, reps: '8 each side', rest_seconds: 45 }
				]
			}
		]
	},

	{
		program: {
			id: '7a5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b07',
			slug: 'u17-preseason-strength',
			name: 'Pre-season strength (Under 17)',
			discipline: 'strength',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['max_strength', 'power'],
			min_age_group: 'u17',
			/*
			 * First-year included on purpose. `experience` is a pitch, not a gate —
			 * it only scores (`programExperienceFit`), so a first-year U17 could
			 * always reach this block; leaving them out merely buried it below
			 * `strength-foundations`. Every set here is prescribed by RPE and rep
			 * range, which self-regulates for somebody new to lifting in a way a
			 * percentage never would, so the honest thing is to offer it level with
			 * foundations and let the player choose the ladder or the full block.
			 */
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 8,
			sessions_per_week: 3,
			equipment_required: ['home_weights'],
			summary:
				'The senior pre-season block, written for a seventeen year old: the same eight weeks and the same three sessions, prescribed by effort and rep range instead of percentages, on dumbbells rather than a loaded barbell.'
		},
		// The senior block's shape, deliberately — a U17 finishing this one steps
		// straight into `preseason-max-strength` the following year and recognises
		// every session. What changes is how the work is prescribed, not how it is
		// organised: no `load_pct_1rm` anywhere, because a percentage implies a
		// tested one-rep max and no junior should be testing one.
		weeks: [
			{ focus: 'Groove the patterns', intensity_modifier: 0.9 },
			{ focus: 'Groove the patterns', intensity_modifier: 0.95 },
			{ focus: 'Accumulate volume', intensity_modifier: 1 },
			{ focus: 'Deload', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Build', intensity_modifier: 1.03 },
			{ focus: 'Build', intensity_modifier: 1.06 },
			{ focus: 'Top of the block', intensity_modifier: 1.08 },
			{ focus: 'Freshen up', intensity_modifier: 0.85, is_deload: true }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Lower strength',
				type: 'strength',
				duration_minutes: 45,
				items: [
					{ exercise_slug: 'goblet-squat', sets: 4, reps: '6-8', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'db-romanian-deadlift', sets: 3, reps: '8', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'walking-lunge', sets: 3, reps: '8 each leg', rpe: 7, rest_seconds: 90 },
					{ exercise_slug: 'nordic-curl-assisted', sets: 3, reps: '5', rest_seconds: 90 },
					{ exercise_slug: 'plank', sets: 3, reps: '45 s hold', rest_seconds: 45 }
				]
			},
			{
				day_index: 2,
				name: 'Upper strength',
				type: 'strength',
				duration_minutes: 45,
				items: [
					{ exercise_slug: 'db-bench-press', sets: 4, reps: '6-8', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'chin-up', sets: 4, reps: '4-6', rpe: 8, rest_seconds: 120 },
					{ exercise_slug: 'db-row', sets: 3, reps: '8 each side', rpe: 7, rest_seconds: 90 },
					{ exercise_slug: 'push-up', sets: 2, reps: '10-15', rpe: 7, rest_seconds: 60 },
					{ exercise_slug: 'side-plank', sets: 3, reps: '30 s each side', rest_seconds: 45 }
				]
			},
			{
				day_index: 3,
				name: 'Power and landing',
				type: 'strength',
				duration_minutes: 40,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60 },
					{ exercise_slug: 'drop-landing', sets: 4, reps: '5', rest_seconds: 90 },
					{ exercise_slug: 'split-squat', sets: 3, reps: '8 each leg', rpe: 7, rest_seconds: 90 },
					{ exercise_slug: 'glute-bridge', sets: 3, reps: '12', rest_seconds: 60 },
					{ exercise_slug: 'dead-bug', sets: 3, reps: '8 each side', rest_seconds: 45 }
				]
			}
		]
	},
	{
		program: {
			id: '8b5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b08',
			slug: 'u17-in-season-maintenance',
			name: 'In-season maintenance (Under 17)',
			discipline: 'strength',
			phase: 'in_season',
			target_positions: [],
			target_qualities: ['max_strength', 'robustness'],
			min_age_group: 'u17',
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 2,
			equipment_required: ['home_weights'],
			summary:
				'Two short dumbbell sessions a week to hold what you built in pre-season, without leaving you sore for the weekend. Effort-based, and finished at least two days out from a game.'
		},
		weeks: [
			{ focus: 'Hold the line', intensity_modifier: 1 },
			{ focus: 'Hold the line', intensity_modifier: 1 },
			{ focus: 'Hold the line', intensity_modifier: 1.05 },
			{ focus: 'Lighter week', intensity_modifier: 0.85, is_deload: true },
			{ focus: 'Hold the line', intensity_modifier: 1.05 },
			{ focus: 'Hold the line', intensity_modifier: 1 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Lower maintenance',
				type: 'strength',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'goblet-squat', sets: 3, reps: '6', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'db-romanian-deadlift', sets: 2, reps: '8', rpe: 6, rest_seconds: 90 },
					{ exercise_slug: 'nordic-curl-assisted', sets: 2, reps: '4', rest_seconds: 90 },
					{ exercise_slug: 'side-plank', sets: 2, reps: '30 s each side', rest_seconds: 45 }
				]
			},
			{
				day_index: 2,
				name: 'Upper maintenance',
				type: 'strength',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'db-bench-press', sets: 3, reps: '6', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'chin-up', sets: 3, reps: '4', rpe: 7, rest_seconds: 120 },
					{ exercise_slug: 'db-row', sets: 3, reps: '8 each side', rpe: 6, rest_seconds: 90 },
					{ exercise_slug: 'dead-bug', sets: 3, reps: '8 each side', rest_seconds: 45 }
				]
			}
		]
	},

	// ------------------------------------------------------------ conditioning
	{
		program: {
			id: '4d5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b04',
			slug: 'running-foundations',
			name: 'Running foundations',
			discipline: 'conditioning',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['aerobic_capacity', 'agility', 'robustness'],
			min_age_group: 'u11',
			experience: ['first_year', 'developing'],
			weeks: 4,
			sessions_per_week: 2,
			equipment_required: [],
			summary:
				'Four weeks of running technique and easy aerobic work. No gear beyond a pair of runners and somewhere flat to run — a footpath will do.'
		},
		weeks: [
			{ focus: 'Technique first', intensity_modifier: 0.9 },
			{ focus: 'Technique first', intensity_modifier: 1 },
			{ focus: 'Build the base', intensity_modifier: 1.1 },
			{ focus: 'Build the base', intensity_modifier: 1.15 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Running technique and easy aerobic',
				type: 'running',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'ankling', reps_count: 3, distance_m: 20, recovery_seconds: 30 },
					{ exercise_slug: 'a-skip', reps_count: 3, distance_m: 20, recovery_seconds: 30 },
					{
						reps_count: 4,
						distance_m: 60,
						recovery_seconds: 60,
						hr: [70, 80],
						notes: 'Strides — build to about three-quarter pace, never a flat sprint'
					},
					{
						work_seconds: 480,
						hr: [65, 75],
						notes: 'Easy continuous run — you should be able to hold a chat'
					}
				]
			},
			{
				day_index: 2,
				name: 'Change of direction and game running',
				type: 'running',
				duration_minutes: 25,
				items: [
					{ exercise_slug: 'single-leg-balance', sets: 2, reps: '30 s each leg', rest_seconds: 30 },
					{
						reps_count: 6,
						distance_m: 20,
						recovery_seconds: 45,
						hr: [80, 88],
						notes: 'Shuttles — plant and turn off the outside foot, both directions'
					},
					{ work_seconds: 600, hr: [65, 75], notes: 'Easy continuous run' }
				]
			}
		]
	},
	{
		program: {
			id: '5e5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b05',
			slug: 'repeat-sprint-builder',
			name: 'Repeat sprint builder',
			discipline: 'conditioning',
			phase: 'pre_season',
			target_positions: ['inside_midfielder', 'outside_midfielder', 'small_forward'],
			target_qualities: ['repeat_sprint', 'aerobic_power', 'speed'],
			min_age_group: 'u15',
			experience: ['developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 3,
			equipment_required: ['oval'],
			summary:
				'Six weeks aimed squarely at the running a midfielder actually does: sprint, recover, sprint again, for four quarters. One speed day, one repeat-sprint day, one aerobic power day.'
		},
		weeks: [
			{ focus: 'Groundwork', intensity_modifier: 0.85 },
			{ focus: 'Groundwork', intensity_modifier: 0.95 },
			{ focus: 'Build', intensity_modifier: 1.05 },
			{ focus: 'Deload', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Sharpen', intensity_modifier: 1.1 },
			{ focus: 'Sharpen', intensity_modifier: 1.15 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Speed',
				type: 'running',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60 },
					{
						reps_count: 6,
						distance_m: 20,
						recovery_seconds: 90,
						hr: [75, 85],
						notes: 'Accelerations from a standing start — full recovery, quality over quantity'
					},
					{
						reps_count: 4,
						distance_m: 30,
						recovery_seconds: 120,
						hr: [80, 88],
						notes: 'Flying 30s — build over 20 m, then hold top speed through the zone'
					}
				]
			},
			{
				day_index: 2,
				name: 'Repeat sprint',
				type: 'running',
				duration_minutes: 30,
				items: [
					{
						sets: 3,
						reps_count: 6,
						distance_m: 40,
						work_seconds: 6,
						recovery_seconds: 24,
						rest_seconds: 180,
						hr: [88, 95],
						notes: 'Six 40 m efforts on 30 s, three sets, three minutes between sets'
					}
				]
			},
			{
				day_index: 3,
				name: 'Aerobic power',
				type: 'running',
				duration_minutes: 30,
				items: [
					{
						reps_count: 6,
						distance_m: 400,
						recovery_seconds: 120,
						hr: [85, 92],
						notes: 'Hard but even — the last one should match the first'
					}
				]
			}
		]
	},
	{
		program: {
			id: '6f5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b06',
			slug: 'in-season-running-topup',
			name: 'In-season running top-up',
			discipline: 'conditioning',
			phase: 'in_season',
			target_positions: [],
			target_qualities: ['repeat_sprint', 'aerobic_capacity'],
			min_age_group: 'u13',
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 4,
			sessions_per_week: 2,
			equipment_required: ['oval'],
			summary:
				'Two light sessions a week to hold your running through the season without adding to the load of training and a game. Both are short enough to sit either side of a main training night.'
		},
		weeks: [
			{ focus: 'Top up', intensity_modifier: 1 },
			{ focus: 'Top up', intensity_modifier: 1.05 },
			{ focus: 'Lighter week', intensity_modifier: 0.85, is_deload: true },
			{ focus: 'Top up', intensity_modifier: 1.05 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Match-speed top-up',
				type: 'running',
				duration_minutes: 15,
				items: [
					{
						reps_count: 8,
						distance_m: 60,
						recovery_seconds: 60,
						hr: [85, 92],
						notes: 'Hard runs — the length of a lead, with a walk back between'
					}
				]
			},
			{
				day_index: 2,
				name: 'Aerobic top-up',
				type: 'running',
				duration_minutes: 30,
				items: [
					{ work_seconds: 1200, hr: [70, 78], notes: 'Steady continuous run' },
					{
						reps_count: 4,
						distance_m: 100,
						recovery_seconds: 90,
						hr: [80, 88],
						notes: 'Even-paced, controlled — not a sprint session'
					}
				]
			}
		]
	},

	// ------------------------------------------------------------- plyometrics
	//
	// Jumping is its own discipline rather than a day inside a strength block,
	// because it is gated differently and a player should be able to carry it
	// alongside the other two. Landing technique is the cheapest injury
	// insurance in football and it needs no equipment, so foundations open at
	// `u13` — well below the `u17` floor on resistance work. What is held back
	// is the reactive end: depth jumps and repeated bounding put several times
	// bodyweight through a tendon, so those sit at `u17` and above.
	//
	// Every one of these is prescribed by quality. The heart rate bands are
	// deliberately low: a set of hops that drives the heart rate up has stopped
	// being a jumping set and turned into conditioning, which is a different
	// session and a worse one.
	{
		program: {
			id: '9a5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b09',
			slug: 'plyo-landing-foundations',
			name: 'Landing and hopping foundations',
			discipline: 'plyometrics',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['robustness', 'power', 'agility'],
			min_age_group: 'u13',
			experience: ['first_year', 'developing'],
			weeks: 4,
			sessions_per_week: 2,
			equipment_required: [],
			summary:
				'Four weeks of learning to land. Low hops and stuck landings on grass, nothing to jump off and nothing to carry — the knee and ankle control that keeps you on the park, built before anything reactive is asked of you.'
		},
		weeks: [
			{ focus: 'Land it quietly', intensity_modifier: 0.9 },
			{ focus: 'Land it quietly', intensity_modifier: 0.95 },
			{ focus: 'Hold every landing', intensity_modifier: 1 },
			{ focus: 'Add a little spring', intensity_modifier: 1.05 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Landing and hopping',
				type: 'plyometric',
				duration_minutes: 20,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60, hr: [60, 72] },
					{
						exercise_slug: 'drop-landing',
						sets: 3,
						reps: '5',
						rest_seconds: 90,
						hr: [55, 68],
						notes: 'Off a kerb or a low step — height is not the point, the landing is'
					},
					{
						exercise_slug: 'single-leg-hop-and-stick',
						sets: 3,
						reps: '4 each leg',
						rest_seconds: 60,
						hr: [58, 70]
					},
					{ exercise_slug: 'single-leg-balance', sets: 2, reps: '30 s each leg', rest_seconds: 30 }
				]
			},
			{
				day_index: 2,
				name: 'Hop, stick and turn',
				type: 'plyometric',
				duration_minutes: 20,
				items: [
					{
						exercise_slug: 'lateral-bound',
						sets: 3,
						reps: '5 each side',
						rest_seconds: 90,
						hr: [60, 72],
						notes: 'Sideways off the outside foot — the movement a spoil is made of'
					},
					{ exercise_slug: 'broad-jump', sets: 3, reps: '4', rest_seconds: 90, hr: [60, 72] },
					{ exercise_slug: 'pogo-hops', sets: 2, reps: '12', rest_seconds: 60, hr: [62, 75] },
					{ exercise_slug: 'dead-bug', sets: 2, reps: '8 each side', rest_seconds: 45 }
				]
			}
		]
	},
	{
		program: {
			id: 'aa5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b0a',
			slug: 'plyo-preseason-power',
			name: 'Pre-season reactive power',
			discipline: 'plyometrics',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['power', 'speed', 'acceleration'],
			min_age_group: 'senior',
			experience: ['developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 2,
			equipment_required: ['full_gym'],
			summary:
				'Six weeks of jumping for a first step that arrives before your opponent does. One vertical day, one horizontal day, both short — quality dies quickly here, and a set carried on past that point is only risk.'
		},
		// Narrow modifiers, as in the strength blocks, and for a sharper reason:
		// volume is what hurts people in a jumping block. The work progresses by
		// getting crisper, not longer.
		weeks: [
			{ focus: 'Rebuild the springs', intensity_modifier: 0.85 },
			{ focus: 'Rebuild the springs', intensity_modifier: 0.95 },
			{ focus: 'Get reactive', intensity_modifier: 1 },
			{ focus: 'Deload — landings only', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Sharpen', intensity_modifier: 1.05 },
			{ focus: 'Top of the block', intensity_modifier: 1.1 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Vertical power',
				type: 'plyometric',
				duration_minutes: 35,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60, hr: [62, 75] },
					{ exercise_slug: 'box-jump', sets: 5, reps: '3', rest_seconds: 120, hr: [65, 78] },
					{
						exercise_slug: 'depth-jump',
						sets: 3,
						reps: '4',
						rest_seconds: 150,
						hr: [60, 74],
						notes: 'The hardest thing in the block — cut it entirely on flat legs'
					},
					{ exercise_slug: 'hurdle-hop', sets: 3, reps: '5 hops', rest_seconds: 90, hr: [65, 78] }
				]
			},
			{
				day_index: 2,
				name: 'Horizontal power',
				type: 'plyometric',
				duration_minutes: 35,
				items: [
					{ exercise_slug: 'broad-jump', sets: 4, reps: '3', rest_seconds: 120, hr: [65, 78] },
					{
						exercise_slug: 'bounding',
						sets: 4,
						reps: '20 m',
						rest_seconds: 120,
						hr: [65, 78],
						notes: 'Grass only, and never on a hamstring that is already talking to you'
					},
					{
						exercise_slug: 'lateral-bound',
						sets: 3,
						reps: '4 each side',
						rest_seconds: 90,
						hr: [65, 78]
					},
					{
						exercise_slug: 'single-leg-hop-and-stick',
						sets: 3,
						reps: '4 each leg',
						rest_seconds: 60,
						hr: [60, 72]
					}
				]
			}
		]
	},
	{
		program: {
			id: 'ab5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b0b',
			slug: 'u17-plyo-preseason-power',
			name: 'Pre-season reactive power (Under 17)',
			discipline: 'plyometrics',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['power', 'speed', 'acceleration'],
			min_age_group: 'u17',
			/*
			 * First-year included for the same reason as `u17-preseason-strength`:
			 * the block was always reachable and only ranked below
			 * `plyo-landing-foundations`. Nothing here multiplies landing force —
			 * no box, no depth jump — so a first-year jumping on grass is doing
			 * hops and bounds, not absorbing a drop.
			 */
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 2,
			equipment_required: [],
			summary:
				'The senior jumping block, written for a seventeen year old: the same six weeks and the same two days, on grass with nothing to jump off. No depth jumps — the landing forces are the part a still-growing tendon does not need yet.'
		},
		// The senior block's shape on purpose, so finishing this one and stepping
		// into `plyo-preseason-power` next year is a change of exercise rather
		// than a change of habit. What comes out is the work that multiplies
		// landing force: the box and the depth jump.
		weeks: [
			{ focus: 'Rebuild the springs', intensity_modifier: 0.85 },
			{ focus: 'Rebuild the springs', intensity_modifier: 0.95 },
			{ focus: 'Get reactive', intensity_modifier: 1 },
			{ focus: 'Deload — landings only', intensity_modifier: 0.8, is_deload: true },
			{ focus: 'Sharpen', intensity_modifier: 1.05 },
			{ focus: 'Top of the block', intensity_modifier: 1.1 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Vertical power',
				type: 'plyometric',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 3, reps: '10', rest_seconds: 60, hr: [62, 75] },
					{ exercise_slug: 'hurdle-hop', sets: 4, reps: '5 hops', rest_seconds: 90, hr: [65, 78] },
					{ exercise_slug: 'drop-landing', sets: 3, reps: '5', rest_seconds: 90, hr: [55, 68] },
					{
						exercise_slug: 'single-leg-hop-and-stick',
						sets: 3,
						reps: '4 each leg',
						rest_seconds: 60,
						hr: [60, 72]
					}
				]
			},
			{
				day_index: 2,
				name: 'Horizontal power',
				type: 'plyometric',
				duration_minutes: 30,
				items: [
					{ exercise_slug: 'broad-jump', sets: 4, reps: '3', rest_seconds: 120, hr: [65, 78] },
					{
						exercise_slug: 'bounding',
						sets: 3,
						reps: '20 m',
						rest_seconds: 120,
						hr: [65, 78],
						notes: 'Grass only — stop the set the moment the stride shortens'
					},
					{
						exercise_slug: 'lateral-bound',
						sets: 3,
						reps: '4 each side',
						rest_seconds: 90,
						hr: [65, 78]
					},
					{ exercise_slug: 'pogo-hops', sets: 2, reps: '12', rest_seconds: 60, hr: [62, 75] }
				]
			}
		]
	},
	{
		program: {
			id: 'ac5c0d31-9e47-4b8f-a2c6-0d1e2f3a4b0c',
			slug: 'plyo-in-season-maintenance',
			name: 'In-season plyometric maintenance',
			discipline: 'plyometrics',
			phase: 'in_season',
			target_positions: [],
			target_qualities: ['power', 'robustness'],
			min_age_group: 'u15',
			experience: ['first_year', 'developing', 'experienced'],
			weeks: 6,
			sessions_per_week: 1,
			equipment_required: [],
			summary:
				'One twenty-minute session a week to keep the springs from going flat over a season. Low contacts, full recovery, and done early in the week — a jumping session close to a game costs you more than it gives you.'
		},
		weeks: [
			{ focus: 'Keep it ticking over', intensity_modifier: 1 },
			{ focus: 'Keep it ticking over', intensity_modifier: 1 },
			{ focus: 'Keep it ticking over', intensity_modifier: 1.05 },
			{ focus: 'Lighter week', intensity_modifier: 0.85, is_deload: true },
			{ focus: 'Keep it ticking over', intensity_modifier: 1.05 },
			{ focus: 'Keep it ticking over', intensity_modifier: 1 }
		],
		sessions: [
			{
				day_index: 1,
				name: 'Springs top-up',
				type: 'plyometric',
				duration_minutes: 15,
				items: [
					{ exercise_slug: 'pogo-hops', sets: 2, reps: '10', rest_seconds: 60, hr: [60, 72] },
					{ exercise_slug: 'hurdle-hop', sets: 2, reps: '5 hops', rest_seconds: 90, hr: [62, 75] },
					{
						exercise_slug: 'lateral-bound',
						sets: 2,
						reps: '4 each side',
						rest_seconds: 90,
						hr: [60, 72]
					},
					{ exercise_slug: 'broad-jump', sets: 2, reps: '3', rest_seconds: 90, hr: [60, 72] }
				]
			}
		]
	}
];

/** Every bundled program, assembled with its weeks, sessions and items. */
export const SEED_PROGRAM_PLANS: ProgramPlan[] = SPECS.map(expand);
