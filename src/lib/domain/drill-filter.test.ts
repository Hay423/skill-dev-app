import { describe, expect, it } from 'vitest';
import type { Difficulty, Drill, SkillCategory } from '$lib/types';
import {
	activeFilterCount,
	describeDrillFilterReason,
	describeFilter,
	filterDrills,
	groupExcludedDrills,
	isFilterSet,
	matchesFilter,
	noDrillFilter,
	placeOptions,
	playerOptions,
	timeOptions,
	type DrillFilter
} from './drill-filter';

let seq = 0;

function drill(overrides: Partial<Drill> = {}): Drill {
	seq += 1;
	return {
		id: `drill-${seq}`,
		slug: `drill-${seq}`,
		name: `Drill ${seq}`,
		category: 'kicking' as SkillCategory,
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

function filter(overrides: Partial<DrillFilter> = {}): DrillFilter {
	return { ...noDrillFilter(), ...overrides };
}

describe('matchesFilter', () => {
	it('keeps everything when nothing is set', () => {
		const demanding = drill({ min_players: 4, duration_minutes: 45, equipment_required: ['oval'] });
		expect(matchesFilter(demanding, noDrillFilter())).toEqual({ matches: true });
	});

	it('keeps a drill needing no more people than the player has', () => {
		expect(matchesFilter(drill({ min_players: 2 }), filter({ players: 2 }))).toEqual({
			matches: true
		});
		expect(matchesFilter(drill({ min_players: 1 }), filter({ players: 2 }))).toEqual({
			matches: true
		});
	});

	it('rules out a drill needing more people, naming how many', () => {
		expect(matchesFilter(drill({ min_players: 3 }), filter({ players: 1 }))).toEqual({
			matches: false,
			reason: { kind: 'players', needs: 3 }
		});
	});

	it('rules out a drill longer than the time budget, keeping one exactly at it', () => {
		expect(matchesFilter(drill({ duration_minutes: 10 }), filter({ max_minutes: 10 }))).toEqual({
			matches: true
		});
		expect(matchesFilter(drill({ duration_minutes: 15 }), filter({ max_minutes: 10 }))).toEqual({
			matches: false,
			reason: { kind: 'duration', minutes: 15 }
		});
	});

	it('rules out a drill whose place the player is not at', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['wall'] }), filter({ place: 'park' }))
		).toEqual({ matches: false, reason: { kind: 'place', missing: ['wall'] } });
	});

	/**
	 * The containment rules in `equipment.ts` are what make the place row usable
	 * at all: a player standing on an oval can do anything written for a park.
	 */
	it('treats a bigger space as covering a smaller one', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['park'] }), filter({ place: 'oval' }))
		).toEqual({ matches: true });
		expect(
			matchesFilter(drill({ equipment_required: ['backyard'] }), filter({ place: 'park' }))
		).toEqual({ matches: true });
	});

	it('does not treat a smaller space as covering a bigger one', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['oval'] }), filter({ place: 'backyard' }))
		).toMatchObject({ matches: false });
	});

	it('does not infer goals from an oval — posts are a fixture, not a size', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['goals'] }), filter({ place: 'oval' }))
		).toMatchObject({ matches: false, reason: { kind: 'place', missing: ['goals'] } });
	});

	/**
	 * The other direction, and the one single-select depends on: there is
	 * nowhere to put posts except a ground, so naming the goals must not cost
	 * the player every drill written for the grass around them.
	 */
	it('infers the whole ground from the goals', () => {
		for (const required of ['goals', 'oval', 'park', 'backyard'] as const) {
			expect(
				matchesFilter(drill({ equipment_required: [required] }), filter({ place: 'goals' })),
				`goals should cover ${required}`
			).toEqual({ matches: true });
		}
	});

	it('treats a wall as a backyard with something to kick against', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['backyard'] }), filter({ place: 'wall' }))
		).toEqual({ matches: true });
		// Not the reverse: plenty of backyards have no solid wall.
		expect(
			matchesFilter(drill({ equipment_required: ['wall'] }), filter({ place: 'backyard' }))
		).toMatchObject({ matches: false });
	});

	/** An open budget is an answer, not a constraint: it rules nothing out. */
	it('keeps every drill when the player says they have plenty of time', () => {
		expect(matchesFilter(drill({ duration_minutes: 45 }), filter({ max_minutes: 'open' }))).toEqual(
			{ matches: true }
		);
	});

	/** An unanswered row means "unknown", never "has nothing" — the profile's rule. */
	it('excludes nothing on place when no place is ticked', () => {
		expect(
			matchesFilter(drill({ equipment_required: ['oval'] }), filter({ max_minutes: 60 }))
		).toEqual({ matches: true });
	});

	it('excludes nothing on place when the drill declares no requirement', () => {
		expect(matchesFilter(drill(), filter({ place: 'backyard' }))).toEqual({ matches: true });
	});

	/**
	 * Only the first failure is ever shown, and headcount is the one the player
	 * cannot work around on their own.
	 */
	it('reports the headcount ahead of the place and the clock when several fail', () => {
		const result = matchesFilter(
			drill({ min_players: 3, duration_minutes: 45, equipment_required: ['oval'] }),
			filter({ players: 1, max_minutes: 10, place: 'backyard' })
		);
		expect(result).toMatchObject({ reason: { kind: 'players' } });
	});

	it('reports the place ahead of the clock', () => {
		const result = matchesFilter(
			drill({ duration_minutes: 45, equipment_required: ['oval'] }),
			filter({ max_minutes: 10, place: 'backyard' })
		);
		expect(result).toMatchObject({ reason: { kind: 'place' } });
	});
});

describe('filterDrills', () => {
	it('splits the library into what is kept and what is ruled out, with reasons', () => {
		const solo = drill({ min_players: 1 });
		const pair = drill({ min_players: 2 });
		const trio = drill({ min_players: 3 });

		const { kept, excluded } = filterDrills([solo, pair, trio], filter({ players: 2 }));

		expect(kept).toEqual([solo, pair]);
		expect(excluded).toEqual([{ drill: trio, reason: { kind: 'players', needs: 3 } }]);
	});

	it('preserves the order it was given, so a ranked list stays ranked', () => {
		const a = drill({ name: 'A' });
		const b = drill({ name: 'B' });
		expect(filterDrills([b, a], noDrillFilter()).kept.map((d) => d.name)).toEqual(['B', 'A']);
	});
});

describe('describeDrillFilterReason', () => {
	it('says what a drill needs, in the same voice as an eligibility exclusion', () => {
		expect(describeDrillFilterReason({ kind: 'players', needs: 3 })).toBe('needs 3 players');
		expect(describeDrillFilterReason({ kind: 'duration', minutes: 20 })).toBe('takes 20 min');
		expect(describeDrillFilterReason({ kind: 'place', missing: ['wall'] })).toBe('needs wall');
	});

	it('lists several missing places readably', () => {
		expect(describeDrillFilterReason({ kind: 'place', missing: ['goals', 'wall'] })).toBe(
			'needs goals and wall'
		);
	});
});

describe('the option rows', () => {
	const library = [
		drill({ min_players: 1, duration_minutes: 10, equipment_required: ['wall'] }),
		drill({ min_players: 1, duration_minutes: 20, equipment_required: ['goals'] }),
		drill({ min_players: 2, duration_minutes: 15, equipment_required: ['park'] }),
		drill({ min_players: 3, duration_minutes: 15 })
	];

	it('offers each headcount the library actually distinguishes, ascending', () => {
		expect(playerOptions(library)).toEqual([1, 2, 3]);
	});

	/**
	 * The longest drill never gets a cap of its own — a cap that keeps
	 * everything is indistinguishable from no cap. It sets the open chip's
	 * label instead.
	 */
	it('caps below the longest drill, and opens at the highest cap', () => {
		expect(timeOptions(library)).toEqual({ caps: [10, 15], open: 15 });
	});

	it('offers no time row at all when every drill is the same length', () => {
		expect(timeOptions([drill({ duration_minutes: 10 }), drill({ duration_minutes: 10 })])).toEqual(
			{ caps: [], open: null }
		);
	});

	/** Smallest to largest, so the row reads as a ladder rather than a taxonomy dump. */
	it('offers only places the library names, in order of size', () => {
		expect(placeOptions(library)).toEqual(['wall', 'park', 'goals']);
	});

	it('offers nothing when no drill declares a requirement', () => {
		expect(placeOptions([drill(), drill()])).toEqual([]);
	});
});

describe('describing the active filter', () => {
	it('counts each set constraint once', () => {
		expect(activeFilterCount(noDrillFilter())).toBe(0);
		expect(activeFilterCount(filter({ players: 1 }))).toBe(1);
		expect(activeFilterCount(filter({ place: 'park' }))).toBe(1);
		expect(activeFilterCount(filter({ players: 2, max_minutes: 10, place: 'wall' }))).toBe(3);
	});

	/** An open budget rules nothing out, but it is still an answer the player gave. */
	it('counts an open time budget as set', () => {
		expect(activeFilterCount(filter({ max_minutes: 'open' }))).toBe(1);
		expect(isFilterSet(filter({ max_minutes: 'open' }))).toBe(true);
	});

	it('knows an untouched filter from a set one', () => {
		expect(isFilterSet(noDrillFilter())).toBe(false);
		expect(isFilterSet(filter({ max_minutes: 10 }))).toBe(true);
	});

	it('reads as one line, in the order the rows appear', () => {
		expect(describeFilter(filter({ players: 1, max_minutes: 10, place: 'park' }))).toBe(
			'Just me · 10 min or less · park'
		);
		expect(describeFilter(filter({ players: 3 }))).toBe('3 people');
		expect(describeFilter(noDrillFilter())).toBe('');
	});

	it('labels an open budget from the highest cap, matching the chip that set it', () => {
		expect(describeFilter(filter({ max_minutes: 'open' }), 15)).toBe('15+ min');
	});

	it('falls back to words when there is no library to take a number from', () => {
		expect(describeFilter(filter({ max_minutes: 'open' }))).toBe('No time limit');
	});
});

describe('groupExcludedDrills', () => {
	it('collapses drills sharing a reason into one row, keeping first-seen order', () => {
		const a = drill({ name: 'A' });
		const b = drill({ name: 'B' });
		const c = drill({ name: 'C' });

		expect(
			groupExcludedDrills([
				{ drill: a, text: 'needs 3 players' },
				{ drill: b, text: 'needs goals' },
				{ drill: c, text: 'needs 3 players' }
			])
		).toEqual([
			{ text: 'needs 3 players', drills: [a, c] },
			{ text: 'needs goals', drills: [b] }
		]);
	});

	/**
	 * The two sources of exclusion describe themselves separately; landing on the
	 * same words is exactly when they should read as one row.
	 */
	it('groups an eligibility exclusion together with a filter one when the words match', () => {
		const a = drill({ name: 'A' });
		const b = drill({ name: 'B' });
		expect(
			groupExcludedDrills([
				{ drill: a, text: 'needs goals' },
				{ drill: b, text: 'needs goals' }
			])
		).toHaveLength(1);
	});
});
