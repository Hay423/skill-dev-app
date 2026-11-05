import { describe, expect, it } from 'vitest';
import {
	addDays,
	ageInYears,
	daysBetween,
	localDate,
	startOfWeek,
	weekDates,
	weekdayOf,
	weeksBetween
} from './time';

describe('localDate', () => {
	it('uses the local calendar day, not UTC', () => {
		// 8pm local on the 17th is still the 17th, even though it may be the
		// 18th in UTC depending on the machine's timezone.
		const evening = new Date(2026, 7, 17, 20, 0, 0);
		expect(localDate(evening)).toBe('2026-08-17');
	});

	it('zero-pads so dates sort lexicographically', () => {
		expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});

describe('addDays', () => {
	it('crosses month boundaries', () => {
		expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
		expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
	});

	it('crosses year boundaries', () => {
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('handles a leap day', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});
});

describe('daysBetween', () => {
	it('counts whole days forward and backward', () => {
		expect(daysBetween('2026-08-15', '2026-08-17')).toBe(2);
		expect(daysBetween('2026-08-17', '2026-08-15')).toBe(-2);
		expect(daysBetween('2026-08-17', '2026-08-17')).toBe(0);
	});

	it('is unaffected by daylight saving transitions', () => {
		// Australian DST ends in early April; the gap is still whole days.
		expect(daysBetween('2026-04-01', '2026-04-08')).toBe(7);
	});
});

describe('weekdayOf', () => {
	it('names the weekday of a local date, Monday-first', () => {
		// 2026-09-14 is a Monday.
		expect(weekdayOf('2026-09-14')).toBe('mon');
		expect(weekdayOf('2026-09-19')).toBe('sat');
		// Sunday is the end of the training week, not the start of it.
		expect(weekdayOf('2026-09-20')).toBe('sun');
	});
});

describe('startOfWeek', () => {
	it('returns the Monday of the week containing the date', () => {
		expect(startOfWeek('2026-09-14')).toBe('2026-09-14');
		expect(startOfWeek('2026-09-17')).toBe('2026-09-14');
		expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
		expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
	});

	it('crosses a month boundary', () => {
		expect(startOfWeek('2026-10-01')).toBe('2026-09-28');
	});
});

describe('weeksBetween', () => {
	it('counts Monday boundaries crossed, not seven-day blocks', () => {
		// Six days apart, but a week boundary sits between them.
		expect(weeksBetween('2026-09-20', '2026-09-21')).toBe(1);
		// Six days apart inside one week.
		expect(weeksBetween('2026-09-14', '2026-09-20')).toBe(0);
		expect(weeksBetween('2026-09-14', '2026-10-05')).toBe(3);
		expect(weeksBetween('2026-10-05', '2026-09-14')).toBe(-3);
	});
});

describe('weekDates', () => {
	it('gives the seven dates of the week, Monday first', () => {
		expect(weekDates('2026-09-17')).toEqual([
			'2026-09-14',
			'2026-09-15',
			'2026-09-16',
			'2026-09-17',
			'2026-09-18',
			'2026-09-19',
			'2026-09-20'
		]);
	});
});

describe('ageInYears', () => {
	it('counts a birthday on the day it lands', () => {
		expect(ageInYears('2010-07-01', '2026-06-30')).toBe(15);
		expect(ageInYears('2010-07-01', '2026-07-01')).toBe(16);
		expect(ageInYears('2010-07-01', '2026-07-02')).toBe(16);
	});

	it('is right either side of a month boundary', () => {
		// The case a naive year subtraction gets wrong: the month has rolled over
		// but the day has not.
		expect(ageInYears('2010-12-31', '2026-01-01')).toBe(15);
		expect(ageInYears('2010-01-01', '2026-12-31')).toBe(16);
	});

	it('ticks a 29 February birthday over on 1 March in a common year', () => {
		// Never a day early: 2027 has no 29 February, so the birthday falls on the
		// first day that is unambiguously past it.
		expect(ageInYears('2008-02-29', '2027-02-28')).toBe(18);
		expect(ageInYears('2008-02-29', '2027-03-01')).toBe(19);
		// And on the day itself in a leap year.
		expect(ageInYears('2008-02-29', '2028-02-29')).toBe(20);
	});

	it('is 0 on the day somebody is born', () => {
		expect(ageInYears('2026-08-01', '2026-08-01')).toBe(0);
	});
});
