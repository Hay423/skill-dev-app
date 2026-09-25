import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { POSITIONS } from '$lib/types';

/**
 * The seeders are insert-only, which is what lets local edits and hide/show
 * state survive a boot. That property is easy to break by reaching for
 * `bulkPut`, so it is asserted here against a real (faked) IndexedDB rather
 * than assumed.
 */
describe('seedPositions', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('seeds every position once, keyed by position, without overwriting on a second boot', async () => {
		const { db } = await import('./db');
		const { seedPositions } = await import('./index');

		await seedPositions();
		expect(await db.positions.count()).toBe(POSITIONS.length);
		// Keyed by the taxonomy itself, so re-seeding can recognise what it already wrote.
		expect((await db.positions.toCollection().primaryKeys()).sort()).toEqual([...POSITIONS].sort());

		// Stand in for a locally tuned weight, then re-seed as a fresh boot would.
		await db.positions.update('ruck', { summary: 'Locally edited' });
		await seedPositions();

		expect(await db.positions.count()).toBe(POSITIONS.length);
		await expect(db.positions.get('ruck')).resolves.toMatchObject({ summary: 'Locally edited' });
	});
});

describe('seedExercises and seedPrograms', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('seeds each program once with its whole subtree, and leaves local edits alone on re-seed', async () => {
		const { db } = await import('./db');
		const { seedExercises, seedPrograms } = await import('./index');
		const { SEED_EXERCISES } = await import('./seed/exercises');
		const { SEED_PROGRAM_PLANS } = await import('./seed/programs');

		await seedExercises();
		await seedPrograms();

		expect(await db.exercises.count()).toBe(SEED_EXERCISES.length);
		expect(await db.programs.count()).toBe(SEED_PROGRAM_PLANS.length);
		expect(await db.program_sessions.count()).toBe(
			SEED_PROGRAM_PLANS.reduce((n, plan) => n + plan.sessions.length, 0)
		);
		expect(await db.program_items.count()).toBe(
			SEED_PROGRAM_PLANS.reduce((n, plan) => n + plan.items.length, 0)
		);

		// A second boot must add nothing and overwrite nothing — the same
		// insert-only property `seedDrills` relies on.
		await db.programs.update(SEED_PROGRAM_PLANS[0].program.id, { summary: 'Locally edited' });
		await seedExercises();
		await seedPrograms();

		expect(await db.programs.count()).toBe(SEED_PROGRAM_PLANS.length);
		await expect(db.programs.get(SEED_PROGRAM_PLANS[0].program.id)).resolves.toMatchObject({
			summary: 'Locally edited'
		});
	});

	it('assembles a program plan the repo can hand straight to the UI', async () => {
		const { seedExercises, seedPrograms, repo } = await import('./index');
		await seedExercises();
		await seedPrograms();

		const plan = await repo.getProgramPlanBySlug('preseason-max-strength');
		expect(plan).toBeDefined();
		expect(plan!.weeks).toHaveLength(plan!.program.weeks);
		expect(plan!.sessions.length).toBe(plan!.program.weeks * plan!.program.sessions_per_week);
		// Every item resolves to an exercise that was actually seeded.
		const { db } = await import('./db');
		const exerciseIds = new Set(await db.exercises.toCollection().primaryKeys());
		for (const item of plan!.items) {
			if (item.exercise_id) expect(exerciseIds.has(item.exercise_id)).toBe(true);
		}
	});
});

/**
 * `equipment_required` is a content field with a UI consequence: it is what the
 * "where are you?" filter and the profile's eligibility rules both read. An
 * unset one silently keeps a drill in every list, which looks like the filter is
 * broken rather than like the content is thin, so the seed library is held to
 * declaring one.
 */
describe('the bundled drill library', () => {
	it('gives every drill a valid space requirement', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const { EQUIPMENT_ACCESS } = await import('$lib/types');

		for (const drill of SEED_DRILLS) {
			expect(drill.equipment_required, `${drill.slug} declares no requirement`).toBeDefined();
			expect(
				drill.equipment_required!.length,
				`${drill.slug} declares an empty one`
			).toBeGreaterThan(0);
			for (const item of drill.equipment_required!) {
				expect(EQUIPMENT_ACCESS, `${drill.slug} requires '${item}'`).toContain(item);
			}
		}
	});

	/**
	 * A football is not a filter. A requirement every drill shares rules nothing
	 * out and only makes the "where are you?" row longer.
	 */
	it('does not put a requirement on every drill that every drill shares', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const counts = new Map<string, number>();
		for (const drill of SEED_DRILLS) {
			for (const item of drill.equipment_required ?? []) {
				counts.set(item, (counts.get(item) ?? 0) + 1);
			}
		}
		for (const [item, count] of counts) {
			expect(count, `every drill requires '${item}'`).toBeLessThan(SEED_DRILLS.length);
		}
	});
});

/**
 * The place row is single-select, so each chip has to stand on its own: a
 * player names where they are and gets everything that runs there. The
 * containment chain in `domain/equipment.ts` is what makes that work, and it
 * only works if the bundled content is authored along the same ladder.
 */
describe('the place ladder over the bundled drills', () => {
	it('widens as the place gets bigger, and never empties', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const { filterDrills, noDrillFilter, placeOptions } = await import('$lib/domain/drill-filter');

		const library = SEED_DRILLS.map((d) => ({ ...d, active: 1 as const, source: 'seed' as const }));
		const counts = placeOptions(library).map((place) => ({
			place,
			kept: filterDrills(library, { ...noDrillFilter(), place }).kept.length
		}));

		// Every chip on the row leaves the player something to do.
		for (const { place, kept } of counts) {
			expect(kept, `'${place}' leaves nothing`).toBeGreaterThan(0);
		}

		// `placeOptions` orders smallest to largest, so the counts must not fall.
		// A ladder that narrows as you name a bigger place is a content bug.
		const spaces = counts.filter(({ place }) => place !== 'wall');
		for (let i = 1; i < spaces.length; i++) {
			expect(
				spaces[i].kept,
				`'${spaces[i].place}' shows fewer than '${spaces[i - 1].place}'`
			).toBeGreaterThanOrEqual(spaces[i - 1].kept);
		}

		// Recorded so a content change that shifts the ladder shows up as a diff.
		expect(Object.fromEntries(counts.map((c) => [c.place, c.kept]))).toEqual({
			backyard: 3,
			wall: 4,
			park: 9,
			goals: 11
		});
	});
});
