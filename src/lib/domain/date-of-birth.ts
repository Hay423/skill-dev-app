import type { AgeGroup, IsoDate } from '$lib/types';
import { ageInYears } from '$lib/util/time';
import { SENIOR_OPT_IN_AGE_GROUP, SENIOR_OPT_IN_MIN_AGE_YEARS } from './senior-opt-in';

/**
 * Checking a date of birth typed during setup, and saying what it means.
 *
 * `date_of_birth` stays optional — `domain/senior-opt-in.ts` sets out why, and
 * declining it costs the player one feature rather than the app. What this
 * module adds is the other half: when a player *does* give one, a wrong date
 * must not pass quietly.
 *
 * ## Why a typo has to be caught here
 *
 * A mistyped year is the worst case this app has, because it fails in the
 * direction that looks like nothing happening. `canOptInToSeniorPrograms`
 * re-derives the age on every read, so `2026` where `2006` was meant simply
 * makes the senior opt-in never appear — no error, no empty state, nothing to
 * notice. The player concludes the feature does not exist, which is exactly
 * what happened before this prompt was added to setup at all.
 *
 * So the date is checked as it is typed and the resulting age is echoed back.
 * "You are 16" is the cheapest possible confirmation that the thing the date
 * is *for* will work, and it is the player — the only one who knows their own
 * birthday — who gets to spot the error.
 *
 * ## Why the bounds are this wide
 *
 * The plausible range deliberately rejects almost nothing a real player could
 * enter. It is a typo net, not an eligibility rule: eligibility is decided by
 * `age_group` and, for the senior blocks, by `senior-opt-in.ts`. A masters
 * player in their seventies is a real user of this app, and a nine-year-old
 * entered by a parent is a real U11. Narrow bounds here would turn a guess
 * about who plays football into a wall, so only dates that cannot describe a
 * living player are refused.
 */

/**
 * Ages outside this range are treated as a slip of the keyboard rather than a
 * player. Four is below the youngest junior band the app carries; a hundred is
 * past any plausible masters entry.
 */
export const MIN_PLAUSIBLE_AGE_YEARS = 4;
export const MAX_PLAUSIBLE_AGE_YEARS = 100;

/**
 * - `absent` — nothing entered. A valid, expected outcome, not an error.
 * - `malformed` — not a complete `YYYY-MM-DD` calendar date.
 * - `future` — a date after today.
 * - `implausible` — parses, but the age is outside the typo net.
 * - `ok` — usable.
 */
export type DateOfBirthStatus = 'absent' | 'malformed' | 'future' | 'implausible' | 'ok';

export interface DateOfBirthCheck {
	status: DateOfBirthStatus;
	/** The age the date implies, or null when it could not be read as a date. */
	age: number | null;
}

/** Calendar-correct, so 29 February is accepted only in a leap year. */
function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		return leap ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether the string is a real `YYYY-MM-DD` calendar date.
 *
 * Hand-rolled rather than handed to `new Date()`, which rolls overflow forward
 * — `new Date('2006-02-30')` is 2 March — and would accept a date the player
 * never typed.
 */
function isCalendarDate(value: string): boolean {
	const match = ISO_DATE.exec(value);
	if (!match) return false;
	const [, year, month, day] = match.map(Number);
	if (month < 1 || month > 12) return false;
	return day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Read a date of birth as typed and report what it is.
 *
 * Takes the raw string from the form, so an empty or half-finished input is a
 * status rather than a thrown error — this runs on every keystroke.
 *
 * `today` is passed in rather than read from the clock, so the result is a
 * function of its arguments and a birthday is never off by a timezone.
 */
export function checkDateOfBirth(
	input: string | null | undefined,
	today: IsoDate
): DateOfBirthCheck {
	const value = input?.trim();
	if (!value) return { status: 'absent', age: null };
	if (!isCalendarDate(value)) return { status: 'malformed', age: null };

	// Both sides are zero-padded ISO dates, so a string compare is a date
	// compare and needs no parsing.
	if (value > today) return { status: 'future', age: null };

	const age = ageInYears(value, today);
	if (age < MIN_PLAUSIBLE_AGE_YEARS || age > MAX_PLAUSIBLE_AGE_YEARS) {
		return { status: 'implausible', age };
	}
	return { status: 'ok', age };
}

/**
 * Whether setup can proceed with this check.
 *
 * `absent` passes: the field is optional, and a player who would rather not
 * give a birthday must still be able to finish. Everything else that parsed
 * wrongly blocks, because the alternative is storing a date the player did not
 * mean and silently withholding what it controls.
 */
export function dateOfBirthAccepted(check: DateOfBirthCheck): boolean {
	return check.status === 'absent' || check.status === 'ok';
}

/**
 * Whether giving a date of birth unlocks anything for this age group, which is
 * what justifies asking harder in setup instead of leaving it to the profile.
 *
 * Reads the rule from `senior-opt-in.ts` rather than restating it, so the two
 * cannot drift.
 */
export function dateOfBirthUnlocksPrograms(age_group: AgeGroup): boolean {
	return age_group === SENIOR_OPT_IN_AGE_GROUP;
}

/**
 * The line shown under the field: a correction when the date is wrong, a
 * confirmation of the age when it is right.
 *
 * Null for `absent`, because the standing prompt beside the field already says
 * why it is worth giving — repeating it as feedback would read as an error.
 */
export function describeDateOfBirth(check: DateOfBirthCheck, age_group: AgeGroup): string | null {
	switch (check.status) {
		case 'absent':
			return null;
		case 'malformed':
			return 'That is not a complete date.';
		case 'future':
			return 'That date is in the future.';
		case 'implausible':
			return `Check the year — that works out to ${check.age} years old.`;
		case 'ok': {
			const age = `You are ${check.age}.`;
			if (
				dateOfBirthUnlocksPrograms(age_group) &&
				(check.age as number) >= SENIOR_OPT_IN_MIN_AGE_YEARS
			) {
				return `${age} You can switch on the senior programs from your profile.`;
			}
			return age;
		}
	}
}
