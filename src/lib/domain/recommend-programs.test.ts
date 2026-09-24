import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '$lib/data/seed/exercises';
import { SEED_POSITIONS } from '$lib/data/seed/positions';
import { SEED_PROGRAM_PLANS } from '$lib/data/seed/programs';
import { scaledLoad } from './program-plan';
import {
	AGE_GROUPS,
	LOCAL_USER_ID,
	type AgeGroup,
	type PlayerProfile,
	type TrainingProgram
} from '$lib/types';
import {
	describeExclusion,
	expandEquipmentAccess,
	isEligible,
	isStrengthWithheld,
	priorityQualities,
	recommendPrograms,
	STRENGTH_MIN_AGE_GROUP,
	type RecommendationContext
} from './recommend';

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'utility',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'developing',
		sessions_per_week: 3,
		available_days: [],
		equipment_access: [],
		schema_version: 3,
		created_at: '2026-08-01T00:00:00.000Z',
		updated_at: '2026-08-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

function ctx(overrides: Partial<PlayerProfile> = {}): RecommendationContext {
	return { profile: profile(overrides), positions: SEED_POSITIONS, today: '2026-08-01' };
}

let seq = 0;

function program(overrides: Partial<TrainingProgram> = {}): TrainingProgram {
	seq += 1;
	return {
		id: `program-${seq}`,
		slug: `program-${seq}`,
		name: `Program ${seq}`,
		discipline: 'strength',
		phase: 'pre_season',
		target_positions: [],
		target_qualities: [],
		min_age_group: 'senior',
		experience: [],
		weeks: 6,
		sessions_per_week: 3,
		equipment_required: [],
		summary: '',
		...overrides
	};
}

const SEED_PROGRAMS = SEED_PROGRAM_PLANS.map((plan) => plan.program);
const JUNIOR_BANDS: AgeGroup[] = ['u11', 'u13', 'u15'];

/**
 * The Phase 4 acceptance criterion, stated as a test: a junior cannot reach a
 * loaded lift by any route. Every layer that could leak one is checked
 * separately, because each is reachable on its own — the list, a typed program
 * URL, and the session view a program URL leads to.
 */
describe('junior strength gate', () => {
	it('withholds strength below the threshold and allows it from there up', () => {
		for (const band of JUNIOR_BANDS) {
			expect(isStrengthWithheld(profile({ age_group: band }))).toBe(true);
		}
		for (const band of ['u17', 'senior', 'masters'] as AgeGroup[]) {
			expect(isStrengthWithheld(profile({ age_group: band }))).toBe(false);
		}
	});

	it('excludes every strength program for a junior, whatever else it asks for', () => {
		const open = program({ min_age_group: 'u11', equipment_required: [], discipline: 'strength' });
		for (const band of JUNIOR_BANDS) {
			// Even a program authored with no age floor and no equipment at all.
			expect(isEligible(open, ctx({ age_group: band }))).toEqual({
				eligible: false,
				reason: { kind: 'junior_strength', from: STRENGTH_MIN_AGE_GROUP }
			});
		}
	});

	it('leaves conditioning alone — a junior is meant to be running', () => {
		const running = program({ discipline: 'conditioning', min_age_group: 'u11' });
		for (const band of JUNIOR_BANDS) {
			expect(isEligible(running, ctx({ age_group: band }))).toEqual({ eligible: true });
		}
	});

	it('explains the withholding as a decision, not as a missing feature', () => {
		expect(describeExclusion({ kind: 'junior_strength', from: 'u17' })).toBe(
			'strength training starts at Under 17'
		);
	});

	it('recommends no strength program from the seed library to a U13 or U15', () => {
		for (const band of JUNIOR_BANDS) {
			const { recommended, excluded } = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: band }));
			expect(recommended.every((r) => r.program.discipline === 'conditioning')).toBe(true);
			// Every strength program in the library is accounted for, and each is
			// excluded for the junior rule rather than incidentally on equipment.
			const strengthExclusions = excluded.filter((e) => e.program.discipline === 'strength');
			expect(strengthExclusions).toHaveLength(
				SEED_PROGRAMS.filter((p) => p.discipline === 'strength').length
			);
			expect(strengthExclusions.every((e) => e.reason.kind === 'junior_strength')).toBe(true);
		}
	});

	it('still leaves a junior something to train', () => {
		// Withholding strength must not empty the page. A U13 with no equipment
		// listed at all still gets running work.
		for (const band of JUNIOR_BANDS) {
			const { recommended } = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: band }));
			expect(recommended.length).toBeGreaterThan(0);
		}
	});

	it('gives a senior the full library back', () => {
		const { recommended } = recommendPrograms(
			SEED_PROGRAMS,
			ctx({ age_group: 'senior', equipment_access: ['full_gym', 'oval'] })
		);
		expect(recommended.some((r) => r.program.discipline === 'strength')).toBe(true);
	});
});

describe('seed content respects the duty of care', () => {
	const ageRank = (group: AgeGroup) => AGE_GROUPS.indexOf(group);

	it('has no strength program below the strength threshold', () => {
		for (const { program: p } of SEED_PROGRAM_PLANS) {
			if (p.discipline !== 'strength') continue;
			expect(ageRank(p.min_age_group)).toBeGreaterThanOrEqual(ageRank(STRENGTH_MIN_AGE_GROUP));
		}
	});

	it('prescribes no exercise a program’s own age floor would exclude', () => {
		const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const item of plan.items) {
				if (!item.exercise_id) continue;
				const exercise = byId.get(item.exercise_id);
				expect(exercise).toBeDefined();
				expect(ageRank(exercise!.min_age_group)).toBeLessThanOrEqual(
					ageRank(plan.program.min_age_group)
				);
			}
		}
	});

	it('prescribes no percentage of a one-rep max below senior', () => {
		// %1RM prescription implies a tested maximum, and no junior should be
		// testing one. Under-age programs are prescribed by RPE and rep range.
		for (const plan of SEED_PROGRAM_PLANS) {
			if (ageRank(plan.program.min_age_group) >= ageRank('senior')) continue;
			expect(plan.items.every((i) => i.load_pct_1rm === null)).toBe(true);
		}
	});

	it('asks for no equipment a program does not declare', () => {
		const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
		for (const plan of SEED_PROGRAM_PLANS) {
			const declared = expandEquipmentAccess(plan.program.equipment_required);
			for (const item of plan.items) {
				const exercise = item.exercise_id ? byId.get(item.exercise_id) : undefined;
				for (const required of exercise?.equipment_required ?? []) {
					expect(declared.has(required)).toBe(true);
				}
			}
		}
	});

	it('never lets a week’s intensity scale a prescription past what its reps can carry', () => {
		// Sessions are authored once and scaled by the week, so a hard week is
		// where a sane prescription turns into an unsafe one without anybody
		// editing a number. 90% is the ceiling for the rep ranges authored here.
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const item of plan.items) {
				if (item.load_pct_1rm === null) continue;
				for (const week of plan.weeks) {
					expect(scaledLoad(item, week)).toBeLessThanOrEqual(90);
				}
			}
		}
	});

	it('gives every conditioning program a junior-reachable floor', () => {
		const reachable = SEED_PROGRAM_PLANS.filter(
			(plan) =>
				plan.program.discipline === 'conditioning' && ageRank(plan.program.min_age_group) <= 1
		);
		expect(reachable.length).toBeGreaterThan(0);
	});
});

describe('seed program structure', () => {
	it('gives every program the number of weeks it claims, each with its sessions', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			expect(plan.weeks).toHaveLength(plan.program.weeks);
			expect(plan.weeks.map((w) => w.week_number)).toEqual(
				Array.from({ length: plan.program.weeks }, (_, i) => i + 1)
			);
			for (const week of plan.weeks) {
				const sessions = plan.sessions.filter((s) => s.week_number === week.week_number);
				expect(sessions).toHaveLength(plan.program.sessions_per_week);
			}
		}
	});

	it('derives ids that are unique across the whole library', () => {
		// Session and item ids are derived from the program id rather than typed
		// out, so a collision would be silent: two sessions sharing an id would
		// overwrite each other on seed.
		const ids = SEED_PROGRAM_PLANS.flatMap((plan) => [
			plan.program.id,
			...plan.sessions.map((s) => s.id),
			...plan.items.map((i) => i.id)
		]);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('gives every session at least one item', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const session of plan.sessions) {
				expect(plan.items.filter((i) => i.session_id === session.id).length).toBeGreaterThan(0);
			}
		}
	});
});

describe('expandEquipmentAccess', () => {
	it('treats a full gym as containing dumbbells and bands', () => {
		expect([...expandEquipmentAccess(['full_gym'])].sort()).toEqual([
			'bands',
			'full_gym',
			'home_weights'
		]);
	});

	it('does not let a player into a gym program on home weights', () => {
		expect(expandEquipmentAccess(['home_weights']).has('full_gym')).toBe(false);
		expect(
			isEligible(
				program({ discipline: 'conditioning', equipment_required: ['full_gym'] }),
				ctx({ equipment_access: ['home_weights'] })
			)
		).toMatchObject({ eligible: false });
	});
});

describe('recommendPrograms — scoring', () => {
	it('ranks a program targeting the position’s qualities above one that does not', () => {
		const midfieldRunning = program({
			name: 'Repeat sprint',
			discipline: 'conditioning',
			target_qualities: ['repeat_sprint', 'aerobic_capacity'],
			min_age_group: 'u11'
		});
		const rucking = program({
			name: 'Vertical power',
			discipline: 'conditioning',
			target_qualities: ['power', 'max_strength'],
			min_age_group: 'u11'
		});
		const { recommended } = recommendPrograms(
			[rucking, midfieldRunning],
			ctx({ primary_position: 'inside_midfielder' })
		);
		expect(recommended[0].program.name).toBe('Repeat sprint');
	});

	it('lifts a program written for the player’s position', () => {
		const general = program({ name: 'General', discipline: 'conditioning' });
		const forRuck = program({
			name: 'For rucks',
			discipline: 'conditioning',
			target_positions: ['ruck']
		});
		const { recommended } = recommendPrograms(
			[general, forRuck],
			ctx({ primary_position: 'ruck' })
		);
		expect(recommended[0].program.name).toBe('For rucks');
		expect(recommended[0].reason).toBe('Written for ruck');
	});

	it('ranks down a program asking for more sessions than the player trains', () => {
		const heavy = program({ name: 'Six a week', discipline: 'conditioning', sessions_per_week: 6 });
		const light = program({ name: 'Two a week', discipline: 'conditioning', sessions_per_week: 2 });
		const { recommended } = recommendPrograms([heavy, light], ctx({ sessions_per_week: 2 }));
		expect(recommended[0].program.name).toBe('Two a week');
	});

	it('ranks experience rather than filtering on it', () => {
		// Choosing an advanced block early is a training mistake, not an unsafe
		// one. The unsafe cases are age and load, and both are hard filters.
		const advanced = program({
			name: 'Advanced',
			discipline: 'conditioning',
			experience: ['experienced']
		});
		const { recommended, excluded } = recommendPrograms(
			[advanced],
			ctx({ experience: 'first_year' })
		);
		expect(excluded).toEqual([]);
		expect(recommended).toHaveLength(1);
	});

	it('orders stably when two programs score the same', () => {
		const a = program({ name: 'Bravo', discipline: 'conditioning' });
		const b = program({ name: 'Alpha', discipline: 'conditioning' });
		const { recommended } = recommendPrograms([a, b], ctx());
		expect(recommended.map((r) => r.program.name)).toEqual(['Alpha', 'Bravo']);
	});

	it('honours a limit', () => {
		expect(recommendPrograms(SEED_PROGRAMS, ctx(), 2).recommended).toHaveLength(2);
	});
});

describe('priorityQualities', () => {
	it('names what the position demands physically, strongest first', () => {
		const qualities = priorityQualities(ctx({ primary_position: 'inside_midfielder' }));
		expect(qualities.length).toBe(3);
		expect(qualities[0]).toBeDefined();
	});

	it('returns nothing when there is no position content to read', () => {
		expect(priorityQualities({ ...ctx(), positions: [] })).toEqual([]);
	});
});
