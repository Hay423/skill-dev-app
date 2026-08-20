import { db } from './db';
import { LocalRepo } from './local-repo';
import type { Repo } from './repo';
import { SEED_DRILLS } from './seed/drills';

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
	await db.drills.bulkAdd(missing.map((d) => ({ ...d, active: 1 as const, source: 'seed' as const })));
}

export type { Repo, NewRepLog, DrillInput } from './repo';
