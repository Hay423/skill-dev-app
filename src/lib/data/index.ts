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
 * Load the drill library into IndexedDB, updating copy on existing drills
 * while leaving user data untouched. Safe to call on every boot.
 */
export async function seedDrills(): Promise<void> {
	await db.drills.bulkPut(SEED_DRILLS);
}

export type { Repo, NewRepLog } from './repo';
