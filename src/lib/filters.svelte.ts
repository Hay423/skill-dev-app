import { browser } from '$app/environment';
import { noDrillFilter, type DrillFilter } from '$lib/domain/drill-filter';
import { EQUIPMENT_ACCESS, type EquipmentAccess } from '$lib/types';

/**
 * The player's current drill filter, remembered on this device.
 *
 * A seam, not logic — the rules all live in `domain/drill-filter.ts` where they
 * are pure and tested. This exists so the library page and the Today
 * recommendations read the same filter instead of each keeping their own and
 * disagreeing about who is training this morning.
 *
 * **Deliberately not on `PlayerProfile`.** Everything on the profile syncs and
 * follows the player to another device; "I am alone in the backyard with ten
 * minutes" is true for the next twenty minutes and nowhere else. Storing it
 * there would also cost a Dexie version and a `schema_version` bump for a value
 * that changes more often than anything else in the app.
 *
 * `localStorage` rather than IndexedDB for the same reason: this is a UI
 * preference, it is never pushed anywhere, and reading it has to be synchronous
 * so the first render is already filtered — a list that renders unfiltered and
 * then visibly shrinks is worse than one that takes a moment.
 */

/**
 * The key carries a version because the filter's shape is part of its meaning.
 * v2 made the place single-select and gave the time budget an open-ended value;
 * a v1 payload read under those rules would silently become a different filter,
 * so the old key is abandoned rather than migrated. It costs the player one tap
 * to set again, which is the right trade for a value this cheap to re-enter.
 */
const STORAGE_KEY = 'skill-dev:drill-filter:v2';

/**
 * Reads the stored filter, discarding anything that no longer makes sense.
 *
 * Validated field by field rather than trusted, because this value outlives the
 * code that wrote it: a taxonomy change, a hand-edited devtools entry or a
 * half-written key would otherwise hide most of the library with no way for the
 * player to work out why. Anything unrecognised degrades to unset, which
 * filters nothing.
 */
function read(): DrillFilter {
	if (!browser) return noDrillFilter();
	let raw: unknown;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return noDrillFilter();
		raw = JSON.parse(stored);
	} catch {
		return noDrillFilter();
	}
	if (typeof raw !== 'object' || raw === null) return noDrillFilter();

	const value = raw as Record<string, unknown>;
	const known = new Set<string>(EQUIPMENT_ACCESS);

	return {
		players:
			typeof value.players === 'number' && Number.isInteger(value.players) && value.players >= 1
				? value.players
				: null,
		max_minutes:
			value.max_minutes === 'open'
				? 'open'
				: typeof value.max_minutes === 'number' && value.max_minutes > 0
					? value.max_minutes
					: null,
		place:
			typeof value.place === 'string' && known.has(value.place)
				? (value.place as EquipmentAccess)
				: null
	};
}

function write(filter: DrillFilter): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filter));
	} catch {
		// Private browsing, a full quota, or storage blocked outright. The filter
		// still works for this visit; it simply will not be there next time.
	}
}

let current = $state<DrillFilter>(read());

export const drillFilter = {
	get current(): DrillFilter {
		return current;
	},
	set(next: DrillFilter): void {
		// Snapshotted on the way in: callers build the next filter from `current`,
		// which is a Svelte 5 `$state` proxy, and a proxy handed to
		// `JSON.stringify` is fine but one handed to structured clone is not.
		// Taking a plain object here keeps that class of bug away from the seam.
		current = $state.snapshot(next) as DrillFilter;
		write(current);
	},
	clear(): void {
		this.set(noDrillFilter());
	}
};
