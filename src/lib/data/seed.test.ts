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
