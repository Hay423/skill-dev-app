import {
	DEFAULT_RETEST_INTERVAL_WEEKS,
	type IsoDate,
	type TestProtocol,
	type TestResult
} from '$lib/types';
import { addDays, daysBetween } from '$lib/util/time';
import {
	breakdown,
	comparableScore,
	gainOver,
	improvedOver,
	scoreResult,
	tierSeedResult,
	type BreakdownRow,
	type TestScore
} from './tests';

/**
 * The monthly retest cycle: the same tests, sat again every four weeks, so the
 * player can see what the training did.
 *
 * ## A round, not a pile of due dates
 *
 * Tests are retested **together, as a numbered round**, rather than each coming
 * round a month after it was individually last sat. The reason is comparison: a
 * round is one snapshot of a player, so Round 3 against Round 2 compares like
 * with like. Per-test due dates drift apart within weeks — you end up holding a
 * kicking test from the 3rd against a handball test from the 19th and calling
 * the difference improvement.
 *
 * ## Rounds are derived, never stored
 *
 * There is no round counter and no `test_rounds` table. A round is read off the
 * results themselves by walking them oldest-first: results accumulate into the
 * current round until it has one per test, and a second result for a test
 * already in the round opens the next one. The round number is its position in
 * that walk.
 *
 * This is the same rule the program calendar follows (`programWeekOn`), and for
 * the same reason: a stored counter is a second source of truth that disagrees
 * with the data the first time somebody misses a round, re-sits a test, or
 * deletes a mis-scored result.
 *
 * ## Missing a round costs that round
 *
 * A round left part-done stays part-done. Once its window has elapsed it closes
 * incomplete and the next round comes due — the cycle is not held open waiting.
 * Again the program calendar's rule: time moves the block on whether or not the
 * work got done, because the calendar is the one the player is actually living
 * in.
 */

export interface TestRound {
	/** 1-based position in the cycle. Round 1 is the baseline. */
	number: number;
	/** The day the first test of the round was sat. */
	started_on: IsoDate;
	/** The day the last one was, or null while the round is still part-done. */
	completed_on: IsoDate | null;
	/** Results in the round, oldest first. At most one per protocol. */
	results: TestResult[];
	/** Holds a result for every test the player sits. */
	complete: boolean;
	/**
	 * Tests with no result in this round, and empty once it is complete.
	 *
	 * Measured against the tests the player sits *now*, so it is only meaningful
	 * for the round in progress. A historical round sat under a different tier
	 * (a junior who has since aged up) is complete on its own count and reports
	 * nothing missing.
	 */
	missing: TestProtocol[];
}

/**
 * Bucket results into rounds, oldest first.
 *
 * Deliberately not filtered to the protocols the player currently sits: a
 * junior-tier result belongs to the round it was sat in, and dropping it would
 * rewrite the player's history the day they turn fifteen. Completeness is
 * counted against how many tests they sit now, which is the only count
 * available and is right in every case except the tier transition itself.
 */
export function testRounds(
	protocols: TestProtocol[],
	results: TestResult[],
	intervalWeeks: number = DEFAULT_RETEST_INTERVAL_WEEKS
): TestRound[] {
	const interval = (intervalWeeks || DEFAULT_RETEST_INTERVAL_WEEKS) * 7;
	const ordered = results
		.filter((r) => r._deleted === 0 && r.estimated === 0)
		.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

	const rounds: Array<{ number: number; results: TestResult[] }> = [];
	for (const result of ordered) {
		const current = rounds.at(-1);
		const starts =
			current === undefined ||
			// The round is full.
			//
			// Not redundant with the repeat check below, and the case that proves
			// it is the tier transition: a player's first senior kicking result is
			// a slug no previous round has ever held, so without this it would be
			// appended to a round that was already complete on four tests.
			current.results.length >= protocols.length ||
			// A second result for a test the round already holds.
			current.results.some((r) => r.protocol_slug === result.protocol_slug) ||
			// The round's window has elapsed, so it closed — incomplete — before
			// this result was sat.
			//
			// Without this, a straggler would reach back and fill a gap in a round
			// that ended weeks ago: a kicking test sat in May would quietly become
			// part of April's round, and both months' comparisons would be wrong.
			// Missing a round costs that round.
			daysBetween(current.results[0].local_date, result.local_date) >= interval;

		if (starts) rounds.push({ number: rounds.length + 1, results: [result] });
		else current.results.push(result);
	}

	return rounds.map((round) => {
		const complete = round.results.length >= protocols.length;
		const sat = new Set(round.results.map((r) => r.protocol_slug));
		return {
			number: round.number,
			started_on: round.results[0].local_date,
			completed_on: complete ? round.results[round.results.length - 1].local_date : null,
			results: round.results,
			complete,
			missing: complete ? [] : protocols.filter((p) => !sat.has(p.slug))
		};
	});
}

export interface RetestCycle {
	/** Every round so far, oldest first. */
	rounds: TestRound[];
	interval_weeks: number;
	/** The round in progress, if one is open and still inside its window. */
	open: TestRound | undefined;
	/** The round the player should be working on now. */
	current_number: number;
	/** Tests still to sit in the current round. Empty when nothing is due. */
	outstanding: TestProtocol[];
	/**
	 * The day the current round came, or comes, due. Null before the baseline
	 * has been sat — the baseline has no due date, it is due as soon as the
	 * player can get to a ground.
	 */
	due_on: IsoDate | null;
	/** There is testing to do today. */
	due: boolean;
	/** The most recent complete round, for the comparison the report is built on. */
	last_complete: TestRound | undefined;
}

/**
 * Where the player is in the cycle: which round, what is left of it, and
 * whether it is due.
 *
 * `protocols` are the ones this player actually sits — tier-correct for their
 * age group, and within reach of their equipment. Passing the full library
 * would make every round look permanently incomplete.
 */
export function retestCycle(
	protocols: TestProtocol[],
	results: TestResult[],
	intervalWeeks: number,
	today: IsoDate
): RetestCycle {
	const interval = (intervalWeeks || DEFAULT_RETEST_INTERVAL_WEEKS) * 7;
	const rounds = testRounds(protocols, results, intervalWeeks);
	const last = rounds.at(-1);
	const lastComplete = [...rounds].reverse().find((r) => r.complete);
	const base = { rounds, interval_weeks: intervalWeeks, last_complete: lastComplete };

	// Nothing sat yet: round 1 is the baseline, and it is outstanding from the
	// moment the player finishes onboarding.
	if (!last) {
		return {
			...base,
			open: undefined,
			current_number: 1,
			outstanding: protocols,
			due_on: null,
			due: true
		};
	}

	// Part-done and still inside its window: finish this one, nothing new.
	if (!last.complete && daysBetween(last.started_on, today) < interval) {
		return {
			...base,
			open: last,
			current_number: last.number,
			outstanding: last.missing,
			due_on: last.started_on,
			due: true
		};
	}

	// Either the last round finished, or it was abandoned and its window has
	// closed. Counted from completion when it completed, and from the end of its
	// window when it did not — so an abandoned round delays the next one by at
	// most the interval rather than for ever.
	const due_on = last.complete
		? addDays(last.completed_on!, interval)
		: addDays(last.started_on, interval);
	const due = daysBetween(due_on, today) >= 0;

	return {
		...base,
		open: undefined,
		current_number: last.number + 1,
		outstanding: due ? protocols : [],
		due_on,
		due
	};
}

/** Whole days until the current round comes due. Negative once it is overdue. */
export function daysUntilDue(cycle: RetestCycle, today: IsoDate): number | null {
	if (cycle.due_on === null) return null;
	return daysBetween(today, cycle.due_on);
}

/** One dimension of a test — a foot, a distance, a spot — and how it moved. */
export interface Movement {
	label: string;
	total: number;
	max: number;
	/** 0–1 this round. */
	accuracy: number | null;
	/** The same dimension last round, or null when there is nothing to compare. */
	previous_total: number | null;
	/** Change in points. Null when there is no previous round. */
	delta: number | null;
}

/** One test's result this round, against the round before and against baseline. */
export interface TestChange {
	protocol: TestProtocol;
	result: TestResult;
	score: TestScore;
	/**
	 * The same test last round. Bridged across the junior/senior tier boundary
	 * by `tierSeedResult`, so a player's first senior round still has something
	 * to be measured against — flagged `estimated` so the UI can say so.
	 */
	previous: TestResult | undefined;
	previous_score: TestScore | null;
	/** Relative change on last round. Null when there is no last round. */
	change: number | null;
	/** Cleared the 10% margin against last round. */
	improved: boolean;
	/** The player's very first result on this test. */
	baseline: TestResult | undefined;
	/** Relative change on that first result. */
	baseline_change: number | null;
	/** Per-dimension movement, in protocol order. Empty for a timed test. */
	movements: Movement[];
}

export interface RoundComparison {
	round: TestRound;
	previous: TestRound | undefined;
	tests: TestChange[];
	/**
	 * The average of the per-test relative changes, or null when nothing can be
	 * compared.
	 *
	 * An average of relative changes rather than a ratio of summed points,
	 * because the tests are on different scales: set shots score out of 90 and
	 * kicking out of 30, so summing points would let goalkicking quietly decide
	 * whether the player improved.
	 */
	overall: number | null;
	/** Tests up by the margin, and tests down at all. */
	improved: number;
	declined: number;
}

/** The dimensions of `result` that moved against `previous`. */
function movementsBetween(
	protocol: TestProtocol,
	result: TestResult,
	previous: TestResult | undefined
): Movement[] {
	const parts = breakdown(protocol, result);
	const rows = [...parts.bySide, ...parts.byDistance, ...parts.bySpot];
	if (!previous) {
		return rows.map((row) => ({ ...rowFields(row), previous_total: null, delta: null }));
	}
	const before = breakdown(protocol, previous);
	// Matched by label, which is safe because both results are against the same
	// protocol and the labels are generated from its attempt specs.
	const beforeRows = new Map(
		[...before.bySide, ...before.byDistance, ...before.bySpot].map((row) => [row.label, row])
	);
	return rows.map((row) => {
		const was = beforeRows.get(row.label);
		return {
			...rowFields(row),
			previous_total: was?.total ?? null,
			delta: was === undefined ? null : row.total - was.total
		};
	});
}

function rowFields(row: BreakdownRow) {
	return { label: row.label, total: row.total, max: row.max, accuracy: row.accuracy };
}

/**
 * Compare a round with the one before it.
 *
 * The comparison is per test and then per dimension inside it, because that is
 * where the training decision is. "Up 14% on kicking" tells the player they are
 * improving; "left foot 8/15 to 11/15, 40 m unchanged" tells them what to do on
 * Tuesday.
 */
export function roundComparison(
	round: TestRound,
	previous: TestRound | undefined,
	allResults: TestResult[],
	protocols: TestProtocol[]
): RoundComparison {
	const bySlug = new Map(protocols.map((p) => [p.slug, p]));
	const changes: TestChange[] = [];

	for (const result of round.results) {
		const protocol = bySlug.get(result.protocol_slug);
		if (!protocol) continue;

		const score = scoreResult(protocol, result);
		const before = previousFor(protocol, previous, bySlug);
		const previous_score = before ? scoreResult(protocol, before) : null;
		const change = before ? gainOver(comparableScore(protocol, before), score.total) : null;

		const baseline = firstResultFor(protocol, allResults);
		const baseline_change =
			baseline && baseline.id !== result.id
				? gainOver(comparableScore(protocol, baseline), score.total)
				: null;

		changes.push({
			protocol,
			result,
			score,
			previous: before,
			previous_score,
			change,
			improved: before ? improvedOver(comparableScore(protocol, before), score.total) : false,
			baseline,
			baseline_change,
			movements: movementsBetween(protocol, result, before)
		});
	}

	const comparable = changes.filter((c) => c.change !== null);
	return {
		round,
		previous,
		tests: changes,
		overall:
			comparable.length === 0
				? null
				: comparable.reduce((sum, c) => sum + c.change!, 0) / comparable.length,
		improved: changes.filter((c) => c.improved).length,
		declined: changes.filter((c) => c.change !== null && c.change < 0).length
	};
}

/**
 * The same test in the previous round, converting across the tier boundary
 * where one was crossed.
 *
 * A player's first senior round has no senior result to compare against, but it
 * does have a junior one — and the conversion already exists for exactly this,
 * so the trend line holds together across the one transition instead of
 * starting again from nothing.
 */
function previousFor(
	protocol: TestProtocol,
	previous: TestRound | undefined,
	bySlug: Map<string, TestProtocol>
): TestResult | undefined {
	if (!previous) return undefined;
	const direct = previous.results.find((r) => r.protocol_slug === protocol.slug);
	if (direct) return direct;

	if (!protocol.paired_slug) return undefined;
	const paired = previous.results.find((r) => r.protocol_slug === protocol.paired_slug);
	const pairedProtocol = bySlug.get(protocol.paired_slug);
	if (!paired || !pairedProtocol) return undefined;
	return tierSeedResult(paired, pairedProtocol, protocol) ?? undefined;
}

/** The player's first result on a test — the fixed point, not the rolling baseline. */
function firstResultFor(protocol: TestProtocol, results: TestResult[]): TestResult | undefined {
	return results
		.filter((r) => r._deleted === 0 && r.estimated === 0 && r.protocol_slug === protocol.slug)
		.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))[0];
}

/** The comparison for the most recent round that has anything in it. */
export function latestComparison(
	cycle: RetestCycle,
	allResults: TestResult[],
	protocols: TestProtocol[]
): RoundComparison | null {
	const round = cycle.rounds.at(-1);
	if (!round) return null;
	return roundComparison(round, cycle.rounds.at(-2), allResults, protocols);
}

export interface TrendPoint {
	round: number;
	total: number;
	/** Null for a timed test, which has no ceiling. */
	max: number | null;
	date: IsoDate;
}

/** One test's score in each round it was sat, for a sparkline. */
export function testTrend(protocol: TestProtocol, rounds: TestRound[]): TrendPoint[] {
	const points: TrendPoint[] = [];
	for (const round of rounds) {
		const result = round.results.find((r) => r.protocol_slug === protocol.slug);
		if (!result) continue;
		const score = scoreResult(protocol, result);
		points.push({
			round: round.number,
			total: score.total,
			max: score.max,
			date: result.local_date
		});
	}
	return points;
}

/**
 * The dimension that gained the most, for the headline. Null when none did.
 *
 * The dimensions overlap — the same four kicks are both "left foot, up 4" and
 * "30 m, up 4" — so ties are common and the order decides them. `movements`
 * comes side-first, which is the tie-break on purpose: the weak foot is the
 * more useful thing to tell a player, because it is the one they can take to
 * the park tomorrow.
 */
export function biggestMover(movements: Movement[]): Movement | null {
	const gained = movements.filter((m) => m.delta !== null && m.delta > 0);
	if (gained.length === 0) return null;
	return gained.reduce((best, m) => (m.delta! > best.delta! ? m : best));
}

/**
 * The weakest dimension — the gap worth training.
 *
 * Lowest accuracy, not biggest decline: a 40 m kick that has always been poor
 * is a more useful thing to point at than one that slipped from good to
 * slightly less good.
 */
export function weakestDimension(movements: Movement[]): Movement | null {
	const scored = movements.filter((m) => m.accuracy !== null);
	if (scored.length === 0) return null;
	return scored.reduce((worst, m) => (m.accuracy! < worst.accuracy! ? m : worst));
}
