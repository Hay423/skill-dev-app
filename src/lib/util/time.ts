import type { IsoDate, IsoDateTime } from '$lib/types';

/**
 * The local calendar day for an instant, as `YYYY-MM-DD`.
 *
 * Deliberately local, not UTC: an 8pm Tuesday session in Melbourne is Tuesday's
 * training, and slicing on UTC would push it into Wednesday and break streaks.
 */
export function localDate(at: Date | IsoDateTime = new Date()): IsoDate {
	const d = typeof at === 'string' ? new Date(at) : at;
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Shift an `IsoDate` by whole days, staying in the local calendar. */
export function addDays(date: IsoDate, days: number): IsoDate {
	const [y, m, d] = date.split('-').map(Number);
	// Month is 0-indexed; Date normalises overflow across month/year boundaries.
	return localDate(new Date(y, m - 1, d + days));
}

/** Whole days from `a` to `b`, ignoring time of day. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
	const [ay, am, ad] = a.split('-').map(Number);
	const [by, bm, bd] = b.split('-').map(Number);
	// UTC arithmetic here is safe and DST-proof because both sides are midnight.
	const msPerDay = 86_400_000;
	return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export function nowIso(): IsoDateTime {
	return new Date().toISOString();
}

export function newId(): string {
	return crypto.randomUUID();
}
