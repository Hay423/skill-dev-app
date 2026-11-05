import { describe, expect, it } from 'vitest';
import { AGE_GROUPS } from '$lib/types';
import {
	checkDateOfBirth,
	dateOfBirthAccepted,
	dateOfBirthUnlocksPrograms,
	describeDateOfBirth,
	MAX_PLAUSIBLE_AGE_YEARS,
	MIN_PLAUSIBLE_AGE_YEARS
} from './date-of-birth';

const TODAY = '2026-08-01';

describe('checkDateOfBirth', () => {
	it('reads a plain date and reports the age', () => {
		expect(checkDateOfBirth('2010-07-01', TODAY)).toEqual({ status: 'ok', age: 16 });
	});

	it('treats an empty or blank field as absent rather than wrong', () => {
		for (const input of ['', '   ', null, undefined]) {
			expect(checkDateOfBirth(input, TODAY)).toEqual({ status: 'absent', age: null });
		}
	});

	it('counts a birthday that has not arrived yet as the younger age', () => {
		// Turns 16 the day after TODAY.
		expect(checkDateOfBirth('2010-08-02', TODAY)).toEqual({ status: 'ok', age: 15 });
	});

	it('counts the birthday itself as the older age', () => {
		expect(checkDateOfBirth('2010-08-01', TODAY)).toEqual({ status: 'ok', age: 16 });
	});

	it('rejects a half-finished or non-ISO date', () => {
		for (const input of ['2010', '2010-07', '07/01/2010', '1 July 2010', 'yesterday']) {
			expect(checkDateOfBirth(input, TODAY).status).toBe('malformed');
		}
	});

	it('rejects a month or day outside the calendar', () => {
		for (const input of ['2010-13-01', '2010-00-01', '2010-07-32', '2010-07-00']) {
			expect(checkDateOfBirth(input, TODAY).status).toBe('malformed');
		}
	});

	it('accepts 29 February in a leap year and rejects it otherwise', () => {
		expect(checkDateOfBirth('2008-02-29', TODAY).status).toBe('ok');
		expect(checkDateOfBirth('2010-02-29', TODAY).status).toBe('malformed');
	});

	it('applies the Gregorian century rule to leap years', () => {
		// 2000 was a leap year; 1900 was not.
		expect(checkDateOfBirth('2000-02-29', TODAY).status).toBe('ok');
		expect(checkDateOfBirth('1900-02-29', TODAY).status).toBe('malformed');
	});

	it('does not roll an overflowing date forward the way `new Date` would', () => {
		// `new Date('2010-02-30')` is 2 March — accepting it would store a date
		// the player never typed.
		expect(checkDateOfBirth('2010-02-30', TODAY).status).toBe('malformed');
	});

	it('rejects a date after today', () => {
		expect(checkDateOfBirth('2026-08-02', TODAY)).toEqual({ status: 'future', age: null });
		expect(checkDateOfBirth('2030-01-01', TODAY).status).toBe('future');
	});

	it('accepts today itself as a date rather than the future, then rules it implausible', () => {
		// A newborn is not a player, but the reason is the age, not the ordering.
		expect(checkDateOfBirth(TODAY, TODAY)).toEqual({ status: 'implausible', age: 0 });
	});

	it('flags a mistyped year that lands an impossible age', () => {
		// The exact failure this module exists for: 2026 typed where 2006 was
		// meant. Before, this silently withheld the senior opt-in.
		expect(checkDateOfBirth('2026-07-01', TODAY).status).toBe('implausible');
		expect(checkDateOfBirth('1810-07-01', TODAY).status).toBe('implausible');
	});

	it('accepts the edges of the plausible range', () => {
		const youngest = `${2026 - MIN_PLAUSIBLE_AGE_YEARS}-07-01`;
		const oldest = `${2026 - MAX_PLAUSIBLE_AGE_YEARS}-07-01`;
		expect(checkDateOfBirth(youngest, TODAY)).toEqual({
			status: 'ok',
			age: MIN_PLAUSIBLE_AGE_YEARS
		});
		expect(checkDateOfBirth(oldest, TODAY)).toEqual({
			status: 'ok',
			age: MAX_PLAUSIBLE_AGE_YEARS
		});
	});

	it('rejects just outside those edges', () => {
		const tooYoung = `${2026 - MIN_PLAUSIBLE_AGE_YEARS + 1}-07-01`;
		const tooOld = `${2026 - MAX_PLAUSIBLE_AGE_YEARS - 1}-07-01`;
		expect(checkDateOfBirth(tooYoung, TODAY).status).toBe('implausible');
		expect(checkDateOfBirth(tooOld, TODAY).status).toBe('implausible');
	});

	it('keeps a masters-aged player well inside the range', () => {
		expect(checkDateOfBirth('1955-03-20', TODAY).status).toBe('ok');
	});
});

describe('dateOfBirthAccepted', () => {
	it('lets setup continue with no date at all', () => {
		expect(dateOfBirthAccepted(checkDateOfBirth('', TODAY))).toBe(true);
	});

	it('lets setup continue with a good date', () => {
		expect(dateOfBirthAccepted(checkDateOfBirth('2010-07-01', TODAY))).toBe(true);
	});

	it('blocks setup on a date that parsed wrongly', () => {
		for (const input of ['2010-07', '2030-01-01', '2026-07-01']) {
			expect(dateOfBirthAccepted(checkDateOfBirth(input, TODAY))).toBe(false);
		}
	});
});

describe('dateOfBirthUnlocksPrograms', () => {
	it('is true for U17, the one band with an opt-in behind it', () => {
		expect(dateOfBirthUnlocksPrograms('u17')).toBe(true);
	});

	it('is false for every other band', () => {
		for (const group of AGE_GROUPS.filter((g) => g !== 'u17')) {
			expect(dateOfBirthUnlocksPrograms(group)).toBe(false);
		}
	});
});

describe('describeDateOfBirth', () => {
	it('says nothing when the field is empty', () => {
		expect(describeDateOfBirth(checkDateOfBirth('', TODAY), 'u17')).toBeNull();
	});

	it('names the age back to the player', () => {
		expect(describeDateOfBirth(checkDateOfBirth('2010-07-01', TODAY), 'senior')).toBe(
			'You are 16.'
		);
	});

	it('points a sixteen year old U17 at the opt-in', () => {
		const message = describeDateOfBirth(checkDateOfBirth('2010-07-01', TODAY), 'u17');
		expect(message).toContain('You are 16.');
		expect(message).toContain('senior programs');
	});

	it('does not mention the opt-in to a U17 below the age floor', () => {
		const message = describeDateOfBirth(checkDateOfBirth('2012-07-01', TODAY), 'u17');
		expect(message).toBe('You are 14.');
	});

	it('does not mention the opt-in to a sixteen year old in another band', () => {
		expect(describeDateOfBirth(checkDateOfBirth('2010-07-01', TODAY), 'u15')).toBe('You are 16.');
	});

	it('reports the age a mistyped year implies, so the slip is visible', () => {
		expect(describeDateOfBirth(checkDateOfBirth('2026-07-01', TODAY), 'u17')).toBe(
			'Check the year — that works out to 0 years old.'
		);
	});

	it('explains a future date and an incomplete one differently', () => {
		expect(describeDateOfBirth(checkDateOfBirth('2030-01-01', TODAY), 'u17')).toBe(
			'That date is in the future.'
		);
		expect(describeDateOfBirth(checkDateOfBirth('2010-07', TODAY), 'u17')).toBe(
			'That is not a complete date.'
		);
	});
});
