import { LOCAL_USER_ID, type Uuid } from '$lib/types';

/**
 * Who owns the rows this app writes.
 *
 * Every user-owned row is stamped with an owner from the moment it is created,
 * even though there is exactly one player today and no auth. Retrofitting
 * ownership onto rows that were never scoped is the expensive part of going
 * multi-user; stamping a placeholder now costs a field and makes the eventual
 * migration a rewrite of one value.
 *
 * This module is the single place that answers "who is writing?". When auth
 * lands, `setCurrentUserId` is called once from the sign-in flow and every
 * write site below the repo follows automatically.
 */
let currentUser: Uuid = LOCAL_USER_ID;

/** The owner to stamp on rows being written now. */
export function currentUserId(): Uuid {
	return currentUser;
}

/**
 * Point subsequent writes at a signed-in account.
 *
 * Does **not** reassign rows already stored — that backfill belongs to the sync
 * layer, which has to decide what to do with `_dirty` rows mid-flight. See
 * `plans/ROADMAP.md` item 4.
 */
export function setCurrentUserId(userId: Uuid): void {
	currentUser = userId;
}

/** Reset to the anonymous placeholder, on sign-out or in a test. */
export function resetCurrentUserId(): void {
	currentUser = LOCAL_USER_ID;
}
