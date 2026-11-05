import {
	EQUIPMENT_ACCESS,
	EQUIPMENT_ACCESS_LABELS,
	type Drill,
	type EquipmentAccess
} from '$lib/types';
import { expandEquipmentAccess } from './equipment';
import { formatList } from './text';

/**
 * What the player has in front of them right now.
 *
 * Distinct from `PlayerProfile.equipment_access` on purpose, and the difference
 * is the whole reason this exists. The profile answers "what can you generally
 * get to?" and is stable enough to sync; this answers "who is with you and how
 * long have you got, this morning, in this park?" and changes every session. A
 * player with an oval membership standing alone in their backyard with ten
 * minutes is correctly described by both at once.
 *
 * `null` and `[]` mean unset, never "has nothing" — the same rule the profile
 * follows. A filter nobody has touched excludes nothing.
 */
export interface DrillFilter {
	/** People training, the player included. Null = unset. */
	players: number | null;
	/** How long the player has. Null = unset. */
	max_minutes: TimeBudget;
	/** Where they are. One place, not a set — see `placeOptions`. Null = unset. */
	place: EquipmentAccess | null;
}

/**
 * How long the player has: a cap in minutes, `'open'` for "plenty of time", or
 * `null` for unanswered.
 *
 * `'open'` is deliberately not the same as `null`, even though neither rules
 * anything out. "I have plenty of time" is an answer and "I have not said" is
 * not, and the summary line reads differently for each — a filter that cannot
 * tell them apart leaves the player unsure whether the row took.
 */
export type TimeBudget = number | 'open' | null;

/**
 * A fresh, empty filter.
 *
 * A factory rather than a shared constant so no two callers can end up holding
 * the same mutable object — the UI builds the next filter from this one.
 */
export function noDrillFilter(): DrillFilter {
	return { players: null, max_minutes: null, place: null };
}

/** Why the player's own filter ruled a drill out, structured so the UI can say which. */
export type DrillFilterReason =
	| { kind: 'players'; needs: number }
	| { kind: 'duration'; minutes: number }
	| { kind: 'place'; missing: EquipmentAccess[] };

/**
 * Place-flavoured labels for the handful of `EquipmentAccess` values that name
 * somewhere to stand rather than something to lift.
 *
 * One vocabulary, two renderings — the same split `drillTitle` makes for
 * `min_players`. "Oval access" is the right words for a profile question about
 * what you can get to; under "Where are you?" it is the wrong ones.
 */
const PLACE_LABELS: Partial<Record<EquipmentAccess, string>> = {
	oval: 'Oval',
	park: 'Park',
	backyard: 'Backyard',
	wall: 'Wall',
	goals: 'Goals'
};

/** How a place or piece of kit is labelled in the filter. */
export function placeLabel(item: EquipmentAccess): string {
	return PLACE_LABELS[item] ?? EQUIPMENT_ACCESS_LABELS[item];
}

/** How a headcount is labelled in the filter: what the player *has*, not what a drill *needs*. */
export function describeHeadcount(players: number): string {
	return players <= 1 ? 'Just me' : `${players} people`;
}

/** How a capped time budget is labelled in the filter. */
export function describeTimeBudget(minutes: number): string {
	return `${minutes} min or less`;
}

/**
 * How the open-ended budget is labelled: `15+ min`, where 15 is the largest cap
 * the row offers, so the chips read as one ladder rather than a list with a
 * gap at the top.
 */
export function describeOpenBudget(openFrom: number): string {
	return `${openFrom}+ min`;
}

/** How many of the three constraints are set. Drives the "Filters · 2" badge. */
export function activeFilterCount(filter: DrillFilter): number {
	return (
		(filter.players === null ? 0 : 1) +
		(filter.max_minutes === null ? 0 : 1) +
		(filter.place === null ? 0 : 1)
	);
}

/** Whether the player has set anything at all. */
export function isFilterSet(filter: DrillFilter): boolean {
	return activeFilterCount(filter) > 0;
}

/**
 * The active filter as one line: `Just me · 15+ min · park`.
 *
 * `openFrom` is the largest cap the time row offers, so an open-ended budget
 * reads the same here as it does on the chip the player tapped. Omitted — by a
 * caller with no library to hand — it falls back to plain words rather than
 * inventing a number.
 */
export function describeFilter(filter: DrillFilter, openFrom?: number): string {
	const parts: string[] = [];
	if (filter.players !== null) parts.push(describeHeadcount(filter.players));
	if (filter.max_minutes === 'open') {
		parts.push(openFrom === undefined ? 'No time limit' : describeOpenBudget(openFrom));
	} else if (filter.max_minutes !== null) {
		parts.push(describeTimeBudget(filter.max_minutes));
	}
	if (filter.place !== null) parts.push(placeLabel(filter.place).toLowerCase());
	return parts.join(' · ');
}

/**
 * Whether a drill survives the player's filter.
 *
 * Checked in a fixed order because only the first failure is ever shown, and
 * "needs 3 players" is a more useful thing to read than "takes 15 min" when
 * both are true. Headcount first: it is the constraint the player cannot work
 * around. Time last: it is the one they can.
 *
 * Structural rather than `Drill`-shaped, for the same reason `isEligible` is —
 * nothing here depends on a stored row.
 */
export function matchesFilter(
	drill: Pick<Drill, 'min_players' | 'duration_minutes' | 'equipment_required'>,
	filter: DrillFilter
): { matches: true } | { matches: false; reason: DrillFilterReason } {
	if (filter.players !== null && drill.min_players > filter.players) {
		return { matches: false, reason: { kind: 'players', needs: drill.min_players } };
	}

	const required = drill.equipment_required ?? [];
	if (filter.place !== null && required.length > 0) {
		const here = expandEquipmentAccess([filter.place]);
		const missing = required.filter((item) => !here.has(item));
		if (missing.length > 0) return { matches: false, reason: { kind: 'place', missing } };
	}

	// `'open'` rules nothing out. It is an answer, not a constraint — see `TimeBudget`.
	if (typeof filter.max_minutes === 'number' && drill.duration_minutes > filter.max_minutes) {
		return { matches: false, reason: { kind: 'duration', minutes: drill.duration_minutes } };
	}

	return { matches: true };
}

/**
 * Sentence fragment for a filtered-out drill, deliberately worded like
 * `describeExclusion` in `recommend.ts` so a list carrying both reads as one
 * list rather than two.
 */
export function describeDrillFilterReason(reason: DrillFilterReason): string {
	switch (reason.kind) {
		case 'players':
			// `needs` is always at least 2: the smallest headcount the filter offers
			// is 1, and a drill needing 1 can never fail a headcount of 1 or more.
			return `needs ${reason.needs} players`;
		case 'duration':
			return `takes ${reason.minutes} min`;
		case 'place':
			return `needs ${formatList(reason.missing.map((e) => placeLabel(e).toLowerCase()))}`;
	}
}

export interface FilteredDrills {
	kept: Drill[];
	/** Shown, not hidden — a twelve-drill library that silently empties reads as broken. */
	excluded: Array<{ drill: Drill; reason: DrillFilterReason }>;
}

/** Splits drills into what the filter keeps and what it rules out, with reasons. */
export function filterDrills(drills: Drill[], filter: DrillFilter): FilteredDrills {
	const kept: Drill[] = [];
	const excluded: FilteredDrills['excluded'] = [];
	for (const drill of drills) {
		const result = matchesFilter(drill, filter);
		if (result.matches) kept.push(drill);
		else excluded.push({ drill, reason: result.reason });
	}
	return { kept, excluded };
}

/**
 * The headcounts worth offering, derived from the library rather than
 * hard-coded — the same rule the category chips already follow. A library whose
 * biggest drill needs three people has no business offering a "5 people" chip,
 * and one that later gains a nine-a-side drill gets the option for free.
 */
export function playerOptions(drills: Array<Pick<Drill, 'min_players'>>): number[] {
	return [...new Set(drills.map((d) => d.min_players))].sort((a, b) => a - b);
}

export interface TimeOptions {
	/** Caps, ascending. Each keeps drills at or under it. */
	caps: number[];
	/**
	 * The number the open-ended chip is labelled from (`15+ min`), or null when
	 * there is no time row to show at all.
	 */
	open: number | null;
}

/**
 * The time row: a ladder of caps, topped by an open-ended one.
 *
 * The longest drill in the library never gets a cap of its own, because a cap
 * that keeps everything is indistinguishable from no cap. It gets the open
 * chip instead — which keeps everything too, and says so. The difference is
 * that the player has answered: "I have plenty of time" is a different state
 * from an untouched row, and the summary line says which.
 *
 * A library whose drills are all the same length has no row at all: one chip
 * that keeps everything and one that keeps everything is not a choice.
 */
export function timeOptions(drills: Array<Pick<Drill, 'duration_minutes'>>): TimeOptions {
	const sorted = [...new Set(drills.map((d) => d.duration_minutes))].sort((a, b) => a - b);
	const caps = sorted.slice(0, -1);
	return { caps, open: caps.at(-1) ?? null };
}

/**
 * The place row, smallest to largest, so it reads as a ladder: each chip to the
 * right of the last opens everything the one before it did and more. That order
 * is presentation, which is why it lives here rather than in the taxonomy —
 * `EQUIPMENT_ACCESS` is grouped by kind, not by size.
 *
 * Anything not named here (the gym entries) falls in behind, in taxonomy order,
 * so a drill that somehow requires one still gets a chip.
 */
const PLACE_ORDER: EquipmentAccess[] = [
	'backyard',
	'wall',
	'park',
	'oval',
	'goals',
	...EQUIPMENT_ACCESS.filter((e) => !['backyard', 'wall', 'park', 'oval', 'goals'].includes(e))
];

/**
 * The places the library actually distinguishes between.
 *
 * Exactly one is ever selected. A player is in one place at a time, and the
 * containment chain in `equipment.ts` is what makes one enough: naming the
 * goals brings the whole oval with it.
 */
export function placeOptions(drills: Array<Pick<Drill, 'equipment_required'>>): EquipmentAccess[] {
	const present = new Set(drills.flatMap((d) => d.equipment_required ?? []));
	return PLACE_ORDER.filter((item) => present.has(item));
}

/**
 * Collapses excluded drills into one row per reason, so a disclosure reads
 * "2 drills not shown — needs 3 players" rather than repeating the same
 * explanation per drill.
 *
 * Takes text rather than reasons because the two sources of exclusion — the
 * profile's eligibility rules and the player's own filter — describe themselves
 * with different functions, and should still group together when they land on
 * the same words.
 */
export function groupExcludedDrills(
	items: Array<{ drill: Drill; text: string }>
): Array<{ text: string; drills: Drill[] }> {
	const groups = new Map<string, Drill[]>();
	for (const { drill, text } of items) {
		groups.set(text, [...(groups.get(text) ?? []), drill]);
	}
	return [...groups.entries()].map(([text, drills]) => ({ text, drills }));
}
