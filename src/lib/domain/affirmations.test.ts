import { describe, expect, it } from 'vitest';
import {
	affirmation,
	STREAK_MILESTONES,
	type AffirmationContext,
	type RepsEvent,
	type SessionEvent
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
