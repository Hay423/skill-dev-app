import { WEEKDAYS, type IsoDate, type IsoDateTime, type Weekday } from '$lib/types';

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

/**
 * Whole years from a date of birth to a local calendar day — somebody's age on
 * that day, as anyone would count it.
 *
 * Pure string arithmetic on the two `YYYY-MM-DD` values, with no `Date` in it
 * at all, which is deliberate: age is a calendar question, and the alternative
 * of dividing a millisecond difference by 365.25 gets the day either side of a
 * birthday wrong, and gets 29 February wrong every year. A birthday counts on
 * the day it lands, so somebody born 2010-03-01 is 16 on 2026-03-01 and 15 on
 * the last day of February.
 *
 * A 29 February birthday therefore ticks over on 1 March in a common year,
 * which is the usual convention and the one that never reports an age a day
 * early.
 */
export function ageInYears(date_of_birth: IsoDate, on: IsoDate): number {
	const [by, bm, bd] = date_of_birth.split('-').map(Number);
	const [y, m, d] = on.split('-').map(Number);
	const hadBirthday = m > bm || (m === bm && d >= bd);
	return y - by - (hadBirthday ? 0 : 1);
}

/** Whole days from `a` to `b`, ignoring time of day. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
	const [ay, am, ad] = a.split('-').map(Number);
	const [by, bm, bd] = b.split('-').map(Number);
	// UTC arithmetic here is safe and DST-proof because both sides are midnight.
	const msPerDay = 86_400_000;
	return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

/**
 * The weekday a local calendar date falls on.
 *
 * `WEEKDAYS` starts at Monday and `Date.getDay()` starts at Sunday, so the
 * shift is deliberate rather than an off-by-one — a training week runs Monday
 * to Sunday, with the weekend at the end of it where the games are.
 */
export function weekdayOf(date: IsoDate): Weekday {
	const [y, m, d] = date.split('-').map(Number);
	return WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
	return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

/**
 * Whole calendar weeks from `a` to `b`, counting Monday boundaries crossed
 * rather than seven-day blocks. Sunday to Monday is one week apart; Monday to
 * the following Sunday is none.
 */
export function weeksBetween(a: IsoDate, b: IsoDate): number {
	return Math.round(daysBetween(startOfWeek(a), startOfWeek(b)) / 7);
}

/** The seven dates of the week containing `date`, Monday first. */
export function weekDates(date: IsoDate): IsoDate[] {
	const monday = startOfWeek(date);
	return WEEKDAYS.map((_, i) => addDays(monday, i));
}

export function nowIso(): IsoDateTime {
	return new Date().toISOString();
}

export function newId(): string {
	return crypto.randomUUID();
}
