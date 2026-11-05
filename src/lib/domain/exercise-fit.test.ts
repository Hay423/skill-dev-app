import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '$lib/data/seed/exercises';
import { SEED_POSITIONS } from '$lib/data/seed/positions';
import {
	LOCAL_USER_ID,
	type Exercise,
	type PlayerProfile,
	type ProgramItem,
	type TrainingProgram
} from '$lib/types';
import type { RecommendationContext } from './recommend';
import {
	exerciseFit,
	isExtraItemId,
	recommendExercises,
	tailorSession,
	topQualitiesFor
} from './exercise-fit';

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'ruck',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'experienced',
		sessions_per_week: 3,
		available_days: [],
		equipment_access: ['full_gym'],
		retest_interval_weeks: 4,
		schema_version: 3,
		created_at: '2026-09-01T00:00:00.000Z',
		updated_at: '2026-09-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

function ctx(overrides: Partial<PlayerProfile> = {}): RecommendationContext {
	return { profile: profile(overrides), positions: SEED_POSITIONS, today: '2026-09-16' };
}

let seq = 0;
function exercise(overrides: Partial<Exercise> = {}): Exercise {
	seq += 1;
	return {
		id: `ex-${seq}`,
		slug: `ex-${seq}`,
		name: `Exercise ${seq}`,
		movement_pattern: 'squat',
		primary_qualities: [],
		equipment_required: [],
		min_age_group: 'u11',
		contraindicated_regions: [],
		coaching_points: [],
		regression_slug: null,
		progression_slug: null,
		...overrides
	};
}

function item(overrides: Partial<ProgramItem> = {}): ProgramItem {
	return {
		id: 'item-1',
		session_id: 'session-1',
		order: 1,
		section: 'main',
		exercise_id: null,
		sets: 3,
		reps: '5',
		rpe: null,
		load_pct_1rm: null,
		rest_seconds: null,
		distance_m: null,
		work_seconds: null,
		reps_count: null,
		recovery_seconds: null,
		hr_pct_min: null,
		hr_pct_max: null,
		notes: null,
		...overrides
	};
}

function program(overrides: Partial<TrainingProgram> = {}): TrainingProgram {
	return {
		id: 'p1',
		slug: 'p1',
		name: 'Program',
		discipline: 'strength',
		phase: 'pre_season',
		target_positions: [],
		target_qualities: [],
		min_age_group: 'senior',
		experience: [],
		weeks: 6,
		sessions_per_week: 2,
		equipment_required: ['full_gym'],
		summary: '',
		...overrides
	};
}

describe('exerciseFit', () => {
	it('is the average weight across the qualities it trains', () => {
		const physical = { power: 1, max_strength: 0.4 } as Record<string, number>;
		const power = exercise({ primary_qualities: ['power'] });
		const both = exercise({ primary_qualities: ['power', 'max_strength'] });
		expect(exerciseFit(power, physical as never)).toBeCloseTo(1);
		expect(exerciseFit(both, physical as never)).toBeCloseTo(0.7);
	});

	it('scores an exercise with no qualities at zero rather than crashing', () => {
		expect(exerciseFit(exercise({ primary_qualities: [] }), {} as never)).toBe(0);
	});
});

describe('recommendExercises', () => {
	it('ranks the library differently for different positions', () => {
		// Ruck weights max strength and power highest; a small forward weights
		// acceleration and agility highest — the top pick should not agree.
		const ruck = recommendExercises(SEED_EXERCISES, ctx({ primary_position: 'ruck' }));
		const smallForward = recommendExercises(
			SEED_EXERCISES,
			ctx({ primary_position: 'small_forward' })
		);
		expect(ruck[0].exercise.slug).not.toBe(smallForward[0].exercise.slug);
	});

	it('excludes what the age gate excludes rather than ranking it low', () => {
		const ranked = recommendExercises(SEED_EXERCISES, ctx({ age_group: 'u13' }));
		expect(
			ranked.every(
				(r) => r.exercise.min_age_group !== 'u17' && r.exercise.min_age_group !== 'senior'
			)
		).toBe(true);
	});

	it('honours a limit', () => {
		expect(recommendExercises(SEED_EXERCISES, ctx(), 5)).toHaveLength(5);
	});
});

describe('tailorSession, substitution', () => {
	it('never substitutes the opening item of a session', () => {
		const weak = exercise({ movement_pattern: 'squat', primary_qualities: [] });
		const strong = exercise({
			movement_pattern: 'squat',
			primary_qualities: ['power', 'max_strength']
		});
		const items = [item({ id: 'i1', order: 1, exercise_id: weak.id })];
		const result = tailorSession({
			program: program(),
			items,
			exercises: [weak, strong],
			ctx: ctx(),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.substitutions.size).toBe(0);
	});

	it('does not substitute when nothing clears the margin', () => {
		const anchor = exercise({ id: 'anchor', movement_pattern: 'squat' });
		const weak = exercise({ movement_pattern: 'lunge', primary_qualities: ['aerobic_capacity'] });
		const slightlyBetter = exercise({ movement_pattern: 'lunge', primary_qualities: ['mobility'] });
		const items = [
			item({ id: 'i1', order: 1, exercise_id: anchor.id }),
			item({ id: 'i2', order: 2, exercise_id: weak.id })
		];
		const result = tailorSession({
			program: program(),
			items,
			exercises: [anchor, weak, slightlyBetter],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		// Ruck weights power and robustness highly; neither exercise trains them,
		// so both score near zero and the gap never clears the margin.
		expect(result.substitutions.has('i2')).toBe(false);
	});

	it('swaps in a clearly better fitting exercise of the same movement pattern', () => {
		const anchor = exercise({ id: 'anchor', movement_pattern: 'squat' });
		const generic = exercise({
			id: 'generic-lunge',
			movement_pattern: 'lunge',
			primary_qualities: ['mobility']
		});
		const rucky = exercise({
			id: 'ruck-lunge',
			movement_pattern: 'lunge',
			primary_qualities: ['power', 'robustness', 'max_strength']
		});
		const items = [
			item({ id: 'i1', order: 1, exercise_id: anchor.id }),
			item({ id: 'i2', order: 2, exercise_id: generic.id })
		];
		const result = tailorSession({
			program: program(),
			items,
			exercises: [anchor, generic, rucky],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.substitutions.get('i2')?.to.id).toBe('ruck-lunge');
		expect(result.substitutions.get('i2')?.from.id).toBe(generic.id);
	});

	it('never substitutes in an exercise the age gate or the program equipment excludes', () => {
		const anchor = exercise({ id: 'anchor', movement_pattern: 'squat' });
		const generic = exercise({ id: 'generic', movement_pattern: 'hinge', primary_qualities: [] });
		const gymOnly = exercise({
			id: 'gym-only',
			movement_pattern: 'hinge',
			primary_qualities: ['power', 'max_strength'],
			equipment_required: ['full_gym']
		});
		const items = [
			item({ id: 'i1', order: 1, exercise_id: anchor.id }),
			item({ id: 'i2', order: 2, exercise_id: generic.id })
		];
		const result = tailorSession({
			program: program({ equipment_required: [] }), // the program itself declares no gym
			items,
			exercises: [anchor, generic, gymOnly],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.substitutions.has('i2')).toBe(false);
	});
});

describe('tailorSession, around a warm-up and cool-down', () => {
	it('protects the first lift of the main work, not the first item of the warm-up', () => {
		// With a warm-up in front, the opening lift is no longer order 1 — it is
		// still the session, and still never swapped.
		const warmUp = exercise({ id: 'warm', movement_pattern: 'squat' });
		const opener = exercise({ id: 'opener', movement_pattern: 'lunge', primary_qualities: [] });
		const rucky = exercise({
			id: 'ruck-lunge',
			movement_pattern: 'lunge',
			primary_qualities: ['power', 'robustness', 'max_strength']
		});
		const result = tailorSession({
			program: program(),
			items: [
				item({ id: 'w1', order: 1, section: 'warm_up', exercise_id: warmUp.id }),
				item({ id: 'i1', order: 2, exercise_id: opener.id })
			],
			exercises: [warmUp, opener, rucky],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.substitutions.size).toBe(0);
	});

	it('never substitutes a warm-up or cool-down item', () => {
		const anchor = exercise({ id: 'anchor', movement_pattern: 'squat' });
		const generic = exercise({ id: 'generic', movement_pattern: 'lunge', primary_qualities: [] });
		const rucky = exercise({
			id: 'ruck-lunge',
			movement_pattern: 'lunge',
			primary_qualities: ['power', 'robustness', 'max_strength']
		});
		const result = tailorSession({
			program: program(),
			items: [
				item({ id: 'i1', order: 1, exercise_id: anchor.id }),
				item({ id: 'c1', order: 2, section: 'cool_down', exercise_id: generic.id })
			],
			exercises: [anchor, generic, rucky],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.substitutions.has('c1')).toBe(false);
	});

	it('does not count a warm-up squat as the session already training squats', () => {
		const squat = SEED_EXERCISES.find((e) => e.slug === 'bodyweight-squat')!;
		const press = SEED_EXERCISES.find((e) => e.slug === 'barbell-bench-press')!;
		const tailor = (items: ProgramItem[]) =>
			tailorSession({
				program: program(),
				items,
				exercises: SEED_EXERCISES,
				ctx: ctx({ primary_position: 'ruck' }),
				session_type: 'strength',
				session_id: 's1'
			});
		const withWarmUp = tailor([
			item({ id: 'w1', order: 1, section: 'warm_up', exercise_id: squat.id }),
			item({ id: 'i1', order: 2, exercise_id: press.id })
		]);
		const without = tailor([item({ id: 'i1', order: 1, exercise_id: press.id })]);
		expect(withWarmUp.extras.map((e) => e.exercise.id)).toEqual(
			without.extras.map((e) => e.exercise.id)
		);
	});

	it('never offers a stretch as position work', () => {
		for (const position of ['ruck', 'small_forward', 'key_defender'] as const) {
			const result = tailorSession({
				program: program(),
				items: [],
				exercises: SEED_EXERCISES,
				ctx: ctx({ primary_position: position }),
				session_type: 'strength',
				session_id: 's1'
			});
			expect(result.extras.every((e) => e.exercise.movement_pattern !== 'mobility')).toBe(true);
		}
	});
});

describe('tailorSession, extras', () => {
	it('only offers extras on a strength session', () => {
		const result = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'running',
			session_id: 's1'
		});
		expect(result.extras).toEqual([]);
	});

	it('does not repeat a movement pattern the session already trains', () => {
		const trained = exercise({ id: 'trained', movement_pattern: 'squat' });
		const items = [item({ id: 'i1', order: 1, exercise_id: trained.id })];
		const result = tailorSession({
			program: program(),
			items,
			exercises: [trained, ...SEED_EXERCISES],
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.extras.every((e) => e.exercise.movement_pattern !== 'squat')).toBe(true);
	});

	it('never offers an olympic lift as an optional extra', () => {
		const result = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.extras.every((e) => e.exercise.movement_pattern !== 'olympic')).toBe(true);
	});

	it('caps the number of extras, fewer for masters', () => {
		const senior = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ age_group: 'senior' }),
			session_type: 'strength',
			session_id: 's1'
		});
		const masters = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ age_group: 'masters' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(senior.extras.length).toBeGreaterThan(masters.extras.length);
	});

	it('gives different positions different extras', () => {
		const ruckExtras = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		}).extras.map((e) => e.exercise.slug);
		const forwardExtras = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'small_forward' }),
			session_type: 'strength',
			session_id: 's1'
		}).extras.map((e) => e.exercise.slug);
		expect(ruckExtras).not.toEqual(forwardExtras);
	});

	it('marks its synthesised items so they can be excluded from completion', () => {
		const result = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		expect(result.extras.length).toBeGreaterThan(0);
		expect(result.extras.every((e) => isExtraItemId(e.item.id))).toBe(true);
		expect(isExtraItemId('item-1')).toBe(false);
	});

	it('gives an extra a sensible dose even when the exercise states none', () => {
		const result = tailorSession({
			program: program(),
			items: [],
			exercises: SEED_EXERCISES,
			ctx: ctx({ primary_position: 'ruck' }),
			session_type: 'strength',
			session_id: 's1'
		});
		for (const { item: extraItem } of result.extras) {
			expect(extraItem.sets).not.toBeNull();
			expect(extraItem.reps).not.toBeNull();
		}
	});
});

describe('topQualitiesFor', () => {
	it('orders an exercise own qualities by what the position weights highest', () => {
		const ex = exercise({ primary_qualities: ['aerobic_capacity', 'power'] });
		const [first] = topQualitiesFor(ex, ctx({ primary_position: 'ruck' }));
		expect(first).toBe('power');
	});
});
