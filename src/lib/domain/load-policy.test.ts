import { describe, expect, it } from 'vitest';
import { SEED_POSITIONS } from '$lib/data/seed/positions';
import { SEED_PROGRAM_PLANS } from '$lib/data/seed/programs';
import {
	AGE_GROUPS,
	LOCAL_USER_ID,
	type AgeGroup,
	type Drill,
	type PlayerProfile
} from '$lib/types';
import {
	describeLoadPolicy,
	describeProgramCaution,
	drillLimitFor,
	isMasters,
	loadModifierFor,
	MASTERS_LOAD_MODIFIER,
	maxSkillsDaysFor
} from './load-policy';
import { describePrescription, scaledLoad, scaledRepsCount } from './program-plan';
import { recommendDrills, recommendPrograms, type RecommendationContext } from './recommend';

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'inside_midfielder',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'experienced',
		sessions_per_week: 3,
		available_days: [],
		equipment_access: [],
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
function drill(duration_minutes: number, overrides: Partial<Drill> = {}): Drill {
	seq += 1;
	return {
		id: `drill-${seq}`,
		slug: `drill-${seq}`,
		name: `Drill ${seq}`,
		category: 'handball',
		summary: '',
		setup: '',
		coaching_points: [],
		equipment: [],
		min_players: 1,
		duration_minutes,
		difficulty: 2,
		tracks_reps: true,
		target_reps: 10,
		source: 'seed',
		active: 1,
		...overrides
	};
}

const SEED_PROGRAMS = SEED_PROGRAM_PLANS.map((plan) => plan.program);

describe('who the reduction applies to', () => {
	it('is masters and nobody else', () => {
		for (const band of AGE_GROUPS) {
			expect(isMasters(profile({ age_group: band }))).toBe(band === 'masters');
			expect(loadModifierFor(profile({ age_group: band }))).toBe(
				band === 'masters' ? MASTERS_LOAD_MODIFIER : 1
			);
		}
	});

	it('treats a missing profile as no reduction', () => {
		expect(loadModifierFor(undefined)).toBe(1);
		expect(drillLimitFor(undefined)).toBe(3);
	});
});

describe('prescriptions for masters', () => {
	const week = {
		program_id: 'p',
		week_number: 1,
		focus: '',
		intensity_modifier: 1,
		is_deload: false
	};
	const lift = {
		id: 'i',
		session_id: 's',
		order: 1,
		section: 'main' as const,
		exercise_id: 'e',
		sets: 4,
		reps: '5',
		rpe: null,
		load_pct_1rm: 80,
		rest_seconds: null,
		distance_m: null,
		work_seconds: null,
		reps_count: null,
		recovery_seconds: null,
		hr_pct_min: null,
		hr_pct_max: null,
		notes: null
	};

	it('cuts the load without touching the prescription itself', () => {
		expect(scaledLoad(lift, week)).toBe(80);
		expect(scaledLoad(lift, week, MASTERS_LOAD_MODIFIER)).toBe(67.5);
		expect(describePrescription(lift, week, MASTERS_LOAD_MODIFIER)).toBe('4 × 5 · 67.5% 1RM');
	});

	it('cuts running volume too, which is where the soft-tissue risk is', () => {
		const run = {
			...lift,
			sets: null,
			reps: null,
			load_pct_1rm: null,
			reps_count: 6,
			distance_m: 400
		};
		expect(scaledRepsCount(run, week)).toBe(6);
		expect(scaledRepsCount(run, week, MASTERS_LOAD_MODIFIER)).toBe(5);
	});

	it('compounds with the week rather than replacing it', () => {
		// A masters deload is lighter than a masters baseline, which is the whole
		// reason the two multipliers stay separate.
		const deload = { ...week, intensity_modifier: 0.8, is_deload: true };
		expect(scaledLoad(lift, deload, MASTERS_LOAD_MODIFIER)).toBe(55);
		expect(scaledLoad(lift, week, MASTERS_LOAD_MODIFIER)).toBe(67.5);
	});
});

describe('recommendations for masters', () => {
	it('leads with the lighter block rather than hiding the heavier one', () => {
		const masters = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'masters' }));
		const senior = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'senior' }));

		const topStrength = (r: typeof masters) =>
			r.recommended.find((x) => x.program.discipline === 'strength')!.program.slug;

		expect(topStrength(masters)).toBe('in-season-strength-maintenance');
		expect(topStrength(senior)).toBe('preseason-max-strength');

		// Nothing is withheld: strength training is what protects an ageing body,
		// so the heavy block is still there, just not led with.
		expect(masters.recommended.map((r) => r.program.slug)).toContain('preseason-max-strength');
		expect(masters.excluded).toEqual([]);
	});

	it('says why a block is heavier than a masters player needs', () => {
		const masters = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'masters' }));
		const heavy = masters.recommended.find((r) => r.program.slug === 'preseason-max-strength');
		expect(heavy?.caution).toBe('3 sessions a week — more than most masters players need');

		const senior = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'senior' }));
		expect(senior.recommended.every((r) => r.caution === null)).toBe(true);
	});

	it('flags a pre-season block even at a manageable frequency', () => {
		expect(describeProgramCaution(profile({ age_group: 'masters' }), 2, 'pre_season')).toBe(
			'A full pre-season load'
		);
		expect(describeProgramCaution(profile({ age_group: 'masters' }), 2, 'in_season')).toBeNull();
	});

	it('offers fewer drills, and shorter ones', () => {
		expect(drillLimitFor(profile({ age_group: 'masters' }))).toBe(2);
		expect(drillLimitFor(profile({ age_group: 'senior' }))).toBe(3);

		const long = drill(30, { name: 'Long' });
		const short = drill(10, { name: 'Short' });
		const masters = recommendDrills([long, short], ctx({ age_group: 'masters' }));
		expect(masters.recommended[0].drill.name).toBe('Short');
	});

	it('does not drop an experienced masters player to beginner drills', () => {
		// Difficulty is about skill, not injury risk, and a masters player is
		// usually the most experienced person at the club.
		const advanced = drill(10, { name: 'Advanced', difficulty: 3 });
		const foundation = drill(10, { name: 'Foundation', difficulty: 1 });
		const ranked = recommendDrills(
			[foundation, advanced],
			ctx({ age_group: 'masters', experience: 'experienced' })
		);
		expect(ranked.recommended[0].drill.name).toBe('Advanced');
	});

	it('fills fewer days of the calendar with optional skills work', () => {
		expect(maxSkillsDaysFor(profile({ age_group: 'masters' }))).toBe(2);
		expect(maxSkillsDaysFor(profile({ age_group: 'senior' }))).toBe(Infinity);
	});

	it('explains itself, and only to the players it applies to', () => {
		expect(describeLoadPolicy(profile({ age_group: 'masters' }))).toContain('15%');
		expect(describeLoadPolicy(profile({ age_group: 'senior' }))).toBeNull();
	});
});

describe('the U17 blocks', () => {
	const ageRank = (group: AgeGroup) => AGE_GROUPS.indexOf(group);

	it('mirror the senior blocks they lead into', () => {
		const pairs: Array<[string, string]> = [
			['u17-preseason-strength', 'preseason-max-strength'],
			['u17-in-season-maintenance', 'in-season-strength-maintenance']
		];
		for (const [junior, senior] of pairs) {
			const j = SEED_PROGRAMS.find((p) => p.slug === junior)!;
			const s = SEED_PROGRAMS.find((p) => p.slug === senior)!;
			expect(j.weeks).toBe(s.weeks);
			expect(j.sessions_per_week).toBe(s.sessions_per_week);
			expect(j.phase).toBe(s.phase);
			expect(j.min_age_group).toBe('u17');
		}
	});

	it('reach a U17 player, who now has a pre-season and an in-season option', () => {
		const { recommended } = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'u17' }));
		const slugs = recommended
			.filter((r) => r.program.discipline === 'strength')
			.map((r) => r.program.slug);
		expect(slugs).toContain('u17-preseason-strength');
		expect(slugs).toContain('u17-in-season-maintenance');
		// And the senior blocks still do not.
		expect(slugs).not.toContain('preseason-max-strength');
		expect(slugs).not.toContain('in-season-strength-maintenance');
	});

	it('are led with for a U17 and not for anybody older', () => {
		// `min_age_group` is a floor, not an audience. Without an age-fit scorer a
		// masters player's best-ranked strength block was the one named "Under 17".
		const forU17 = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: 'u17' })).recommended;
		expect(forU17.find((r) => r.program.discipline === 'strength')!.program.slug).toMatch(/^u17-/);

		for (const band of ['senior', 'masters'] as AgeGroup[]) {
			const top = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: band })).recommended.find(
				(r) => r.program.discipline === 'strength'
			)!;
			expect(top.program.slug).not.toMatch(/^u17-/);
		}
	});

	it('stay out of reach of the age bands below them', () => {
		// Asserted as "nothing under load", not as "conditioning only". Plyometrics
		// is deliberately open below u17 — landing technique needs no equipment and
		// is what keeps a junior's ankles and knees intact — so the rule that
		// matters is the absence of resistance work, not the absence of everything
		// but running.
		for (const band of ['u11', 'u13', 'u15'] as AgeGroup[]) {
			const { recommended } = recommendPrograms(SEED_PROGRAMS, ctx({ age_group: band }));
			expect(recommended.some((r) => r.program.discipline === 'strength')).toBe(false);
		}
	});

	it('prescribe by effort, never by a percentage of a max', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			if (ageRank(plan.program.min_age_group) >= ageRank('senior')) continue;
			expect(plan.items.every((i) => i.load_pct_1rm === null)).toBe(true);
			// And an effort-based block has to actually state an effort somewhere.
			if (plan.program.discipline === 'strength') {
				expect(plan.items.some((i) => i.rpe !== null)).toBe(true);
			}
		}
	});
});
