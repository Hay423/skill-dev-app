import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDate } from './time';

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
