import { db } from './db';
import { LocalRepo } from './local-repo';
import type { Repo } from './repo';
import { SEED_DRILLS } from './seed/drills';
import { SEED_POSITIONS } from './seed/positions';

/**
 * The app's single storage entry point.
 *
 * When Supabase lands, this is the only line that changes: point `repo` at a
 * sync-backed implementation of `Repo`. Everything above the data layer imports
 * from here, never from `local-repo` or `db`.
 */
export const repo: Repo = new LocalRepo();

/**
 * Add any bundled seed drills not already present in IndexedDB. Safe to call
 * on every boot.
 *
 * Deliberately insert-only: once a drill row exists, this never overwrites it,
 * so edits and hide/show state made through the admin library (`/profile/drills`)
 * survive across boots and app updates. A seed drill's copy can still be fixed
 * in `seed/drills.ts` before a player has ever opened the app, or by editing it
 * again in the admin library afterwards.
 */
export async function seedDrills(): Promise<void> {
	const existingIds = new Set(await db.drills.toCollection().primaryKeys());
	const missing = SEED_DRILLS.filter((d) => !existingIds.has(d.id));
	if (missing.length === 0) return;
	await db.drills.bulkAdd(
		missing.map((d) => ({ ...d, active: 1 as const, source: 'seed' as const }))
	);
}

/**
 * Add any bundled position profiles not already present. Insert-only for the
 * same reason as `seedDrills`.
 *
 * Position weights are reference content keyed by `position`, which comes from
 * the fixed taxonomy, so these rows need no generated ids. The Phase 2 content
 * importer will emit this same shape from CSV and can replace `seed/positions.ts`
 * without any change here.
 */
export async function seedPositions(): Promise<void> {
	const existing = new Set(await db.positions.toCollection().primaryKeys());
	const missing = SEED_POSITIONS.filter((p) => !existing.has(p.position));
	if (missing.length === 0) return;
	await db.positions.bulkAdd(missing);
}

/** Every bundled seed, for the one call the app layout makes on boot. */
export async function seedReferenceData(): Promise<void> {
	await Promise.all([seedDrills(), seedPositions()]);
}

export type { Repo, NewRepLog, DrillInput } from './repo';
