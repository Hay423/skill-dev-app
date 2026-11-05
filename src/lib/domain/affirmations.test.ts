import { describe, expect, it } from 'vitest';
import {
	affirmation,
	STREAK_MILESTONES,
	type AffirmationContext,
	type RepsEvent,
	type SessionEvent,
	type TestEvent
} from './affirmations';

function reps(overrides: Partial<RepsEvent> = {}): RepsEvent {
	return {
		kind: 'reps',
		category: 'kicking',
		attempts: 10,
		successes: 7,
		foot: null,
		...overrides
	};
}

function session(overrides: Partial<SessionEvent> = {}): SessionEvent {
	return {
		kind: 'session',
		session_name: 'Lower strength',
		session_type: 'strength',
		program_name: 'Pre-season max strength',
		week_number: 1,
		total_weeks: 8,
		is_deload: false,
		done_this_week: 1,
		sessions_this_week: 3,
		...overrides
	};
}

function ctx(overrides: Partial<AffirmationContext> = {}): AffirmationContext {
	return {
		name: 'Matt',
		streak: 2,
		is_first: false,
		today: '2026-09-16',
		event: reps(),
		...overrides
	};
}

describe('name handling', () => {
	it('addresses the player when a name is set', () => {
		const line = affirmation(ctx({ name: 'Matt' }));
		expect(line.headline).toContain('Matt');
	});

	it('reads correctly with no name at all', () => {
		const line = affirmation(ctx({ name: null }));
		expect(line.headline).not.toMatch(/,\s*$/);
		expect(line.headline).not.toContain('undefined');
		expect(line.headline).not.toContain('null');
	});

	it('reads correctly with a name that is only whitespace', () => {
		const line = affirmation(ctx({ name: '   ' }));
		expect(line.headline).not.toContain(',');
	});
});

describe('milestones take priority', () => {
	it('the first thing ever recorded always wins', () => {
		const line = affirmation(
			ctx({ is_first: true, streak: 30, event: reps({ attempts: 25, successes: 24 }) })
		);
		expect(line.milestone).toBe(true);
		expect(line.headline).toMatch(/first/i);
	});

	it('a streak milestone is called out on the day it lands', () => {
		for (const n of STREAK_MILESTONES) {
			const line = affirmation(ctx({ streak: n, is_first: false }));
			expect(line.milestone).toBe(true);
			expect(line.headline).toContain(String(n));
		}
	});

	it('a non-milestone streak length gets the routine line instead', () => {
		const line = affirmation(ctx({ streak: 5, is_first: false }));
		expect(line.milestone).toBe(false);
	});

	it('finishing the last session of the last week beats a streak milestone', () => {
		// Both are true at once; the block finishing is the bigger moment.
		const line = affirmation(
			ctx({
				streak: 7,
				event: session({ week_number: 8, total_weeks: 8, done_this_week: 3, sessions_this_week: 3 })
			})
		);
		expect(line.headline).toMatch(/block/i);
	});

	it('finishing every session of a week is a milestone short of the block ending', () => {
		const line = affirmation(
			ctx({
				streak: 4,
				event: session({ week_number: 3, total_weeks: 8, done_this_week: 2, sessions_this_week: 2 })
			})
		);
		expect(line.milestone).toBe(true);
		expect(line.headline).toMatch(/week 3/i);
	});

	it('a sharp set of meaningful volume is a milestone; a short one is not', () => {
		const sharp = affirmation(ctx({ event: reps({ attempts: 20, successes: 19 }) }));
		expect(sharp.milestone).toBe(true);

		const tooShort = affirmation(ctx({ event: reps({ attempts: 5, successes: 5 }) }));
		expect(tooShort.milestone).toBe(false);
	});
});

describe('routine lines', () => {
	it('the reps detail states the numbers without praising them', () => {
		const line = affirmation(
			ctx({ streak: 1, event: reps({ category: 'handball', attempts: 10, successes: 6 }) })
		);
		expect(line.detail).toContain('6 from 10');
		expect(line.detail).toContain('handball');
	});

	it('mentions the foot only when it is left or right', () => {
		const left = affirmation(ctx({ streak: 1, event: reps({ foot: 'left' }) }));
		expect(left.detail).toContain('left');
		const both = affirmation(ctx({ streak: 1, event: reps({ foot: 'both' }) }));
		expect(both.detail).not.toContain('both');
	});

	it('mentions the streak only once it is worth mentioning', () => {
		const one = affirmation(ctx({ streak: 1, event: reps() }));
		expect(one.detail).not.toMatch(/day/);
		const two = affirmation(ctx({ streak: 2, event: reps() }));
		expect(two.detail).toMatch(/2 days/);
	});

	it('names the deload rather than the numbers when a session is a deload', () => {
		const line = affirmation(ctx({ streak: 1, event: session({ is_deload: true }) }));
		expect(line.detail).toMatch(/deload/i);
	});

	it('is deterministic for the same day and the same work', () => {
		const a = affirmation(ctx({ streak: 4 }));
		const b = affirmation(ctx({ streak: 4 }));
		expect(a.headline).toBe(b.headline);
	});

	it('can vary between different pieces of work on the same day', () => {
		const headlines = new Set(
			Array.from(
				{ length: 10 },
				(_, i) =>
					affirmation(ctx({ streak: 4, event: reps({ attempts: 10 + i, successes: 5 }) })).headline
			)
		);
		expect(headlines.size).toBeGreaterThan(1);
	});
});

describe('skill tests', () => {
	function test(overrides: Partial<TestEvent> = {}): TestEvent {
		return {
			kind: 'test',
			test_name: 'Kicking accuracy',
			total: 19,
			max: 30,
			gain: null,
			improved: false,
			is_baseline: true,
			done_in_phase: 1,
			tests_in_phase: 4,
			round: 1,
			...overrides
		};
	}

	it('calls the first result on a test a baseline, and says what is left', () => {
		const line = affirmation(ctx({ event: test() }));
		expect(line.headline).toContain('Baseline set');
		expect(line.detail).toContain('19 from 30');
		expect(line.detail).toContain('3 tests to go');
		expect(line.milestone).toBe(true);
	});

	it('does not say "tests" when one is left', () => {
		const line = affirmation(ctx({ event: test({ done_in_phase: 3, tests_in_phase: 4 }) }));
		expect(line.detail).toContain('1 test to go');
	});

	it('marks the whole phase being finished above anything else', () => {
		const line = affirmation(
			ctx({ event: test({ done_in_phase: 4, tests_in_phase: 4, improved: true, gain: 0.5 }) })
		);
		expect(line.headline).toContain("Baseline's done");
		expect(line.milestone).toBe(true);
	});

	it('leads with the gain when a result clears the margin', () => {
		const line = affirmation(
			ctx({
				event: test({ is_baseline: false, improved: true, gain: 0.18, done_in_phase: 2 })
			})
		);
		expect(line.headline).toContain('Up 18%');
		expect(line.detail).toMatch(/new baseline/i);
		expect(line.milestone).toBe(true);
	});

	it('beats "first one in the book" to it, because a test has a number to report', () => {
		const line = affirmation(ctx({ is_first: true, event: test() }));
		expect(line.headline).toContain('Baseline set');
	});

	it('reports a result below baseline plainly rather than softening it', () => {
		const line = affirmation(
			ctx({ event: test({ is_baseline: false, gain: -0.12, done_in_phase: 2 }) })
		);
		expect(line.milestone).toBe(false);
		expect(line.detail).toContain('12% down on baseline');
	});

	it('says nothing about a percentage for a timed test with no ceiling', () => {
		const line = affirmation(
			ctx({ event: test({ test_name: 'Handball speed', total: 27, max: null }) })
		);
		expect(line.detail).toContain('27 on Handball speed');
		expect(line.detail).not.toContain('from');
	});
});

describe('finishing a round', () => {
	function test(overrides: Partial<TestEvent> = {}): TestEvent {
		return {
			kind: 'test',
			test_name: 'Kicking accuracy',
			total: 22,
			max: 30,
			gain: 0.12,
			improved: true,
			is_baseline: false,
			done_in_phase: 4,
			tests_in_phase: 4,
			round: 3,
			...overrides
		};
	}

	it('calls out the round, not the baseline, from round two on', () => {
		const line = affirmation(ctx({ event: test() }));
		expect(line.headline).toContain('Round 3 is in');
		expect(line.detail).toContain('round 2');
		expect(line.milestone).toBe(true);
	});

	it('still calls round one the baseline', () => {
		const line = affirmation(ctx({ event: test({ round: 1 }) }));
		expect(line.headline).toContain("Baseline's done");
	});

	it('says how many are left in the round mid-way through', () => {
		const line = affirmation(
			ctx({ event: test({ done_in_phase: 2, tests_in_phase: 4, improved: false, gain: 0.02 }) })
		);
		expect(line.milestone).toBe(false);
		expect(line.detail).toContain('2 more for round 3');
	});
});
