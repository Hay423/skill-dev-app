import {
	WEEKDAYS,
	type Drill,
	type IsoDate,
	type PlayerProfile,
	type ProgramEnrolment,
	type ProgramPlan,
	type ProgramSession,
	type ProgramSessionLog,
	type ProgramWeek,
	type SkillCategory,
	type TestProtocol,
	type TrainingProgram,
	type Uuid,
	type Weekday
} from '$lib/types';
import { addDays, startOfWeek, weekDates, weekdayOf, weeksBetween } from '$lib/util/time';
import { maxSkillsDaysFor } from './load-policy';
import type { RetestCycle } from './retest';
import { DISCIPLINE_SESSION_ORDER, itemsForSession, sessionsForWeek, weekOf } from './program-plan';

/**
 * Turning enrolments into a week the player can actually follow: which day each
 * session lands on, what is already ticked off, and what to do with the days in
 * between.
 *
 * Pure, like the rest of `domain/` — every input is passed in, including
 * `today`, so the whole calendar is deterministic and testable.
 *
 * ## A program week is a calendar week
 *
 * There is no stored week counter. Week 1 is the calendar week the player
 * enrolled in, and every Monday moves the block on whether or not the previous
 * week's work got done. A counter would be a second source of truth, and the
 * first missed week would set it against the calendar the player is living in.
 * Missing a week costs that week; it does not stall the program.
 */

/** An enrolment paired with the program content it points at. */
export interface ActiveProgram {
	enrolment: ProgramEnrolment;
	plan: ProgramPlan;
}

/** Which week of its program an enrolment is in on a given date. 1-based; may run past the end. */
export function programWeekOn(enrolment: ProgramEnrolment, date: IsoDate): number {
	return weeksBetween(enrolment.started_on, date) + 1;
}

/**
 * Whether the block has run its course by this date.
 *
 * Time finishes a program, not effort: an eight-week block started in March is
 * over in May regardless of how many sessions were ticked.
 */
export function isProgramFinishedOn(active: ActiveProgram, date: IsoDate): boolean {
	if (active.enrolment.completed_at !== null) return true;
	return programWeekOn(active.enrolment, date) > active.plan.program.weeks;
}

export interface ScheduledSession {
	session: ProgramSession;
	program: TrainingProgram;
	enrolment_id: Uuid;
	/** The program week this session belongs to, for its focus and intensity. */
	week: ProgramWeek | undefined;
	log: ProgramSessionLog | undefined;
	done: boolean;
	/** The session's exercise items, so a day can be ticked off without opening it. */
	item_ids: Uuid[];
	/** How many of them are ticked. */
	ticked: number;
}

/** Optional skill work for a training day with no program session on it. */
export interface SkillsSuggestion {
	category: SkillCategory;
	drill: Drill | null;
}

/**
 * A retest round, placed on the day the player is being asked to sit it.
 *
 * The cycle decides *whether* a round is due (`domain/retest.ts`); this decides
 * *when in the week* — which is the difference between a four-week cadence the
 * app nags about and one it actually plans for.
 */
export interface PlannedRetest {
	round: number;
	/** Tests still to sit in the round. */
	outstanding: TestProtocol[];
	/** Tests of the round already sat, and how many it holds. */
	done: number;
	total: number;
	/** It fell due before today — this is a catch-up, not a schedule. */
	overdue: boolean;
}

export interface PlannedDay {
	date: IsoDate;
	weekday: Weekday;
	/** The player said they can train this day. */
	available: boolean;
	sessions: ScheduledSession[];
	skills: SkillsSuggestion | null;
	/** The retest round the player is asked to sit on this day, if any. */
	retest: PlannedRetest | null;
	/** Reps were logged on this day. This *is* the tick for a skills day — see `planWeek`. */
	loggedReps: boolean;
	/** Today, in the week being shown. */
	isToday: boolean;
	/** Whether a session on this day can still be ticked off. */
	tickable: boolean;
}

export interface WeekPlanInput {
	today: IsoDate;
	/** Any date in the week to plan. Defaults to `today`. */
	anchor?: IsoDate;
	profile: PlayerProfile;
	programs: ActiveProgram[];
	logs: ProgramSessionLog[];
	/** Drills, best first, for the skills suggestion on non-program days. */
	drills?: Drill[];
	/** Days reps were logged on. */
	repDates?: IsoDate[];
	/** The monthly retest cycle, so a due round gets a day of its own. */
	retests?: RetestCycle;
}

/**
 * A session can be ticked off on its own day or later in the same calendar
 * week, but not in a week that has already closed.
 *
 * Training gets logged late all the time — a session done at 9pm and ticked the
 * next morning should still count. Letting a closed week be edited is a
 * different thing entirely: it would make the history, and the streak built on
 * it, something you could write after the fact.
 */
export function isTickable(date: IsoDate, today: IsoDate): boolean {
	return date <= today && startOfWeek(date) === startOfWeek(today);
}

/**
 * Which days of this week the player said they train, as indexes into
 * Monday-first `WEEKDAYS`.
 *
 * An empty answer means "unknown", not "never" — the same rule equipment
 * follows in `recommend.ts`. A player who skipped the availability step gets
 * the whole week to work with rather than an empty plan.
 */
function availableIndexes(profile: PlayerProfile): number[] {
	const all = WEEKDAYS.map((_, i) => i);
	if (profile.available_days.length === 0) return all;
	const chosen = all.filter((i) => profile.available_days.includes(WEEKDAYS[i]));
	return chosen.length > 0 ? chosen : all;
}

/**
 * The ideal slot for the `i`th of `count` sessions across `slots` available
 * days: first and last pinned to the ends, the rest spread evenly between them.
 *
 * Three sessions across five days gives Monday, Wednesday, Friday, which is
 * what a coach would write. A single session goes to the first available day
 * rather than the middle, so it reads as a decision rather than an accident.
 */
function idealSlot(i: number, count: number, slots: number): number {
	if (count <= 1) return 0;
	return Math.round((i * (slots - 1)) / (count - 1));
}

/** The free slot nearest `ideal`, searching outward. Null when every slot is taken. */
function nearestFreeSlot(ideal: number, slots: number, taken: Set<number>): number | null {
	for (let offset = 0; offset < slots; offset++) {
		for (const candidate of offset === 0 ? [ideal] : [ideal + offset, ideal - offset]) {
			if (candidate >= 0 && candidate < slots && !taken.has(candidate)) return candidate;
		}
	}
	return null;
}

/**
 * Lays the week out: every enrolled program's sessions for this calendar week,
 * placed on the days the player actually trains, with skills work suggested on
 * the days left over.
 *
 * Placement rules, in order:
 *
 * 1. Sessions spread as evenly as the available days allow.
 * 2. Strength and running go on separate days wherever there is room for it.
 * 3. When there are more sessions than days, the extra ones double up on the
 *    days nearest where they wanted to be, rather than being dropped. A plan
 *    that silently omits training the player signed up for is worse than a
 *    heavy Tuesday it warns them about.
 *
 * The program with the most sessions is placed first, because it is the one
 * with the least freedom — placing the fussiest program first is what keeps the
 * rest from being pushed into corners.
 */
export function planWeek(input: WeekPlanInput): PlannedDay[] {
	const { today, profile, programs, logs } = input;
	const dates = weekDates(input.anchor ?? today);
	const monday = dates[0];

	const logBySession = new Map(logs.map((log) => [log.program_session_id, log]));
	const repDates = new Set(input.repDates ?? []);

	const days: PlannedDay[] = dates.map((date, i) => ({
		date,
		weekday: WEEKDAYS[i],
		available: false,
		sessions: [],
		skills: null,
		retest: null,
		loggedReps: repDates.has(date),
		isToday: date === today,
		tickable: isTickable(date, today)
	}));

	const slots = availableIndexes(profile);
	for (const slot of slots) days[slot].available = true;

	// Each program's sessions for whichever of its weeks this calendar week is.
	const queued = programs
		.map((active) => {
			const week_number = programWeekOn(active.enrolment, monday);
			if (active.enrolment.completed_at !== null) return null;
			if (week_number < 1 || week_number > active.plan.program.weeks) return null;
			const sessions = sessionsForWeek(active.plan, week_number);
			if (sessions.length === 0) return null;
			return { active, week: weekOf(active.plan, week_number), sessions };
		})
		.filter((entry) => entry !== null)
		// Most sessions first; discipline and slug only to keep the order stable.
		.sort(
			(a, b) =>
				b.sessions.length - a.sessions.length ||
				a.active.plan.program.discipline.localeCompare(b.active.plan.program.discipline) ||
				a.active.plan.program.slug.localeCompare(b.active.plan.program.slug)
		);

	const taken = new Set<number>();

	for (const entry of queued) {
		for (const [i, session] of entry.sessions.entries()) {
			const ideal = idealSlot(i, entry.sessions.length, slots.length);
			const slotIndex = nearestFreeSlot(ideal, slots.length, taken) ?? ideal;
			taken.add(slotIndex);

			const log = logBySession.get(session.id);
			const item_ids = itemsForSession(entry.active.plan, session.id).map((item) => item.id);
			const ticked = new Set(log?.completed_item_ids ?? []);
			days[slots[slotIndex]].sessions.push({
				session,
				program: entry.active.plan.program,
				enrolment_id: entry.active.enrolment.id,
				week: entry.week,
				log,
				done: log?.completed_at != null,
				item_ids,
				ticked: item_ids.filter((id) => ticked.has(id)).length
			});
		}
	}

	// On a doubled-up day, jump before you run and run before you lift: the fast
	// work is the quality work, and it is the one that suffers from being done on
	// tired legs. The order is named in `DISCIPLINE_SESSION_ORDER` rather than
	// left to how the disciplines happen to sort alphabetically.
	for (const day of days) {
		day.sessions.sort(
			(a, b) =>
				DISCIPLINE_SESSION_ORDER[a.program.discipline] -
					DISCIPLINE_SESSION_ORDER[b.program.discipline] ||
				a.session.day_index - b.session.day_index
		);
	}

	// A due retest round gets a day before skills work does, and takes a day
	// clear of program sessions wherever there is one.
	if (input.retests) placeRetest(days, slots, input.retests, today);

	// Skills work fills the training days no program landed on. Rotated through
	// the recommendations so a week reads as a variety of work rather than the
	// same drill five times.
	const drills = input.drills ?? [];
	// Masters get fewer days filled in: the reduction is about time and recovery
	// as much as load, and a week with every spare day spoken for is neither.
	const maxSkillsDays = maxSkillsDaysFor(profile);
	if (drills.length > 0) {
		let rotation = 0;
		for (const day of days) {
			if (!day.available || day.sessions.length > 0 || day.retest) continue;
			if (rotation >= maxSkillsDays) break;
			const drill = drills[rotation % drills.length];
			rotation += 1;
			day.skills = { category: drill.category, drill };
		}
	}

	return days;
}

/**
 * Put a due retest round on a day of this week.
 *
 * Rules, in order:
 *
 * 1. Never before it fell due, and never in the past. Browsing back to last
 *    week must not show a test that is due now, and browsing forward to a week
 *    the round has not reached yet must not show it early.
 * 2. A day clear of program sessions, where the week has one. A 20-minute
 *    kicking test after a heavy lower session is a worse test, not a fuller
 *    day — the number it produces is what the next month gets measured against,
 *    so it is worth a day of its own.
 * 3. Failing that, the earliest eligible day anyway. Same rule the session
 *    placer follows: a plan that silently omits what the player is being asked
 *    to do is worse than one that warns them it is a busy Tuesday.
 */
function placeRetest(
	days: PlannedDay[],
	slots: number[],
	cycle: RetestCycle,
	today: IsoDate
): void {
	if (!cycle.due || cycle.outstanding.length === 0) return;

	const notBefore = cycle.due_on && cycle.due_on > today ? cycle.due_on : today;
	if (notBefore > days[days.length - 1].date) return;

	const eligible = slots.filter((i) => days[i].date >= notBefore);
	if (eligible.length === 0) return;

	const slot = eligible.find((i) => days[i].sessions.length === 0) ?? eligible[0];
	const done = cycle.open?.results.length ?? 0;

	days[slot].retest = {
		round: cycle.current_number,
		outstanding: cycle.outstanding,
		done,
		total: done + cycle.outstanding.length,
		overdue: cycle.due_on !== null && cycle.due_on < today
	};
}

/** Everything the week strip needs to show progress at a glance. */
export interface WeekProgress {
	sessions: number;
	done: number;
	/** Days carrying more than one session, so the UI can say so plainly. */
	doubledUp: number;
}

export function weekProgress(days: PlannedDay[]): WeekProgress {
	let sessions = 0;
	let done = 0;
	let doubledUp = 0;
	for (const day of days) {
		sessions += day.sessions.length;
		done += day.sessions.filter((s) => s.done).length;
		if (day.sessions.length > 1) doubledUp += 1;
	}
	return { sessions, done, doubledUp };
}

/** The day being shown on Today, or the next one with something on it. */
export function dayOf(days: PlannedDay[], date: IsoDate): PlannedDay | undefined {
	return days.find((d) => d.date === date);
}

/**
 * Days the player trained, for the streak: any day a program session was
 * finished, alongside the rep logs the streak already counts.
 *
 * A gym session the app itself prescribed has to count. Otherwise a player does
 * exactly what they were told and watches the streak break, which teaches them
 * to ignore the calendar.
 */
export function trainingDatesFromLogs(logs: ProgramSessionLog[]): IsoDate[] {
	return logs.filter((log) => log.completed_at !== null).map((log) => log.local_date);
}

/** Whether every exercise in a session has been ticked. Drives auto-completion. */
export function allItemsTicked(itemIds: Uuid[], completed: Uuid[]): boolean {
	if (itemIds.length === 0) return false;
	const ticked = new Set(completed);
	return itemIds.every((id) => ticked.has(id));
}

export { weekdayOf };

/**
 * The span of weeks the calendar can be browsed across: the first Monday of the
 * earliest block running, to the Monday of the last week of the longest one.
 *
 * Browsing is bounded by what the player is actually enrolled in rather than
 * being open-ended. Past weeks are read-only anyway, so the limit is not about
 * safety — it is that a calendar you can page through forever, into months with
 * nothing in them, stops being a plan and becomes a date picker.
 *
 * Null when nothing is running: with no block there are no weeks to browse, and
 * the arrows have nothing to point at.
 */
export function browsableRange(programs: ActiveProgram[]): { from: IsoDate; to: IsoDate } | null {
	const spans = programs
		.filter((p) => p.enrolment.completed_at === null)
		.map((p) => {
			const from = startOfWeek(p.enrolment.started_on);
			return { from, to: addDays(from, (p.plan.program.weeks - 1) * 7) };
		});
	if (spans.length === 0) return null;
	return {
		from: spans.map((s) => s.from).sort()[0],
		to: spans
			.map((s) => s.to)
			.sort()
			.at(-1)!
	};
}

/** Whether a week can be stepped to, given the browsable range. */
export function canBrowseTo(date: IsoDate, range: { from: IsoDate; to: IsoDate } | null): boolean {
	if (!range) return false;
	const monday = startOfWeek(date);
	return monday >= range.from && monday <= range.to;
}
