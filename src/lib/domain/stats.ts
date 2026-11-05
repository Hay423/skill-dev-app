import type { IsoDate, RepLog, SkillCategory } from '$lib/types';
import { addDays, daysBetween, localDate } from '$lib/util/time';

export interface Totals {
	attempts: number;
	successes: number;
	/** 0–1, or null when there were no attempts. */
	accuracy: number | null;
}

export function totals(logs: RepLog[]): Totals {
	let attempts = 0;
	let successes = 0;
	for (const log of logs) {
		attempts += log.attempts;
		successes += log.successes;
	}
	return { attempts, successes, accuracy: attempts === 0 ? null : successes / attempts };
}

/** Totals split by skill category, highest volume first. */
export function totalsByCategory(logs: RepLog[]): Array<Totals & { category: SkillCategory }> {
	const groups = new Map<SkillCategory, RepLog[]>();
	for (const log of logs) {
		const bucket = groups.get(log.category);
		if (bucket) bucket.push(log);
		else groups.set(log.category, [log]);
	}
	return [...groups.entries()]
		.map(([category, rows]) => ({ category, ...totals(rows) }))
		.sort((a, b) => b.attempts - a.attempts);
}

/**
 * Consecutive days of training up to and including today.
 *
 * Today not being logged yet does not break the streak — a streak ending
 * yesterday still counts, so the number does not read as 0 all morning. Two or
 * more clear days since the last log ends it.
 *
 * `alsoTrainedOn` carries the days a program session was ticked off. A gym or
 * running session the app itself prescribed has to count: a player who does
 * exactly what they were told and watches the streak break learns to ignore the
 * calendar. Rep logs remain the primary signal — this only ever adds days.
 */
export function currentStreak(
	logs: RepLog[],
	today: IsoDate = localDate(),
	alsoTrainedOn: IsoDate[] = []
): number {
	if (logs.length === 0 && alsoTrainedOn.length === 0) return 0;

	const days = new Set([...logs.map((l) => l.local_date), ...alsoTrainedOn]);
	const mostRecent = [...days].sort().at(-1)!;

	const gap = daysBetween(mostRecent, today);
	if (gap < 0 || gap > 1) return 0;

	let streak = 0;
	let cursor = mostRecent;
	while (days.has(cursor)) {
		streak += 1;
		cursor = addDays(cursor, -1);
	}
	return streak;
}

export interface DailyPoint {
	date: IsoDate;
	attempts: number;
	successes: number;
	accuracy: number | null;
}

/**
 * A dense day-by-day series ending at `today`, including days with no logs so
 * a chart shows the gaps rather than hiding them.
 */
export function dailySeries(
	logs: RepLog[],
	days: number,
	today: IsoDate = localDate()
): DailyPoint[] {
	const byDate = new Map<IsoDate, { attempts: number; successes: number }>();
	for (const log of logs) {
		const point = byDate.get(log.local_date) ?? { attempts: 0, successes: 0 };
		point.attempts += log.attempts;
		point.successes += log.successes;
		byDate.set(log.local_date, point);
	}

	const series: DailyPoint[] = [];
	for (let i = days - 1; i >= 0; i--) {
		const date = addDays(today, -i);
		const point = byDate.get(date);
		series.push({
			date,
			attempts: point?.attempts ?? 0,
			successes: point?.successes ?? 0,
			accuracy: point && point.attempts > 0 ? point.successes / point.attempts : null
		});
	}
	return series;
}

/**
 * Change in accuracy between the two halves of a window, as percentage points.
 * Null when either half has no attempts to compare.
 */
export function accuracyTrend(
	logs: RepLog[],
	days = 28,
	today: IsoDate = localDate()
): number | null {
	const half = Math.floor(days / 2);
	const midpoint = addDays(today, -half);

	const recent = logs.filter((l) => l.local_date > midpoint);
	const earlier = logs.filter(
		(l) => l.local_date <= midpoint && l.local_date > addDays(today, -days)
	);

	const a = totals(earlier).accuracy;
	const b = totals(recent).accuracy;
	if (a === null || b === null) return null;
	return (b - a) * 100;
}

/** Format a 0–1 accuracy as a whole percentage, or an em dash when unknown. */
export function formatAccuracy(accuracy: number | null): string {
	return accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`;
}
