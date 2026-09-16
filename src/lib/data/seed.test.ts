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
