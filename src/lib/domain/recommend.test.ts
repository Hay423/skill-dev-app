import { describe, expect, it } from 'vitest';
import { SEED_POSITIONS } from '$lib/data/seed/positions';
import {
	LOCAL_USER_ID,
	POSITIONS,
	type Difficulty,
	type Drill,
	type EquipmentAccess,
	type PlayerProfile,
	type Position,
	type SkillCategory
} from '$lib/types';
import {
	describeExclusion,
	isEligible,
	positionWeights,
	priorityCategories,
	recommendDrills,
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
		schema_version: 1,
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

function drill(category: SkillCategory, overrides: Partial<Drill> = {}): Drill {
	seq += 1;
	return {
		id: `drill-${seq}`,
		slug: `drill-${seq}`,
		name: `Drill ${seq}`,
		category,
		summary: '',
		setup: '',
		coaching_points: [],
		equipment: [],
		min_players: 1,
		duration_minutes: 10,
		difficulty: 2 as Difficulty,
		tracks_reps: true,
		target_reps: 20,
		source: 'seed',
		active: 1,
		...overrides
	};
}

/** One drill per category, so a ranking reflects position weights and nothing else. */
const ONE_PER_CATEGORY: SkillCategory[] = [
	'kicking',
	'goalkicking',
	'handball',
	'marking',
	'ground_ball',
	'tackling',
	'evasion',
	'ruckwork'
];

describe('positionWeights', () => {
	it('normalises so the strongest skill is 1', () => {
		const { skills } = positionWeights(ctx({ primary_position: 'small_forward' }));
		expect(Math.max(...Object.values(skills))).toBe(1);
		expect(skills.goalkicking).toBe(1);
	});

	it('blends a secondary position at half weight', () => {
		const inside = positionWeights(ctx({ primary_position: 'inside_midfielder' }));
		const blended = positionWeights(
			ctx({ primary_position: 'inside_midfielder', secondary_position: 'key_forward' })
		);
		// Marking barely rates for a pure inside mid; adding a key forward lifts it.
		expect(blended.skills.marking).toBeGreaterThan(inside.skills.marking);
		// ...but never past what the primary position demands most.
		expect(blended.skills.marking).toBeLessThan(blended.skills.ground_ball);
	});

	it('does not inflate a two-position player across the board', () => {
		const blended = positionWeights(
			ctx({ primary_position: 'inside_midfielder', secondary_position: 'small_forward' })
		);
		expect(Math.max(...Object.values(blended.skills))).toBe(1);
	});

	it('returns all zeros rather than throwing when position content is missing', () => {
		const empty = positionWeights({ ...ctx(), positions: [] });
		expect(Object.values(empty.skills).every((w) => w === 0)).toBe(true);
		expect(Object.values(empty.physical).every((w) => w === 0)).toBe(true);
	});

	it('weights physical qualities too, for the programs that come later', () => {
		const { physical } = positionWeights(ctx({ primary_position: 'ruck' }));
		expect(physical.max_strength).toBe(1);
		expect(physical.max_strength).toBeGreaterThan(physical.speed);
	});
});

describe('recommendDrills — position drives the order', () => {
	// The plan's acceptance criterion: each position's top-ranked drill is the
	// one in the skill that position actually leans on hardest.
	const EXPECTED_TOP: Record<Position, SkillCategory> = {
		key_defender: 'marking',
		general_defender: 'kicking',
		inside_midfielder: 'ground_ball',
		outside_midfielder: 'kicking',
		ruck: 'ruckwork',
		key_forward: 'marking',
		medium_forward: 'marking',
		small_forward: 'goalkicking',
		utility: 'kicking'
	};

	for (const position of POSITIONS) {
		it(`ranks ${EXPECTED_TOP[position]} first for a ${position}`, () => {
			const drills = ONE_PER_CATEGORY.map((c) => drill(c));
			const { recommended } = recommendDrills(drills, ctx({ primary_position: position }));
			expect(recommended[0].drill.category).toBe(EXPECTED_TOP[position]);
		});
	}

	it('gives two profiles differing only by position demonstrably different orders', () => {
		const drills = ONE_PER_CATEGORY.map((c) => drill(c));
		const order = (position: Position) =>
			recommendDrills(drills, ctx({ primary_position: position })).recommended.map(
				(r) => r.drill.category
			);

		const forward = order('small_forward');
		const defender = order('key_defender');
		expect(forward).not.toEqual(defender);
		expect(forward[0]).toBe('goalkicking');
		expect(defender[0]).toBe('marking');
	});

	it('falls back to a stable order instead of breaking when position content is missing', () => {
		const drills = ONE_PER_CATEGORY.map((c) => drill(c));
		const { recommended } = recommendDrills(drills, { ...ctx(), positions: [] });
		expect(recommended).toHaveLength(drills.length);
		expect(recommended.every((r) => r.score > 0)).toBe(true);
	});
});

describe('recommendDrills — scoring signals', () => {
	it('lifts a drill tagged for the player position above an untagged one in the same skill', () => {
		const tagged = drill('kicking', { name: 'Tagged', position_tags: ['ruck'] });
		const general = drill('kicking', { name: 'General' });
		const { recommended } = recommendDrills([general, tagged], ctx({ primary_position: 'ruck' }));
		expect(recommended[0].drill.name).toBe('Tagged');
	});

	it('ranks a drill tagged for another position below a general one', () => {
		const otherPosition = drill('kicking', { name: 'Tagged', position_tags: ['key_forward'] });
		const general = drill('kicking', { name: 'General' });
		const { recommended } = recommendDrills(
			[otherPosition, general],
			ctx({ primary_position: 'ruck' })
		);
		expect(recommended[0].drill.name).toBe('General');
	});

	it('prefers foundation drills for a first-year player and advanced ones for an experienced one', () => {
		const drills = [
			drill('kicking', { name: 'Foundation', difficulty: 1 }),
			drill('kicking', { name: 'Advanced', difficulty: 3 })
		];
		const first = recommendDrills(drills, ctx({ experience: 'first_year' }));
		const experienced = recommendDrills(drills, ctx({ experience: 'experienced' }));
		expect(first.recommended[0].drill.name).toBe('Foundation');
		expect(experienced.recommended[0].drill.name).toBe('Advanced');
	});

	it('breaks ties by name so the order does not reshuffle between reloads', () => {
		const drills = [drill('kicking', { name: 'Zulu' }), drill('kicking', { name: 'Alpha' })];
		const { recommended } = recommendDrills(drills, ctx());
		expect(recommended.map((r) => r.drill.name)).toEqual(['Alpha', 'Zulu']);
		expect(recommended[0].score).toBe(recommended[1].score);
	});

	it('honours the limit', () => {
		const drills = ONE_PER_CATEGORY.map((c) => drill(c));
		expect(recommendDrills(drills, ctx(), 3).recommended).toHaveLength(3);
	});

	it('skips hidden drills entirely rather than reporting them as exclusions', () => {
		const hidden = drill('kicking', { active: 0 });
		const result = recommendDrills([hidden, drill('kicking')], ctx());
		expect(result.recommended).toHaveLength(1);
		expect(result.excluded).toHaveLength(0);
	});

	it('explains why a drill is recommended', () => {
		const { recommended } = recommendDrills(
			[drill('goalkicking', { position_tags: ['small_forward'] })],
			ctx({ primary_position: 'small_forward' })
		);
		expect(recommended[0].reason).toBe('Specific to small forward');
	});
});

describe('isEligible', () => {
	const gym: EquipmentAccess[] = ['full_gym'];

	it('excludes an item needing equipment the player does not have', () => {
		const result = isEligible(
			{ equipment_required: gym },
			ctx({ equipment_access: ['park', 'wall'] })
		);
		expect(result).toEqual({
			eligible: false,
			reason: { kind: 'equipment', missing: ['full_gym'] }
		});
	});

	it('allows an item whose equipment the player has', () => {
		expect(
			isEligible({ equipment_required: gym }, ctx({ equipment_access: ['full_gym'] }))
		).toEqual({ eligible: true });
	});

	it('excludes nothing on equipment when the player skipped the question', () => {
		// An unanswered question means "unknown", not "has nothing" — skipping
		// degrades the ranking, it does not empty the list.
		expect(isEligible({ equipment_required: gym }, ctx({ equipment_access: [] }))).toEqual({
			eligible: true
		});
	});

	it('gates on age group and cannot be satisfied by a younger player', () => {
		expect(isEligible({ min_age_group: 'u17' }, ctx({ age_group: 'u15' }))).toEqual({
			eligible: false,
			reason: { kind: 'age', required: 'u17' }
		});
		expect(isEligible({ min_age_group: 'u17' }, ctx({ age_group: 'senior' }))).toEqual({
			eligible: true
		});
		expect(isEligible({ min_age_group: 'u17' }, ctx({ age_group: 'masters' }))).toEqual({
			eligible: true
		});
	});

	it('reports age before equipment, so the youngest gate is the one explained', () => {
		const result = isEligible(
			{ min_age_group: 'u17', equipment_required: gym },
			ctx({ age_group: 'u15', equipment_access: ['park'] })
		);
		expect(result).toMatchObject({ reason: { kind: 'age' } });
	});
});

describe('recommendDrills — exclusions', () => {
	it('reports excluded drills rather than silently dropping them', () => {
		const needsGoals = drill('goalkicking', { name: 'Set shots', equipment_required: ['goals'] });
		const wallWork = drill('kicking', { name: 'Wall kicks', equipment_required: ['wall'] });
		const { recommended, excluded } = recommendDrills(
			[needsGoals, wallWork],
			ctx({ equipment_access: ['wall', 'backyard'] })
		);
		expect(recommended.map((r) => r.drill.name)).toEqual(['Wall kicks']);
		expect(excluded).toHaveLength(1);
		expect(excluded[0].drill.name).toBe('Set shots');
		expect(describeExclusion(excluded[0].reason)).toBe('needs goals');
	});
});

describe('describeExclusion', () => {
	it('lists multiple missing items readably', () => {
		expect(describeExclusion({ kind: 'equipment', missing: ['full_gym', 'bands', 'oval'] })).toBe(
			'needs full gym, resistance bands and oval access'
		);
	});

	it('states the age band an item is for', () => {
		expect(describeExclusion({ kind: 'age', required: 'u17' })).toBe('for Under 17 and above');
	});
});

describe('priorityCategories', () => {
	it('names what the position leans on hardest, strongest first', () => {
		expect(priorityCategories(ctx({ primary_position: 'inside_midfielder' }))).toEqual([
			'ground_ball',
			'handball',
			'tackling'
		]);
	});

	it('returns nothing when there is no position content to read', () => {
		expect(priorityCategories({ ...ctx(), positions: [] })).toEqual([]);
	});
});
