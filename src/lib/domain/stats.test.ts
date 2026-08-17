import { describe, expect, it } from 'vitest';
import type { RepLog, SkillCategory } from '$lib/types';
import { accuracyTrend, currentStreak, dailySeries, totals, totalsByCategory } from './stats';

let seq = 0;

function log(
	local_date: string,
	attempts: number,
	successes: number,
	category: SkillCategory = 'kicking'
): RepLog {
	seq += 1;
	return {
		id: `log-${seq}`,
		user_id: null,
		session_id: null,
		drill_id: null,
		category,
		attempts,
		successes,
		distance_m: null,
		foot: null,
		recorded_at: `${local_date}T10:00:00.000Z`,
		local_date,
		notes: null,
		created_at: `${local_date}T10:00:00.000Z`,
		updated_at: `${local_date}T10:00:00.000Z`,
		synced_at: null,
		_dirty: 1,
		_deleted: 0
	};
}

describe('totals', () => {
	it('sums attempts and successes', () => {
		expect(totals([log('2026-08-01', 10, 6), log('2026-08-02', 10, 4)])).toEqual({
			attempts: 20,
			successes: 10,
			accuracy: 0.5
		});
	});

	it('reports null accuracy rather than dividing by zero', () => {
		expect(totals([]).accuracy).toBeNull();
		expect(totals([log('2026-08-01', 0, 0)]).accuracy).toBeNull();
	});
});

describe('totalsByCategory', () => {
	it('groups by category, highest volume first', () => {
		const result = totalsByCategory([
			log('2026-08-01', 5, 3, 'handball'),
			log('2026-08-01', 20, 10, 'kicking'),
			log('2026-08-02', 10, 8, 'kicking')
		]);
		expect(result.map((r) => r.category)).toEqual(['kicking', 'handball']);
		expect(result[0]).toMatchObject({ attempts: 30, successes: 18, accuracy: 0.6 });
	});
});

describe('currentStreak', () => {
	it('counts consecutive days ending today', () => {
		const logs = [log('2026-08-15', 5, 3), log('2026-08-16', 5, 3), log('2026-08-17', 5, 3)];
		expect(currentStreak(logs, '2026-08-17')).toBe(3);
	});

	it('keeps the streak alive when today has not been logged yet', () => {
		const logs = [log('2026-08-15', 5, 3), log('2026-08-16', 5, 3)];
		expect(currentStreak(logs, '2026-08-17')).toBe(2);
	});

	it('breaks after a full day missed', () => {
		const logs = [log('2026-08-14', 5, 3), log('2026-08-15', 5, 3)];
		expect(currentStreak(logs, '2026-08-17')).toBe(0);
	});

	it('counts several logs on one day once', () => {
		const logs = [log('2026-08-17', 5, 3), log('2026-08-17', 5, 2), log('2026-08-16', 5, 4)];
		expect(currentStreak(logs, '2026-08-17')).toBe(2);
	});

	it('is zero with no logs', () => {
		expect(currentStreak([], '2026-08-17')).toBe(0);
	});

	it('spans a month boundary', () => {
		const logs = [log('2026-07-31', 5, 3), log('2026-08-01', 5, 3)];
		expect(currentStreak(logs, '2026-08-01')).toBe(2);
	});
});

describe('dailySeries', () => {
	it('returns a dense series including empty days', () => {
		const series = dailySeries([log('2026-08-17', 10, 5)], 3, '2026-08-17');
		expect(series.map((p) => p.date)).toEqual(['2026-08-15', '2026-08-16', '2026-08-17']);
		expect(series[0]).toMatchObject({ attempts: 0, accuracy: null });
		expect(series[2]).toMatchObject({ attempts: 10, successes: 5, accuracy: 0.5 });
	});
});

describe('accuracyTrend', () => {
	it('reports improvement in percentage points', () => {
		const logs = [log('2026-08-01', 10, 4), log('2026-08-15', 10, 6)];
		expect(accuracyTrend(logs, 28, '2026-08-17')).toBeCloseTo(20);
	});

	it('is null when one half has no attempts', () => {
		expect(accuracyTrend([log('2026-08-15', 10, 6)], 28, '2026-08-17')).toBeNull();
	});
});
