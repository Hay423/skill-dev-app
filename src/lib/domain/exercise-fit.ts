import type {
	EquipmentAccess,
	Exercise,
	MovementPattern,
	PhysicalQuality,
	ProgramItem,
	TrainingProgram,
	Uuid
} from '$lib/types';
import { maxExtrasFor } from './load-policy';
import { expandEquipmentAccess, isEligible, positionWeights } from './recommend';
import type { RecommendationContext } from './recommend';

/**
 * Position-driven gym work.
 *
 * `PositionProfile.physical_weights` has existed since Phase 3 and, until now,
 * only ranked whole programs. `Exercise.primary_qualities` has been authored
 * since Phase 4 and was read by nothing at all. This module joins the two: a
 * ruck's weightings favour vertical power and landing work, an inside
 * midfielder's favour repeat effort and trunk strength, and the same session
 * comes out looking different for each of them.
 *
 * Two ways it shows up, both of them bounded:
 *
 * - **Extras** are appended to a session as clearly optional work. The authored
 *   program is untouched and they take no part in whether the session counts as
 *   done.
 * - **Substitutions** swap one accessory for a better-fitting one of the same
 *   movement pattern. The session's opening lift is never touched, and a swap
 *   only happens when the better fit is clear rather than marginal — a program
 *   whose every session quietly rearranges itself is one nobody can reason
 *   about.
 *
 * Everything here runs through `isEligible`, so the age gate and the equipment
 * rules apply to a position extra exactly as they do to an authored item.
 */

export interface ScoredExercise {
	exercise: Exercise;
	/** 0–1 against this position's physical demands. */
	score: number;
}

/**
 * How well an exercise serves what the position physically demands: the mean
 * of the position's weighting across the qualities the exercise trains.
 *
 * Mean rather than sum, so a focused exercise that trains one quality the
 * player badly needs is not beaten by a scattergun one that touches four they
 * need mildly.
 */
export function exerciseFit(exercise: Exercise, physical: Record<PhysicalQuality, number>): number {
	if (exercise.primary_qualities.length === 0) return 0;
	const total = exercise.primary_qualities.reduce((sum, q) => sum + (physical[q] ?? 0), 0);
	return total / exercise.primary_qualities.length;
}

/** Whether the program's own kit covers what this exercise needs. */
function withinProgramEquipment(exercise: Exercise, required: EquipmentAccess[]): boolean {
	if (exercise.equipment_required.length === 0) return true;
	const available = expandEquipmentAccess(required);
	return exercise.equipment_required.every((eq) => available.has(eq));
}

/**
 * Every exercise the player can actually do, ranked against their position.
 *
 * Eligibility first, exactly as with drills and programs: an exercise the age
 * gate excludes is not a low-ranked suggestion, it is not a suggestion.
 */
export function recommendExercises(
	exercises: Exercise[],
	ctx: RecommendationContext,
	limit?: number
): ScoredExercise[] {
	const { physical } = positionWeights(ctx);
	const ranked = exercises
		.filter((exercise) => isEligible(exercise, ctx).eligible)
		.map((exercise) => ({ exercise, score: exerciseFit(exercise, physical) }))
		// Name breaks ties so the order is stable across reloads.
		.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
	return limit === undefined ? ranked : ranked.slice(0, limit);
}

/**
 * How much better a candidate has to fit before an authored exercise is swapped
 * out for it. Deliberately high enough that most sessions see no substitution
 * at all.
 */
export const SUBSTITUTION_MARGIN = 0.15;

/** The opening lift of a session is the session. Substitution starts after it. */
const PROTECTED_ORDER = 1;

type AccessoryDose = NonNullable<Exercise['accessory_dose']>;

/** Fallback dosing for an extra, by movement pattern, when the exercise states none. */
const ACCESSORY_DOSE: Record<MovementPattern, AccessoryDose> = {
	squat: { sets: 2, reps: '10', rest_seconds: 60 },
	hinge: { sets: 2, reps: '10', rest_seconds: 60 },
	push: { sets: 2, reps: '10', rest_seconds: 60 },
	pull: { sets: 2, reps: '10', rest_seconds: 60 },
	lunge: { sets: 2, reps: '8 each leg', rest_seconds: 60 },
	carry: { sets: 3, reps: '20 m', rest_seconds: 60 },
	core: { sets: 3, reps: '8 each side', rest_seconds: 45 },
	plyometric: { sets: 3, reps: '5', rest_seconds: 90 },
	olympic: { sets: 3, reps: '3', rest_seconds: 120 }
};

export interface TailoredSession {
	/** Authored item id → the exercise shown in its place. */
	substitutions: Map<Uuid, { from: Exercise; to: Exercise }>;
	/** Optional position work, as items the existing renderer can already draw. */
	extras: Array<{ item: ProgramItem; exercise: Exercise }>;
}

export interface TailorInput {
	program: TrainingProgram;
	/** The session's authored items, in order. */
	items: ProgramItem[];
	/** The whole exercise library. */
	exercises: Exercise[];
	ctx: RecommendationContext;
	/** Extras are strength work; a running session is not the place for them. */
	session_type: string;
	/** Stable prefix for synthesised extra ids, normally the session id. */
	session_id: Uuid;
}

/**
 * Picks the position-specific substitutions and extras for one session.
 *
 * Returns descriptions of the changes rather than a rewritten item list: the
 * caller renders the authored session and marks what changed, so a player can
 * always see that a swap happened and what it replaced.
 */
export function tailorSession(input: TailorInput): TailoredSession {
	const { physical } = positionWeights(input.ctx);
	const byId = new Map(input.exercises.map((e) => [e.id, e]));

	const usable = input.exercises.filter(
		(exercise) =>
			isEligible(exercise, input.ctx).eligible &&
			withinProgramEquipment(exercise, input.program.equipment_required)
	);

	const used = new Set(
		input.items.map((item) => item.exercise_id).filter((id): id is Uuid => id !== null)
	);

	const substitutions = new Map<Uuid, { from: Exercise; to: Exercise }>();

	for (const item of input.items) {
		if (item.order <= PROTECTED_ORDER || item.exercise_id === null) continue;
		const current = byId.get(item.exercise_id);
		if (!current) continue;

		const currentFit = exerciseFit(current, physical);
		const better = usable
			.filter(
				(candidate) =>
					candidate.id !== current.id &&
					candidate.movement_pattern === current.movement_pattern &&
					!used.has(candidate.id)
			)
			.map((candidate) => ({ candidate, score: exerciseFit(candidate, physical) }))
			.filter(({ score }) => score - currentFit >= SUBSTITUTION_MARGIN)
			.sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))[0];

		if (!better) continue;
		substitutions.set(item.id, { from: current, to: better.candidate });
		used.delete(current.id);
		used.add(better.candidate.id);
	}

	const extras: TailoredSession['extras'] = [];
	if (input.session_type === 'strength') {
		const wanted = maxExtrasFor(input.ctx.profile);

		// Extras come from movement patterns the session does not already train.
		//
		// Ranking the whole library by position fit would bolt another big lift
		// onto the end of a session that just did five sets of squats — the
		// highest-scoring exercises are the heavy ones, and a second hinge after
		// a full lower day is not position work, it is just more. What a position
		// actually adds is the pattern the program left out: bounding and landing
		// for a small forward, vertical work for a ruck, carries for a midfielder.
		const trained = new Set<MovementPattern>(
			input.items
				.map((item) => (item.exercise_id ? byId.get(item.exercise_id) : undefined))
				.filter((e): e is Exercise => e !== undefined)
				.map((e) => e.movement_pattern)
		);

		const patterns = new Set<MovementPattern>();
		const candidates = usable
			.filter(
				(exercise) =>
					!used.has(exercise.id) &&
					!trained.has(exercise.movement_pattern) &&
					// A skill lift is never an optional add-on.
					exercise.movement_pattern !== 'olympic'
			)
			.map((exercise) => ({ exercise, score: exerciseFit(exercise, physical) }))
			.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));

		for (const { exercise } of candidates) {
			if (extras.length >= wanted) break;
			// One per movement pattern, so "extras" is not two versions of the
			// same thing bolted onto the end of a session.
			if (patterns.has(exercise.movement_pattern)) continue;
			patterns.add(exercise.movement_pattern);
			extras.push({
				item: extraItem(exercise, input.session_id, extras.length + 1),
				exercise
			});
		}
	}

	return { substitutions, extras };
}

/**
 * An extra as a `ProgramItem`, so the session view renders it with the same
 * code as everything else.
 *
 * The id is synthesised and marked, because these are not authored rows: it
 * keys the tick and nothing else. `isExtraItemId` is what stops an optional
 * extra counting towards whether the session is finished.
 */
const EXTRA_ID_PREFIX = 'extra:';

function extraItem(exercise: Exercise, session_id: Uuid, order: number): ProgramItem {
	const dose = exercise.accessory_dose ?? ACCESSORY_DOSE[exercise.movement_pattern];
	return {
		id: `${EXTRA_ID_PREFIX}${session_id}:${exercise.id}`,
		session_id,
		order,
		exercise_id: exercise.id,
		sets: dose.sets,
		reps: dose.reps,
		rpe: dose.rpe ?? null,
		load_pct_1rm: null,
		rest_seconds: dose.rest_seconds ?? null,
		distance_m: null,
		work_seconds: null,
		reps_count: null,
		recovery_seconds: null,
		// No authored band: an accessory lift reads the between-sets recovery
		// threshold its movement pattern earns it. See `domain/heart-rate.ts`.
		hr_pct_min: null,
		hr_pct_max: null,
		notes: null
	};
}

export function isExtraItemId(id: string): boolean {
	return id.startsWith(EXTRA_ID_PREFIX);
}

/** The qualities a position leans on hardest, for the "why this one" copy. */
export function topQualitiesFor(exercise: Exercise, ctx: RecommendationContext): PhysicalQuality[] {
	const { physical } = positionWeights(ctx);
	return [...exercise.primary_qualities].sort((a, b) => (physical[b] ?? 0) - (physical[a] ?? 0));
}
