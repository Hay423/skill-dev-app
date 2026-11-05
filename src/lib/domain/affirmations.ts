import {
	SKILL_CATEGORY_LABELS,
	type Foot,
	type IsoDate,
	type ProgramSession,
	type SkillCategory
} from '$lib/types';

/**
 * What the app says to the player when they finish a piece of work.
 *
 * Pure, and contextual on purpose: the line is built from what actually just
 * happened — the streak, the accuracy, which session of which week — because
 * generic praise gets tuned out inside a week, and a line that says the same
 * thing after twenty kicks as after the hardest session of a block teaches the
 * player that the app is not really looking.
 *
 * The voice is a teammate's, not a wellness app's: short, Australian, and
 * about the work rather than the feelings. Nothing here congratulates anyone
 * for opening the app.
 */

export interface RepsEvent {
	kind: 'reps';
	category: SkillCategory;
	attempts: number;
	successes: number;
	foot: Foot | null;
}

export interface SessionEvent {
	kind: 'session';
	session_name: string;
	session_type: ProgramSession['type'];
	program_name: string;
	week_number: number;
	total_weeks: number;
	is_deload: boolean;
	/** Sessions ticked off this week including this one, and how many the week holds. */
	done_this_week: number;
	sessions_this_week: number;
}

/**
 * A sat skill test.
 *
 * Carries the derived numbers rather than the result row, so this module stays
 * free of the protocol: `domain/tests.ts` works out the score, the baseline and
 * the gain, and this one only decides what to say about them.
 */
export interface TestEvent {
	kind: 'test';
	test_name: string;
	/** Points scored. */
	total: number;
	/** The most on offer, or null for a timed test, which has no ceiling. */
	max: number | null;
	/** Relative gain over the rolling baseline; null when there is none yet. */
	gain: number | null;
	/** Cleared the 10% margin that counts as improved. */
	improved: boolean;
	/** The player's first result on this test — it sets the baseline. */
	is_baseline: boolean;
	/** Tests of the current round sat including this one, and how many it holds. */
	done_in_phase: number;
	tests_in_phase: number;
	/** Which round this result belongs to. 1 is the baseline. */
	round: number;
}

export interface AffirmationContext {
	/** The player's display name. Optional — every line has to work without it. */
	name: string | null;
	/** Days trained in a row, including today. */
	streak: number;
	/** True when this is the first thing the player has ever recorded. */
	is_first: boolean;
	today: IsoDate;
	event: RepsEvent | SessionEvent | TestEvent;
}

export interface Affirmation {
	headline: string;
	detail: string | null;
	/** A landmark rather than routine work, so the UI can mark it differently. */
	milestone: boolean;
}

/** Streak lengths worth stopping on. Beyond 100 the number speaks for itself. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Attempts below this are too few for an accuracy figure to mean anything. */
const MEANINGFUL_ATTEMPTS = 20;
const SHARP_ACCURACY = 0.9;

/**
 * Trailing address: `", Matt"` or nothing at all.
 *
 * Every line is written to read correctly with it absent, because
 * `display_name` is optional and a player who skipped it must not get "Good
 * work, ." or a line that suddenly addresses them as "mate".
 */
function addressed(name: string | null): string {
	const trimmed = name?.trim();
	return trimmed ? `, ${trimmed}` : '';
}

/**
 * Deterministic index into a list of lines.
 *
 * Seeded from the day and the work itself rather than `Math.random`, so the
 * line does not reshuffle when Svelte re-renders the card the player is
 * reading, and so the tests can assert on real output.
 */
function pick<T>(lines: T[], seed: string): T {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	}
	return lines[Math.abs(hash) % lines.length];
}

function repsSeed(ctx: AffirmationContext, event: RepsEvent): string {
	return `${ctx.today}:${event.category}:${event.attempts}:${event.successes}`;
}

function sessionSeed(ctx: AffirmationContext, event: SessionEvent): string {
	return `${ctx.today}:${event.session_name}:${event.week_number}:${event.done_this_week}`;
}

function testSeed(ctx: AffirmationContext, event: TestEvent): string {
	return `${ctx.today}:${event.test_name}:${event.total}`;
}

/** `19 from 30`, or just `27` where the test has no ceiling to measure against. */
function scoreText(event: TestEvent): string {
	return event.max === null ? `${event.total}` : `${event.total} from ${event.max}`;
}

/** `18%` — the gain as a whole number, for a line that has already checked it. */
function gainPct(gain: number): string {
	return `${Math.abs(Math.round(gain * 100))}%`;
}

/** The milestone line, when this piece of work is one, ordered biggest first. */
function milestoneFor(ctx: AffirmationContext): Affirmation | null {
	const n = addressed(ctx.name);
	const event = ctx.event;

	// Tests are checked before `is_first` on purpose. A test always has
	// something more specific to say than "you've started" — it has a number,
	// and the whole point of sitting one is to be told what the number means.
	if (event.kind === 'test') {
		if (event.done_in_phase >= event.tests_in_phase) {
			// Finishing a round is the landmark, not finishing a test: a round is
			// the snapshot, and it is only worth anything whole.
			return event.round === 1
				? {
						headline: `Baseline's done${n}.`,
						detail:
							'Every test sat. From here the app can tell you whether you are actually getting better, not just whether you turned up.',
						milestone: true
					}
				: {
						headline: `Round ${event.round} is in${n}.`,
						detail: `Every test sat again, same rules as last time. That is a straight comparison with round ${event.round - 1} — have a look at what moved.`,
						milestone: true
					};
		}
		if (event.improved && event.gain !== null) {
			return {
				headline: `Up ${gainPct(event.gain)} on your baseline${n}.`,
				detail: `${scoreText(event)} on ${event.test_name}. That clears the ten percent that counts as better — and it is your new baseline, so the next one has to clear it again.`,
				milestone: true
			};
		}
		if (event.is_baseline) {
			const left = event.tests_in_phase - event.done_in_phase;
			return {
				headline: `Baseline set${n}.`,
				detail: `${scoreText(event)} on ${event.test_name}. That is the number to beat — ${left} test${left === 1 ? '' : 's'} to go.`,
				milestone: true
			};
		}
	}

	if (ctx.is_first) {
		return {
			headline: `First one's in the book${n}.`,
			detail: 'Starting is the hard part. Come back tomorrow and it gets easier.',
			milestone: true
		};
	}

	if (event.kind === 'session') {
		const lastOfBlock =
			event.week_number >= event.total_weeks && event.done_this_week >= event.sessions_this_week;
		if (lastOfBlock) {
			return {
				headline: `That's the block done${n}.`,
				detail: `${event.program_name}, all ${event.total_weeks} weeks of it. Pick your next one when you're ready.`,
				milestone: true
			};
		}
	}

	if (STREAK_MILESTONES.includes(ctx.streak)) {
		return {
			headline: `${ctx.streak} days on the trot${n}.`,
			detail:
				ctx.streak >= 30 ? 'That is not motivation any more, that is a habit.' : 'Keep it rolling.',
			milestone: true
		};
	}

	if (event.kind === 'session' && event.done_this_week >= event.sessions_this_week) {
		return {
			headline: `Week ${event.week_number} done${n}.`,
			detail: `Every session of the week ticked off. ${event.total_weeks - event.week_number} weeks to go.`,
			milestone: true
		};
	}

	if (event.kind === 'reps' && event.attempts >= MEANINGFUL_ATTEMPTS) {
		const accuracy = event.successes / event.attempts;
		if (accuracy >= SHARP_ACCURACY) {
			return {
				headline: `${event.successes} from ${event.attempts}${n}.`,
				detail: 'That is match-day sharp. Bank it and move the target back.',
				milestone: true
			};
		}
	}

	return null;
}

const REPS_LINES: Array<(n: string) => string> = [
	(n) => `In the bank${n}.`,
	(n) => `Set logged${n}.`,
	(n) => `Good hit-out${n}.`,
	(n) => `That'll do${n}.`,
	(n) => `Reps done${n}.`
];

const TEST_LINES: Array<(n: string) => string> = [
	(n) => `Test's in${n}.`,
	(n) => `Scored and saved${n}.`,
	(n) => `That's it recorded${n}.`,
	(n) => `Honest number${n}.`
];

const SESSION_LINES: Array<(n: string) => string> = [
	(n) => `Session done${n}.`,
	(n) => `Ticked off${n}.`,
	(n) => `Good work${n}.`,
	(n) => `That's another one down${n}.`
];

/** The routine detail line: what happened, in numbers, without any praise attached. */
function repsDetail(event: RepsEvent, streak: number): string {
	const skill = SKILL_CATEGORY_LABELS[event.category].toLowerCase();
	const foot = event.foot === 'left' || event.foot === 'right' ? ` off the ${event.foot}` : '';
	const parts = [`${event.successes} from ${event.attempts} at ${skill}${foot}`];
	if (streak > 1) parts.push(`${streak} days in a row`);
	return `${parts.join(' · ')}.`;
}

function sessionDetail(event: SessionEvent): string {
	if (event.is_deload) {
		return `${event.session_name} — deload week. Taking the lighter week is the work.`;
	}
	const remaining = event.sessions_this_week - event.done_this_week;
	if (remaining > 0) {
		return `${event.done_this_week} of ${event.sessions_this_week} done this week — ${remaining} to go.`;
	}
	return `${event.session_name}, week ${event.week_number} of ${event.total_weeks}.`;
}

/**
 * What a routine test result says: the score, and where it sits against the
 * baseline.
 *
 * A result below baseline is reported plainly rather than softened. The whole
 * value of a self-scored test is that the player trusts the number, and a test
 * that only ever reads as encouraging is a test worth nothing — which is also
 * why the protocol itself tells them to score the bad kicks.
 */
function testDetail(event: TestEvent): string {
	const parts = [`${scoreText(event)} on ${event.test_name}`];
	if (event.gain === null) parts.push('no baseline to compare against yet');
	else if (Math.round(event.gain * 100) === 0) parts.push('level with your baseline');
	else if (event.gain > 0) parts.push(`${gainPct(event.gain)} up on baseline`);
	else parts.push(`${gainPct(event.gain)} down on baseline`);

	const left = event.tests_in_phase - event.done_in_phase;
	if (left > 0) {
		parts.push(event.round === 1 ? `${left} to go` : `${left} more for round ${event.round}`);
	}
	return `${parts.join(' · ')}.`;
}

/**
 * The line to show the player, given what they just finished.
 *
 * Milestones take precedence over routine lines: on the day someone hits a
 * fortnight, that is the thing worth saying.
 */
export function affirmation(ctx: AffirmationContext): Affirmation {
	const milestone = milestoneFor(ctx);
	if (milestone) return milestone;

	const n = addressed(ctx.name);
	const event = ctx.event;

	if (event.kind === 'reps') {
		return {
			headline: pick(REPS_LINES, repsSeed(ctx, event))(n),
			detail: repsDetail(event, ctx.streak),
			milestone: false
		};
	}

	if (event.kind === 'test') {
		return {
			headline: pick(TEST_LINES, testSeed(ctx, event))(n),
			detail: testDetail(event),
			milestone: false
		};
	}

	return {
		headline: pick(SESSION_LINES, sessionSeed(ctx, event))(n),
		detail: sessionDetail(event),
		milestone: false
	};
}
