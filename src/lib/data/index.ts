import { config } from '$lib/config';
import { db } from './db';
import { LocalRepo } from './local-repo';
import type { Repo } from './repo';
import { SEED_DRILLS } from './seed/drills';
import { SEED_EXERCISES } from './seed/exercises';
import { SEED_POSITIONS } from './seed/positions';
import { SEED_PROGRAM_PLANS } from './seed/programs';
import { SEED_TEST_PROTOCOLS } from './seed/tests';

/**
 * Build the repository the environment asks for.
 *
 * Which backend the app runs against is configuration, not code: it comes from
 * `PUBLIC_DATA_BACKEND` (see `src/lib/config.ts` and `.env.example`), so
 * pointing a build at Supabase is an env change and a rebuild, not an edit
 * here. Adding a backend means adding a case and an implementation of `Repo` —
 * nothing above the data layer moves either way.
 */
function createRepo(): Repo {
	switch (config.backend) {
		case 'local':
			return new LocalRepo();
		case 'supabase':
			// Deliberately loud rather than silently falling back to local
			// storage: a build configured for sync that quietly wrote to
			// IndexedDB would look fine until the data failed to appear
			// anywhere else. See plans/ROADMAP.md item 4.
			throw new Error(
				'PUBLIC_DATA_BACKEND=supabase is not implemented yet — SyncRepo has not landed. Use `local`.'
			);
	}
}

/**
 * The app's single storage entry point. Everything above the data layer imports
 * from here, never from `local-repo` or `db`.
 */
export const repo: Repo = createRepo();

/**
 * Add any bundled seed drills not already present in IndexedDB. Safe to call
 * on every boot.
 *
 * Deliberately insert-only: once a drill row exists, this never overwrites it,
 * so edits and hide/show state made through the admin library (`/profile/drills`)
 * survive across boots and app updates. A seed drill's copy can still be fixed
 * in `seed/drills.ts` before a player has ever opened the app, or by editing it
 * again in the admin library afterwards.
 *
 * Skips by **slug as well as id**, because a drill can arrive by two routes. A
 * drill uploaded through the admin library got a generated id, so a later
 * release that promotes the same drill to the bundled seed carries an id that
 * device has never seen — and `slug` is a unique index, so adding it would
 * throw `ConstraintError` on every boot, which `seedReferenceData` surfaces as
 * a rejected promise before the layout has rendered anything. The player's own
 * row wins: it is the one their rep logs point at, and its id must never move.
 * The cost is that such a row keeps `source: 'custom'` and whatever copy was
 * uploaded rather than the seed's, which is the right way round — a hand-made
 * edit is not something an app update should quietly overwrite.
 */
export async function seedDrills(): Promise<void> {
	const existingIds = new Set(await db.drills.toCollection().primaryKeys());
	const existingSlugs = new Set(await db.drills.orderBy('slug').keys());
	const missing = SEED_DRILLS.filter((d) => !existingIds.has(d.id) && !existingSlugs.has(d.slug));
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

/**
 * Add any bundled exercises not already present. Insert-only, keyed by id, for
 * the same reason as `seedDrills`.
 */
export async function seedExercises(): Promise<void> {
	const existing = new Set(await db.exercises.toCollection().primaryKeys());
	const missing = SEED_EXERCISES.filter((e) => !existing.has(e.id));
	if (missing.length === 0) return;
	await db.exercises.bulkAdd(missing);
}

/**
 * Add any bundled programs not already present, each with its weeks, sessions
 * and items.
 *
 * Insert-only at the granularity of the whole program: if the program row
 * exists, its subtree is left entirely alone. Going row by row would be worse,
 * not better — a half-seeded program is a session list with holes in it, and
 * an enrolment mid-block would start showing different work than it did
 * yesterday. A content change to an existing program therefore needs a new
 * program id (a new block), which is also the honest thing to give a player
 * partway through the old one.
 */
export async function seedPrograms(): Promise<void> {
	const existing = new Set(await db.programs.toCollection().primaryKeys());
	const missing = SEED_PROGRAM_PLANS.filter((plan) => !existing.has(plan.program.id));
	if (missing.length === 0) return;

	await db.transaction(
		'rw',
		[db.programs, db.program_weeks, db.program_sessions, db.program_items],
		async () => {
			await db.programs.bulkAdd(missing.map((plan) => plan.program));
			await db.program_weeks.bulkAdd(missing.flatMap((plan) => plan.weeks));
			await db.program_sessions.bulkAdd(missing.flatMap((plan) => plan.sessions));
			await db.program_items.bulkAdd(missing.flatMap((plan) => plan.items));
		}
	);
}

/**
 * Add any bundled test protocols not already present. Insert-only by id, like
 * every other seed.
 *
 * Insert-only matters more here than anywhere else, and for the opposite
 * reason. Elsewhere it protects the player's edits from an app update; here it
 * protects *results* from a protocol update. A stored result means "19 of 30
 * into a 5 m square at 20, 30 and 40 m" only because the protocol says so, so
 * overwriting a protocol in place would retroactively change what every result
 * against it claims. A protocol that has to change is a new row with a new id
 * and slug, and the old one is retired — see `seed/tests.ts`.
 */
export async function seedTestProtocols(): Promise<void> {
	const existing = new Set(await db.test_protocols.toCollection().primaryKeys());
	const missing = SEED_TEST_PROTOCOLS.filter((p) => !existing.has(p.id));
	if (missing.length === 0) return;
	await db.test_protocols.bulkAdd(missing);
}

/** Every bundled seed, for the one call the app layout makes on boot. */
export async function seedReferenceData(): Promise<void> {
	await Promise.all([
		seedDrills(),
		seedPositions(),
		seedExercises(),
		seedPrograms(),
		seedTestProtocols()
	]);
}

export type { Repo, NewRepLog, NewTestResult, DrillInput } from './repo';
