import { describe, expect, it } from 'vitest';
import {
	LOCAL_USER_ID,
	type Drill,
	type IsoDate,
	type PlayerProfile,
	type ProgramEnrolment,
	type ProgramItem,
	type ProgramPlan,
	type ProgramSession,
	type ProgramSessionLog,
	type TrainingProgram,
	type Weekday
} from '$lib/types';
import {
	allItemsTicked,
	browsableRange,
	canBrowseTo,
	isProgramFinishedOn,
	isTickable,
	planWeek,
	programWeekOn,
	trainingDatesFromLogs,
	weekProgress,
	type ActiveProgram
} from './schedule';

// 2026-09-14 is a Monday; the whole suite is anchored to that week so the
// weekday of every date in it is obvious on sight.
const MON: IsoDate = '2026-09-14';
const TUE: IsoDate = '2026-09-15';
const WED: IsoDate = '2026-09-16';
const THU: IsoDate = '2026-09-17';
const FRI: IsoDate = '2026-09-18';
const SUN: IsoDate = '2026-09-20';

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'utility',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'developing',
		sessions_per_week: 3,
		available_days: [],
		equipment_access: [],
		schema_version: 3,
		created_at: '2026-09-01T00:00:00.000Z',
		updated_at: '2026-09-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

function enrolment(started_on: IsoDate, overrides: Partial<ProgramEnrolment> = {}) {
	return {
		id: `enrol-${started_on}-${overrides.program_id ?? 'p'}`,
		user_id: LOCAL_USER_ID,
		program_id: 'p',
		started_at: `${started_on}T08:00:00.000Z`,
		started_on,
		completed_at: null,
		created_at: `${started_on}T08:00:00.000Z`,
		updated_at: `${started_on}T08:00:00.000Z`,
		synced_at: null,
		_dirty: 1 as const,
		_deleted: 0 as const,
		...overrides
	} satisfies ProgramEnrolment;
}

/** A program of `weeks` weeks with `perWeek` sessions in each. */
function makePlan(
	id: string,
	discipline: TrainingProgram['discipline'],
	weeks: number,
	perWeek: number
): ProgramPlan {
	const program: TrainingProgram = {
		id,
		slug: id,
		name: id,
		discipline,
		phase: 'pre_season',
		target_positions: [],
		target_qualities: [],
		min_age_group: 'senior',
		experience: [],
		weeks,
		sessions_per_week: perWeek,
		equipment_required: [],
		summary: ''
	};
	const sessions: ProgramSession[] = [];
	const items: ProgramItem[] = [];
	for (let w = 1; w <= weeks; w++) {
		for (let d = 1; d <= perWeek; d++) {
			const sid = `${id}-w${w}-d${d}`;
			sessions.push({
				id: sid,
				program_id: id,
				week_number: w,
				day_index: d,
				name: `${id} session ${d}`,
				type: discipline === 'strength' ? 'strength' : 'running',
				duration_minutes: 45
			});
			items.push({
				id: `${sid}-i1`,
				session_id: sid,
				order: 1,
				exercise_id: 'e1',
				sets: 3,
				reps: '5',
				rpe: null,
				load_pct_1rm: null,
				rest_seconds: null,
				distance_m: null,
				work_seconds: null,
				reps_count: null,
				recovery_seconds: null,
				hr_pct_min: null,
				hr_pct_max: null,
				notes: null
			});
		}
	}
	return {
		program,
		weeks: Array.from({ length: weeks }, (_, i) => ({
			program_id: id,
			week_number: i + 1,
			focus: 'Build',
			intensity_modifier: 1,
			is_deload: false
		})),
		sessions,
		items
	};
}

function active(plan: ProgramPlan, started_on: IsoDate): ActiveProgram {
	return { enrolment: enrolment(started_on, { program_id: plan.program.id }), plan };
}

/** The weekdays a plan put sessions on, for the program named. */
function daysWithSessions(
	days: ReturnType<typeof planWeek>,
	programId?: string
): Array<Weekday | undefined> {
	return days
		.filter((d) => d.sessions.some((s) => programId === undefined || s.program.id === programId))
		.map((d) => d.weekday);
}

describe('programWeekOn', () => {
	it('counts calendar weeks from the week of enrolment', () => {
		const e = enrolment(WED);
		// Enrolling on Wednesday makes that whole calendar week week 1 — including
		// the Monday before it, which is what the week strip is drawn from.
		expect(programWeekOn(e, MON)).toBe(1);
		expect(programWeekOn(e, WED)).toBe(1);
		expect(programWeekOn(e, SUN)).toBe(1);
		expect(programWeekOn(e, '2026-09-21')).toBe(2);
		expect(programWeekOn(e, '2026-10-05')).toBe(4);
	});

	it('moves on whether or not the previous week was done', () => {
		// The point of a calendar week: missing a fortnight costs the fortnight,
		// it does not park the block at week 1 forever.
		expect(programWeekOn(enrolment(MON), '2026-09-28')).toBe(3);
	});
});

describe('isProgramFinishedOn', () => {
	const plan = makePlan('p', 'strength', 4, 2);

	it('ends the block when its last calendar week has passed', () => {
		const a = active(plan, MON);
		expect(isProgramFinishedOn(a, '2026-10-05')).toBe(false); // week 4
		expect(isProgramFinishedOn(a, '2026-10-12')).toBe(true); // week 5
	});

	it('respects an explicit completion', () => {
		const a = active(plan, MON);
		a.enrolment.completed_at = '2026-09-20T00:00:00.000Z';
		expect(isProgramFinishedOn(a, MON)).toBe(true);
	});
});

describe('isTickable', () => {
	it('allows a late tick inside the same week but not a closed one', () => {
		expect(isTickable(TUE, WED)).toBe(true); // yesterday, same week
		expect(isTickable(WED, WED)).toBe(true);
		expect(isTickable(THU, WED)).toBe(false); // not yet
		expect(isTickable('2026-09-13', WED)).toBe(false); // last week's Sunday
	});
});

describe('planWeek — placement', () => {
	it('spreads a three-session program across five available days', () => {
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: ['mon', 'tue', 'wed', 'thu', 'fri'] }),
			programs: [active(makePlan('s', 'strength', 6, 3), MON)],
			logs: []
		});
		expect(daysWithSessions(days)).toEqual(['mon', 'wed', 'fri']);
	});

	it('keeps strength and running on separate days when there is room', () => {
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: ['mon', 'tue', 'wed', 'thu', 'fri'] }),
			programs: [
				active(makePlan('s', 'strength', 6, 2), MON),
				active(makePlan('r', 'conditioning', 6, 2), MON)
			],
			logs: []
		});
		for (const day of days) {
			const disciplines = day.sessions.map((s) => s.program.discipline);
			expect(new Set(disciplines).size).toBe(disciplines.length);
			expect(day.sessions.length).toBeLessThanOrEqual(1);
		}
		expect(weekProgress(days).sessions).toBe(4);
		expect(weekProgress(days).doubledUp).toBe(0);
	});

	it('doubles up rather than dropping sessions when the days run short', () => {
		// Three strength plus two running across three available days: everything
		// the player signed up for is still there, on fewer days.
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: ['mon', 'wed', 'fri'] }),
			programs: [
				active(makePlan('s', 'strength', 6, 3), MON),
				active(makePlan('r', 'conditioning', 6, 2), MON)
			],
			logs: []
		});
		const progress = weekProgress(days);
		expect(progress.sessions).toBe(5);
		expect(progress.doubledUp).toBe(2);
		expect(daysWithSessions(days)).toEqual(['mon', 'wed', 'fri']);
	});

	it('runs before it lifts on a doubled-up day', () => {
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: ['mon'] }),
			programs: [
				active(makePlan('s', 'strength', 6, 1), MON),
				active(makePlan('r', 'conditioning', 6, 1), MON)
			],
			logs: []
		});
		const monday = days[0];
		expect(monday.sessions).toHaveLength(2);
		expect(monday.sessions.map((s) => s.program.discipline)).toEqual(['conditioning', 'strength']);
	});

	it('treats an unanswered availability question as the whole week, not none', () => {
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: [] }),
			programs: [active(makePlan('s', 'strength', 6, 2), MON)],
			logs: []
		});
		expect(days.every((d) => d.available)).toBe(true);
		expect(weekProgress(days).sessions).toBe(2);
	});

	it('schedules the right week of the block for the week being shown', () => {
		const plan = makePlan('s', 'strength', 6, 2);
		const days = planWeek({
			today: '2026-09-28', // two weeks after enrolling
			profile: profile({ available_days: ['mon', 'thu'] }),
			programs: [active(plan, MON)],
			logs: []
		});
		const scheduled = days.flatMap((d) => d.sessions);
		expect(scheduled.every((s) => s.session.week_number === 3)).toBe(true);
	});

	it('schedules nothing once the block has run out of weeks', () => {
		const days = planWeek({
			today: '2026-11-02',
			profile: profile({ available_days: ['mon'] }),
			programs: [active(makePlan('s', 'strength', 4, 2), MON)],
			logs: []
		});
		expect(weekProgress(days).sessions).toBe(0);
	});
});

describe('planWeek — progress and rest days', () => {
	const plan = makePlan('s', 'strength', 6, 2);

	function log(session_id: string, date: IsoDate, completed: boolean): ProgramSessionLog {
		return {
			id: `log-${session_id}`,
			user_id: LOCAL_USER_ID,
			enrolment_id: 'enrol',
			program_session_id: session_id,
			local_date: date,
			completed_item_ids: completed ? [`${session_id}-i1`] : [],
			completed_at: completed ? `${date}T19:00:00.000Z` : null,
			created_at: `${date}T19:00:00.000Z`,
			updated_at: `${date}T19:00:00.000Z`,
			synced_at: null,
			_dirty: 1,
			_deleted: 0
		};
	}

	it('marks a session done and counts part-done exercises', () => {
		const days = planWeek({
			today: FRI,
			profile: profile({ available_days: ['mon', 'fri'] }),
			programs: [active(plan, MON)],
			logs: [log('s-w1-d1', MON, true), log('s-w1-d2', FRI, false)]
		});
		const progress = weekProgress(days);
		expect(progress).toMatchObject({ sessions: 2, done: 1 });
		expect(days.find((d) => d.weekday === 'mon')?.sessions[0].done).toBe(true);
		expect(days.find((d) => d.weekday === 'fri')?.sessions[0].ticked).toBe(0);
	});

	it('suggests skills work on training days with no session, and nowhere else', () => {
		const drill = { id: 'd1', slug: 'd1', name: 'Wall kicks', category: 'kicking' } as Drill;
		const days = planWeek({
			today: MON,
			profile: profile({ available_days: ['mon', 'tue', 'wed'] }),
			programs: [active(makePlan('s', 'strength', 6, 1), MON)],
			logs: [],
			drills: [drill]
		});
		expect(days.find((d) => d.weekday === 'mon')?.skills).toBeNull(); // has the session
		expect(days.find((d) => d.weekday === 'tue')?.skills?.category).toBe('kicking');
		expect(days.find((d) => d.weekday === 'wed')?.skills?.category).toBe('kicking');
		// Days the player does not train stay clear.
		expect(days.find((d) => d.weekday === 'sat')?.skills).toBeNull();
	});

	it('treats logged reps as the tick for a skills day', () => {
		// The rep log is the record that the skills work happened. Inventing a
		// second one would give the app two answers to the same question.
		const days = planWeek({
			today: TUE,
			profile: profile({ available_days: ['tue'] }),
			programs: [],
			logs: [],
			repDates: [TUE]
		});
		expect(days.find((d) => d.weekday === 'tue')?.loggedReps).toBe(true);
		expect(days.find((d) => d.weekday === 'wed')?.loggedReps).toBe(false);
	});

	it('marks today and what can still be ticked', () => {
		const days = planWeek({ today: WED, profile: profile(), programs: [], logs: [] });
		expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual([WED]);
		expect(days.filter((d) => d.tickable).map((d) => d.weekday)).toEqual(['mon', 'tue', 'wed']);
	});

	it('plans a week other than this one when given an anchor', () => {
		const days = planWeek({
			today: MON,
			anchor: '2026-09-23',
			profile: profile(),
			programs: [],
			logs: []
		});
		expect(days[0].date).toBe('2026-09-21');
		expect(days.some((d) => d.isToday)).toBe(false);
	});
});

describe('trainingDatesFromLogs', () => {
	it('counts only finished sessions towards the streak', () => {
		const base = {
			user_id: LOCAL_USER_ID,
			enrolment_id: 'e',
			completed_item_ids: [],
			created_at: '',
			updated_at: '',
			synced_at: null,
			_dirty: 1 as const,
			_deleted: 0 as const
		};
		const logs: ProgramSessionLog[] = [
			{ ...base, id: '1', program_session_id: 's1', local_date: MON, completed_at: 'x' },
			{ ...base, id: '2', program_session_id: 's2', local_date: TUE, completed_at: null }
		];
		expect(trainingDatesFromLogs(logs)).toEqual([MON]);
	});
});

describe('allItemsTicked', () => {
	it('is true only when every exercise is ticked', () => {
		expect(allItemsTicked(['a', 'b'], ['a'])).toBe(false);
		expect(allItemsTicked(['a', 'b'], ['b', 'a'])).toBe(true);
		// An empty session is never "all done" — there was nothing to do.
		expect(allItemsTicked([], [])).toBe(false);
	});
});

describe('browsableRange', () => {
	it('spans from the first week of the earliest block to the last week of the longest', () => {
		const range = browsableRange([
			active(makePlan('s', 'strength', 8, 2), MON),
			active(makePlan('r', 'conditioning', 4, 2), '2026-09-21')
		]);
		// Eight weeks from the Monday of enrolment: weeks 1..8, so the last
		// browsable Monday is seven weeks on.
		expect(range).toEqual({ from: MON, to: '2026-11-02' });
	});

	it('starts at the Monday of the week the player enrolled, not the day itself', () => {
		const range = browsableRange([active(makePlan('s', 'strength', 2, 1), WED)]);
		expect(range).toEqual({ from: MON, to: '2026-09-21' });
	});

	it('is null when nothing is running, so there is nothing to page through', () => {
		expect(browsableRange([])).toBeNull();
		const finished = active(makePlan('s', 'strength', 4, 2), MON);
		finished.enrolment.completed_at = '2026-09-20T00:00:00.000Z';
		expect(browsableRange([finished])).toBeNull();
	});
});

describe('canBrowseTo', () => {
	const range = { from: MON, to: '2026-10-05' };

	it('allows any week inside the block and nothing outside it', () => {
		expect(canBrowseTo(MON, range)).toBe(true);
		expect(canBrowseTo(SUN, range)).toBe(true); // same week as the first Monday
		expect(canBrowseTo('2026-10-05', range)).toBe(true);
		expect(canBrowseTo('2026-09-07', range)).toBe(false);
		expect(canBrowseTo('2026-10-12', range)).toBe(false);
	});

	it('allows nothing at all with no range', () => {
		expect(canBrowseTo(MON, null)).toBe(false);
	});
});

describe('planWeek — masters', () => {
	it('fills fewer days with optional skills work', () => {
		const drill = { id: 'd1', slug: 'd1', name: 'Wall kicks', category: 'kicking' } as Drill;
		const days = (age_group: PlayerProfile['age_group']) =>
			planWeek({
				today: MON,
				profile: profile({ age_group, available_days: ['mon', 'tue', 'wed', 'thu', 'fri'] }),
				programs: [],
				logs: [],
				drills: [drill]
			}).filter((d) => d.skills !== null).length;

		expect(days('senior')).toBe(5);
		expect(days('masters')).toBe(2);
	});
});
