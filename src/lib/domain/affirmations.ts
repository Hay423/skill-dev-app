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

export interface AffirmationContext {
	/** The player's display name. Optional — every line has to work without it. */
	name: string | null;
	/** Days trained in a row, including today. */
	streak: number;
	/** True when this is the first thing the player has ever recorded. */
	is_first: boolean;
	today: IsoDate;
	event: RepsEvent | SessionEvent;
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

/** The milestone line, when this piece of work is one, ordered biggest first. */
function milestoneFor(ctx: AffirmationContext): Affirmation | null {
	const n = addressed(ctx.name);
	const event = ctx.event;

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

	return {
		headline: pick(SESSION_LINES, sessionSeed(ctx, event))(n),
		detail: sessionDetail(event),
		milestone: false
	};
}
