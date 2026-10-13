import { describe, expect, it } from 'vitest';
import { SEED_TEST_PROTOCOLS } from '$lib/data/seed/tests';
import { LOCAL_USER_ID, type TestProtocol, type TestResult } from '$lib/types';
import {
	biggestMover,
	daysUntilDue,
	latestComparison,
	retestCycle,
	roundComparison,
	testRounds,
	testTrend,
	weakestDimension
} from './retest';
import { protocolsForAgeGroup } from './tests';

function protocol(slug: string): TestProtocol {
	const found = SEED_TEST_PROTOCOLS.find((p) => p.slug === slug);
	if (!found) throw new Error(`No seed protocol ${slug}`);
	return found;
}

const SENIOR_KICK = protocol('kicking-accuracy-senior');
const JUNIOR_KICK = protocol('kicking-accuracy-junior');
const SET_SHOTS = protocol('set-shots');
const HANDBALL = protocol('handball-accuracy');
const SPEED = protocol('handball-speed');

/** The four protocols a senior sits, in seed order. */
const SENIOR_SET = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, 'senior');

let seq = 0;

/**
 * A result on `p`, `n` hits across the first `n` slots.
 *
 * `on` is both the calendar day and the ordering key, with a counter so two
 * results on the same day keep the order they were made in.
 */
function sat(p: TestProtocol, n: number, on: string, id?: string): TestResult {
	seq += 1;
	return {
		id: id ?? `r${seq}`,
		user_id: LOCAL_USER_ID,
		protocol_id: p.id,
		protocol_slug: p.slug,
		recorded_at: `${on}T0${seq % 10}:00:00.000Z`,
		local_date: on,
		attempts:
			p.scoring === 'timed_hits'
				? []
				: p.attempts.map((spec, i) => ({
						index: spec.index,
						score: i < n ? (p.scoring === 'goal_behind_miss' ? 6 : 1) : 0
					})),
		timed_hits: p.scoring === 'timed_hits' ? n : null,
		baseline_result_id: null,
		estimated: 0,
		converted_from_result_id: null,
		notes: null,
		created_at: `${on}T00:00:00.000Z`,
		updated_at: `${on}T00:00:00.000Z`,
		synced_at: null,
		_dirty: 1,
		_deleted: 0
	};
}

/** A whole round sat on one day, every test at `n`. */
function fullRound(on: string, n: number, protocols = SENIOR_SET): TestResult[] {
	return protocols.map((p) => sat(p, n, on));
}

describe('testRounds', () => {
	it('gathers a baseline sat over several days into one round', () => {
		const results = [
			sat(SENIOR_KICK, 10, '2026-03-01'),
			sat(SET_SHOTS, 5, '2026-03-03'),
			sat(HANDBALL, 20, '2026-03-04'),
			sat(SPEED, 22, '2026-03-04')
		];
		const rounds = testRounds(SENIOR_SET, results);

		expect(rounds).toHaveLength(1);
		expect(rounds[0]).toMatchObject({
			number: 1,
			started_on: '2026-03-01',
			completed_on: '2026-03-04',
			complete: true
		});
		expect(rounds[0].missing).toEqual([]);
	});

	it('opens the next round when a test is sat a second time', () => {
		const results = [...fullRound('2026-03-01', 10), ...fullRound('2026-04-01', 14)];
		const rounds = testRounds(SENIOR_SET, results);

		expect(rounds.map((r) => r.number)).toEqual([1, 2]);
		expect(rounds[1].started_on).toBe('2026-04-01');
		expect(rounds.every((r) => r.complete)).toBe(true);
	});

	it('leaves a part-done round open and names what it is missing', () => {
		const results = [
			...fullRound('2026-03-01', 10),
			sat(SENIOR_KICK, 14, '2026-04-01'),
			sat(SET_SHOTS, 7, '2026-04-02')
		];
		const rounds = testRounds(SENIOR_SET, results);

		expect(rounds).toHaveLength(2);
		expect(rounds[1].complete).toBe(false);
		expect(rounds[1].completed_on).toBeNull();
		expect(rounds[1].missing.map((p) => p.slug)).toEqual(['handball-accuracy', 'handball-speed']);
	});

	it('starts a new round when the same test is re-sat inside an open one', () => {
		// Kicking twice in a fortnight, nothing else: two rounds of one test.
		const results = [sat(SENIOR_KICK, 10, '2026-03-01'), sat(SENIOR_KICK, 12, '2026-03-15')];
		const rounds = testRounds(SENIOR_SET, results);
		expect(rounds).toHaveLength(2);
		expect(rounds.every((r) => r.complete)).toBe(false);
	});

	it('orders by when a test was sat, not by the order it was handed over', () => {
		const first = sat(SENIOR_KICK, 10, '2026-03-01');
		const second = sat(SENIOR_KICK, 20, '2026-04-01');
		// Repo reads come back newest first.
		const rounds = testRounds(SENIOR_SET, [second, first]);
		expect(rounds[0].results[0].id).toBe(first.id);
		expect(rounds[1].results[0].id).toBe(second.id);
	});

	it('ignores deleted and estimated rows', () => {
		const results = [
			...fullRound('2026-03-01', 10),
			{ ...sat(SENIOR_KICK, 30, '2026-03-10'), _deleted: 1 as const },
			{ ...sat(SENIOR_KICK, 30, '2026-03-11'), estimated: 1 as const }
		];
		expect(testRounds(SENIOR_SET, results)).toHaveLength(1);
	});

	it('does not let a straggler reach back into a round that has closed', () => {
		// Kicking missed in April and sat on 1 May, five weeks after that round
		// opened. It belongs to a new round, not to April's — otherwise both
		// months' comparisons are built on results sat five weeks apart.
		const results = [
			sat(SET_SHOTS, 7, '2026-04-01'),
			sat(HANDBALL, 20, '2026-04-02'),
			sat(SPEED, 22, '2026-04-02'),
			sat(SENIOR_KICK, 14, '2026-05-01')
		];
		const rounds = testRounds(SENIOR_SET, results, 4);

		expect(rounds).toHaveLength(2);
		expect(rounds[0].complete).toBe(false);
		expect(rounds[0].missing.map((p) => p.slug)).toEqual(['kicking-accuracy-senior']);
		expect(rounds[1].results.map((r) => r.protocol_slug)).toEqual(['kicking-accuracy-senior']);
	});

	it('still gathers a round sat across a fortnight, inside its window', () => {
		const results = [
			sat(SENIOR_KICK, 10, '2026-03-01'),
			sat(SET_SHOTS, 5, '2026-03-08'),
			sat(HANDBALL, 20, '2026-03-14'),
			sat(SPEED, 22, '2026-03-14')
		];
		const rounds = testRounds(SENIOR_SET, results, 4);
		expect(rounds).toHaveLength(1);
		expect(rounds[0].complete).toBe(true);
	});

	it('opens a new round for a test sat a full interval after the round began', () => {
		const results = [
			sat(SENIOR_KICK, 10, '2026-03-01'),
			// Exactly 28 days later: the window has elapsed.
			sat(SET_SHOTS, 5, '2026-03-29')
		];
		expect(testRounds(SENIOR_SET, results, 4)).toHaveLength(2);
	});

	it('keeps a junior round whole after the player ages up', () => {
		// Round 1 was sat on the junior tier. They now sit the senior one, so the
		// round must not be reopened or rewritten — it happened.
		const results = [
			sat(JUNIOR_KICK, 18, '2026-03-01'),
			sat(SET_SHOTS, 5, '2026-03-01'),
			sat(HANDBALL, 20, '2026-03-01'),
			sat(SPEED, 22, '2026-03-01')
		];
		const rounds = testRounds(SENIOR_SET, results);
		expect(rounds).toHaveLength(1);
		expect(rounds[0].complete).toBe(true);
		expect(rounds[0].missing).toEqual([]);
	});

	it('starts a fresh round for the first senior-tier result, not a fifth entry', () => {
		// The senior kicking slug has never appeared before, so the repeat check
		// cannot catch it — only the round being full does.
		const results = [
			sat(JUNIOR_KICK, 18, '2026-03-01'),
			sat(SET_SHOTS, 5, '2026-03-01'),
			sat(HANDBALL, 20, '2026-03-01'),
			sat(SPEED, 22, '2026-03-01'),
			sat(SENIOR_KICK, 12, '2026-04-01')
		];
		const rounds = testRounds(SENIOR_SET, results, 4);

		expect(rounds).toHaveLength(2);
		expect(rounds[0].results).toHaveLength(4);
		expect(rounds[1].results.map((r) => r.protocol_slug)).toEqual(['kicking-accuracy-senior']);
	});

	it('has no rounds before anything is sat', () => {
		expect(testRounds(SENIOR_SET, [])).toEqual([]);
	});
});

describe('retestCycle', () => {
	it('puts a player who has sat nothing on round 1, with everything outstanding', () => {
		const cycle = retestCycle(SENIOR_SET, [], 4, '2026-03-01');
		expect(cycle.current_number).toBe(1);
		expect(cycle.outstanding).toHaveLength(4);
		expect(cycle.due).toBe(true);
		// The baseline has no due date — it is due as soon as they reach a ground.
		expect(cycle.due_on).toBeNull();
		expect(daysUntilDue(cycle, '2026-03-01')).toBeNull();
	});

	it('keeps a part-done round open inside its window', () => {
		const results = [sat(SENIOR_KICK, 10, '2026-03-01'), sat(SET_SHOTS, 5, '2026-03-02')];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-03-10');

		expect(cycle.open?.number).toBe(1);
		expect(cycle.current_number).toBe(1);
		expect(cycle.outstanding.map((p) => p.slug)).toEqual(['handball-accuracy', 'handball-speed']);
		expect(cycle.due).toBe(true);
	});

	it('comes due four weeks after the round completed', () => {
		const cycle = retestCycle(SENIOR_SET, fullRound('2026-03-01', 10), 4, '2026-03-10');
		expect(cycle.current_number).toBe(2);
		expect(cycle.due_on).toBe('2026-03-29');
		expect(cycle.due).toBe(false);
		expect(cycle.outstanding).toEqual([]);
		expect(daysUntilDue(cycle, '2026-03-10')).toBe(19);
	});

	it('is due on the day, and stays due after it', () => {
		const results = fullRound('2026-03-01', 10);
		expect(retestCycle(SENIOR_SET, results, 4, '2026-03-28').due).toBe(false);
		expect(retestCycle(SENIOR_SET, results, 4, '2026-03-29').due).toBe(true);
		expect(retestCycle(SENIOR_SET, results, 4, '2026-05-01').due).toBe(true);
		expect(daysUntilDue(retestCycle(SENIOR_SET, results, 4, '2026-04-05'), '2026-04-05')).toBe(-7);
	});

	it('counts from the last test of the round, not the first', () => {
		const results = [
			sat(SENIOR_KICK, 10, '2026-03-01'),
			sat(SET_SHOTS, 5, '2026-03-02'),
			sat(HANDBALL, 20, '2026-03-03'),
			sat(SPEED, 22, '2026-03-08')
		];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-03-10');
		expect(cycle.due_on).toBe('2026-04-05');
	});

	it('honours a shorter interval chosen on the profile', () => {
		const results = fullRound('2026-03-01', 10);
		expect(retestCycle(SENIOR_SET, results, 2, '2026-03-10').due_on).toBe('2026-03-15');
		expect(retestCycle(SENIOR_SET, results, 12, '2026-03-10').due_on).toBe('2026-05-24');
	});

	it('falls back to the default rather than dividing by a missing interval', () => {
		const results = fullRound('2026-03-01', 10);
		expect(retestCycle(SENIOR_SET, results, 0, '2026-03-10').due_on).toBe('2026-03-29');
	});

	it('closes an abandoned round once its window elapses and moves on', () => {
		// One test sat, then nothing for six weeks. The round is not held open
		// for ever: it closes incomplete and the next one comes due.
		const results = [sat(SENIOR_KICK, 10, '2026-03-01')];
		const stale = retestCycle(SENIOR_SET, results, 4, '2026-04-15');

		expect(stale.open).toBeUndefined();
		expect(stale.current_number).toBe(2);
		expect(stale.due_on).toBe('2026-03-29');
		expect(stale.due).toBe(true);
		expect(stale.outstanding).toHaveLength(4);
		// The abandoned round stays in the history as what it was.
		expect(stale.rounds).toHaveLength(1);
		expect(stale.rounds[0].complete).toBe(false);
	});

	it('reports the last complete round, skipping a part-done one', () => {
		const results = [...fullRound('2026-03-01', 10), sat(SENIOR_KICK, 14, '2026-04-01')];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-04-05');
		expect(cycle.last_complete?.number).toBe(1);
	});

	it('counts rounds over only the tests the player can reach', () => {
		// No goals and no wall: two tests, so two makes a round.
		const reachable = [SENIOR_KICK, HANDBALL];
		const cycle = retestCycle(
			reachable,
			[sat(SENIOR_KICK, 10, '2026-03-01'), sat(HANDBALL, 20, '2026-03-01')],
			4,
			'2026-03-10'
		);
		expect(cycle.rounds[0].complete).toBe(true);
		expect(cycle.current_number).toBe(2);
	});
});

describe('roundComparison', () => {
	it('measures each test against the same test last round', () => {
		const results = [...fullRound('2026-03-01', 10), ...fullRound('2026-04-01', 14)];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-04-02');
		const comparison = roundComparison(cycle.rounds[1], cycle.rounds[0], results, SENIOR_SET);

		const kicking = comparison.tests.find((c) => c.protocol.slug === SENIOR_KICK.slug)!;
		expect(kicking.score.total).toBe(14);
		expect(kicking.previous_score?.total).toBe(10);
		expect(kicking.change).toBeCloseTo(0.4);
		expect(kicking.improved).toBe(true);
	});

	it('averages the per-test changes rather than totalling the points', () => {
		// Kicking 10 → 20 (+100%), set shots 10 goals → 10 goals (level). An
		// average says +50%; summing points would be dominated by the set shots,
		// which score out of 90.
		const results = [
			sat(SENIOR_KICK, 10, '2026-03-01'),
			sat(SET_SHOTS, 10, '2026-03-01'),
			sat(SENIOR_KICK, 20, '2026-04-01'),
			sat(SET_SHOTS, 10, '2026-04-01')
		];
		const protocols = [SENIOR_KICK, SET_SHOTS];
		const cycle = retestCycle(protocols, results, 4, '2026-04-02');
		const comparison = roundComparison(cycle.rounds[1], cycle.rounds[0], results, protocols);

		expect(comparison.overall).toBeCloseTo(0.5);
		expect(comparison.improved).toBe(1);
		expect(comparison.declined).toBe(0);
	});

	it('has nothing to compare in the first round', () => {
		const results = fullRound('2026-03-01', 10);
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-03-02');
		const comparison = roundComparison(cycle.rounds[0], undefined, results, SENIOR_SET);

		expect(comparison.overall).toBeNull();
		expect(comparison.tests.every((c) => c.change === null)).toBe(true);
		expect(comparison.tests.every((c) => c.baseline_change === null)).toBe(true);
	});

	it('also measures against the very first result, not just last round', () => {
		const results = [
			...fullRound('2026-03-01', 10),
			...fullRound('2026-04-01', 12),
			...fullRound('2026-05-01', 15)
		];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-05-02');
		const comparison = roundComparison(cycle.rounds[2], cycle.rounds[1], results, SENIOR_SET);
		const kicking = comparison.tests.find((c) => c.protocol.slug === SENIOR_KICK.slug)!;

		expect(kicking.change).toBeCloseTo(0.25); // 12 → 15
		expect(kicking.baseline_change).toBeCloseTo(0.5); // 10 → 15
	});

	it('counts a decline plainly', () => {
		const results = [...fullRound('2026-03-01', 20), ...fullRound('2026-04-01', 10)];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-04-02');
		const comparison = roundComparison(cycle.rounds[1], cycle.rounds[0], results, SENIOR_SET);

		expect(comparison.overall).toBeLessThan(0);
		expect(comparison.improved).toBe(0);
		expect(comparison.declined).toBe(4);
	});

	it('bridges the junior-to-senior tier so the first senior round has a comparison', () => {
		const junior = sat(JUNIOR_KICK, 15, '2026-03-01');
		const results = [junior, sat(SENIOR_KICK, 18, '2026-04-01')];
		const protocols = [SENIOR_KICK];
		const rounds = testRounds(protocols, results);
		const comparison = roundComparison(rounds[1], rounds[0], results, [SENIOR_KICK, JUNIOR_KICK]);
		const kicking = comparison.tests[0];

		expect(kicking.previous?.estimated).toBe(1);
		expect(kicking.previous_score?.total).toBe(15);
		expect(kicking.change).toBeCloseTo(0.2);
	});

	describe('movements', () => {
		/** A kicking result with a given hit count per distance. */
		function byDistance(on: string, at: Record<number, number>): TestResult {
			const base = sat(SENIOR_KICK, 0, on);
			const used: Record<number, number> = {};
			return {
				...base,
				attempts: SENIOR_KICK.attempts.map((spec) => {
					const d = spec.distance_m!;
					used[d] = (used[d] ?? 0) + 1;
					return { index: spec.index, score: used[d] <= (at[d] ?? 0) ? 1 : 0 };
				})
			};
		}

		it('says which dimension moved and by how much', () => {
			const before = byDistance('2026-03-01', { 20: 8, 30: 4, 40: 1 });
			const after = byDistance('2026-04-01', { 20: 9, 30: 8, 40: 1 });
			const results = [before, after];
			const rounds = testRounds([SENIOR_KICK], results);
			const comparison = roundComparison(rounds[1], rounds[0], results, [SENIOR_KICK]);
			const movements = comparison.tests[0].movements;

			const thirty = movements.find((m) => m.label === '30 m')!;
			expect(thirty).toMatchObject({ previous_total: 4, total: 8, delta: 4 });
			const forty = movements.find((m) => m.label === '40 m')!;
			expect(forty.delta).toBe(0);

			// Left foot also moved +4 (3 → 7) off the same kicks, and ties go to
			// the side dimension, which is the more actionable thing to say.
			const left = movements.find((m) => m.label === 'left foot')!;
			expect(left.delta).toBe(4);
			expect(biggestMover(movements)?.label).toBe('left foot');

			// 40 m is 1 from 10 — the lowest accuracy, and the thing to train.
			expect(weakestDimension(movements)?.label).toBe('40 m');
		});

		it('names a distance when it clearly outgains both feet', () => {
			// The 40 m gain of 6 is split 5 right and 1 left, so the distance
			// out-gains either foot on its own and there is no tie to break.
			const before = byDistance('2026-03-01', { 20: 10, 30: 10, 40: 0 });
			const after = byDistance('2026-04-01', { 20: 10, 30: 10, 40: 6 });
			const results = [before, after];
			const rounds = testRounds([SENIOR_KICK], results);
			const comparison = roundComparison(rounds[1], rounds[0], results, [SENIOR_KICK]);

			expect(biggestMover(comparison.tests[0].movements)?.label).toBe('40 m');
		});

		it('leaves the deltas null in a first round, with nothing to subtract', () => {
			const only = byDistance('2026-03-01', { 20: 8, 30: 4, 40: 1 });
			const rounds = testRounds([SENIOR_KICK], [only]);
			const comparison = roundComparison(rounds[0], undefined, [only], [SENIOR_KICK]);

			expect(comparison.tests[0].movements.every((m) => m.delta === null)).toBe(true);
			expect(biggestMover(comparison.tests[0].movements)).toBeNull();
			// The gap is still readable without a previous round to compare with.
			expect(weakestDimension(comparison.tests[0].movements)?.label).toBe('40 m');
		});

		it('gives a timed test no dimensions, because it has none', () => {
			const results = [sat(SPEED, 20, '2026-03-01'), sat(SPEED, 25, '2026-04-01')];
			const rounds = testRounds([SPEED], results);
			const comparison = roundComparison(rounds[1], rounds[0], results, [SPEED]);

			expect(comparison.tests[0].movements).toEqual([]);
			expect(comparison.tests[0].change).toBeCloseTo(0.25);
		});
	});
});

describe('latestComparison', () => {
	it('compares the newest round with the one before it', () => {
		const results = [...fullRound('2026-03-01', 10), ...fullRound('2026-04-01', 14)];
		const cycle = retestCycle(SENIOR_SET, results, 4, '2026-04-02');
		const comparison = latestComparison(cycle, results, SENIOR_SET)!;

		expect(comparison.round.number).toBe(2);
		expect(comparison.previous?.number).toBe(1);
	});

	it('is null before anything has been sat', () => {
		const cycle = retestCycle(SENIOR_SET, [], 4, '2026-03-01');
		expect(latestComparison(cycle, [], SENIOR_SET)).toBeNull();
	});
});

describe('testTrend', () => {
	it('gives one point per round the test was sat in', () => {
		const results = [
			...fullRound('2026-03-01', 10),
			...fullRound('2026-04-01', 12),
			...fullRound('2026-05-01', 15)
		];
		const rounds = testRounds(SENIOR_SET, results);
		const trend = testTrend(SENIOR_KICK, rounds);

		expect(trend.map((p) => [p.round, p.total])).toEqual([
			[1, 10],
			[2, 12],
			[3, 15]
		]);
		expect(trend[0].max).toBe(30);
	});

	it('skips a round the test was missed in rather than plotting a zero', () => {
		const results = [
			...fullRound('2026-03-01', 10),
			sat(SET_SHOTS, 7, '2026-04-01'),
			sat(HANDBALL, 20, '2026-04-02'),
			sat(SPEED, 22, '2026-04-02'),
			...fullRound('2026-05-01', 15)
		];
		const rounds = testRounds(SENIOR_SET, results);
		// Kicking was not sat in round 2, so the line runs 1 → 3 with no dip.
		expect(testTrend(SENIOR_KICK, rounds).map((p) => p.round)).toEqual([1, 3]);
	});
});
