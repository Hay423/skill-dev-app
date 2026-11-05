import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramItem, ProgramPlan, ProgramSession, ProgramWeek } from '$lib/types';
import {
	describePrescription,
	hasScaledPrescription,
	scaledRepsCount,
	scaledWorkSeconds,
	isLoadedSession,
	itemsForSession,
	resolveItems,
	scaledLoad,
	scaledRpe,
	sessionsForWeek,
	weekOf
} from './program-plan';

function item(overrides: Partial<ProgramItem> = {}): ProgramItem {
	return {
		id: 'item-1',
		session_id: 'session-1',
		order: 1,
		section: 'main',
		exercise_id: null,
		sets: null,
		reps: null,
		rpe: null,
		load_pct_1rm: null,
		rest_seconds: null,
		distance_m: null,
		work_seconds: null,
		reps_count: null,
		recovery_seconds: null,
		hr_pct_min: null,
		hr_pct_max: null,
		notes: null,
		...overrides
	};
}

function week(overrides: Partial<ProgramWeek> = {}): ProgramWeek {
	return {
		program_id: 'program-1',
		week_number: 1,
		focus: 'Build',
		intensity_modifier: 1,
		is_deload: false,
		...overrides
	};
}

function session(overrides: Partial<ProgramSession> = {}): ProgramSession {
	return {
		id: 'session-1',
		program_id: 'program-1',
		week_number: 1,
		day_index: 1,
		name: 'Lower strength',
		type: 'strength',
		duration_minutes: 45,
		warm_up_name: null,
		warm_up_minutes: null,
		cool_down_name: null,
		cool_down_minutes: null,
		...overrides
	};
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
	return {
		id: 'exercise-1',
		slug: 'back-squat',
		name: 'Back squat',
		movement_pattern: 'squat',
		primary_qualities: ['max_strength'],
		equipment_required: ['full_gym'],
		min_age_group: 'senior',
		contraindicated_regions: [],
		coaching_points: [],
		regression_slug: null,
		progression_slug: null,
		...overrides
	};
}

describe('scaledLoad', () => {
	it('applies the week modifier and rounds to something you can load on a bar', () => {
		expect(scaledLoad(item({ load_pct_1rm: 80 }), week({ intensity_modifier: 1.1 }))).toBe(87.5);
		expect(scaledLoad(item({ load_pct_1rm: 80 }), week({ intensity_modifier: 0.75 }))).toBe(60);
	});

	it('is null when the item prescribes no percentage at all', () => {
		// Every under-age and conditioning item, by design.
		expect(scaledLoad(item({ rpe: 7 }), week())).toBeNull();
	});

	it('leaves the load alone when the week is unknown', () => {
		expect(scaledLoad(item({ load_pct_1rm: 80 }), undefined)).toBe(80);
	});
});

describe('scaledRpe', () => {
	it('moves with the week but stays inside the usable part of the scale', () => {
		expect(scaledRpe(item({ rpe: 6 }), week({ intensity_modifier: 1.1 }))).toBe(6.5);
		// A hard week cannot push a player past the top of the scale.
		expect(scaledRpe(item({ rpe: 9.5 }), week({ intensity_modifier: 1.2 }))).toBe(10);
		// Nor can a deload drop it below the point where it means anything.
		expect(scaledRpe(item({ rpe: 6 }), week({ intensity_modifier: 0.5 }))).toBe(5);
	});
});

describe('describePrescription', () => {
	it('reads as a lift when the item carries a strength prescription', () => {
		expect(
			describePrescription(
				item({ sets: 4, reps: '5', load_pct_1rm: 80, rest_seconds: 180 }),
				week()
			)
		).toBe('4 × 5 · 80% 1RM · 3 min rest');
	});

	it('uses RPE where there is no percentage, which is every under-age program', () => {
		expect(describePrescription(item({ sets: 3, reps: '8-10', rpe: 6, rest_seconds: 90 }))).toBe(
			'3 × 8-10 · RPE 6 · 1.5 min rest'
		);
	});

	it('reads as a run when the item carries distance or time', () => {
		expect(
			describePrescription(item({ reps_count: 6, distance_m: 400, recovery_seconds: 120 }))
		).toBe('6 × 400 m · 2 min recovery');
		expect(describePrescription(item({ work_seconds: 480 }))).toBe('8 min');
		expect(
			describePrescription(
				item({ sets: 3, reps_count: 6, distance_m: 40, recovery_seconds: 24, rest_seconds: 180 })
			)
		).toBe('3 sets of 6 × 40 m · 24 s recovery · 3 min between sets');
	});
});

describe('plan slicing', () => {
	const plan: ProgramPlan = {
		program: {
			id: 'program-1',
			slug: 'p',
			name: 'P',
			discipline: 'strength',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: [],
			min_age_group: 'senior',
			experience: [],
			weeks: 2,
			sessions_per_week: 2,
			equipment_required: [],
			summary: ''
		},
		weeks: [week({ week_number: 1 }), week({ week_number: 2, is_deload: true })],
		sessions: [
			session({ id: 's1b', week_number: 1, day_index: 2 }),
			session({ id: 's1a', week_number: 1, day_index: 1 }),
			session({ id: 's2a', week_number: 2, day_index: 1 })
		],
		items: [
			item({ id: 'i2', session_id: 's1a', order: 2 }),
			item({ id: 'i1', session_id: 's1a', order: 1 }),
			item({ id: 'i3', session_id: 's1b', order: 1 })
		]
	};

	it('returns a week’s sessions in the order they are meant to be done', () => {
		expect(sessionsForWeek(plan, 1).map((s) => s.id)).toEqual(['s1a', 's1b']);
		expect(sessionsForWeek(plan, 2).map((s) => s.id)).toEqual(['s2a']);
	});

	it('returns a session’s items in prescribed order', () => {
		expect(itemsForSession(plan, 's1a').map((i) => i.id)).toEqual(['i1', 'i2']);
	});

	it('finds the week a session belongs to', () => {
		expect(weekOf(plan, 2)?.is_deload).toBe(true);
		expect(weekOf(plan, 9)).toBeUndefined();
	});
});

describe('resolveItems', () => {
	it('pairs items with their exercise and keeps running items that have none', () => {
		const squat = exercise({ id: 'e1' });
		const resolved = resolveItems(
			[item({ id: 'i1', exercise_id: 'e1' }), item({ id: 'i2', distance_m: 400 })],
			[squat]
		);
		expect(resolved.map((r) => r.exercise?.name ?? null)).toEqual(['Back squat', null]);
	});

	it('drops an item whose exercise is missing rather than rendering a blank row', () => {
		const resolved = resolveItems([item({ id: 'i1', exercise_id: 'gone' })], []);
		expect(resolved).toEqual([]);
	});
});

describe('isLoadedSession', () => {
	it('is true only when the session actually prescribes external load', () => {
		const squat = exercise({ id: 'e1', equipment_required: ['full_gym'] });
		const plank = exercise({
			id: 'e2',
			slug: 'plank',
			name: 'Plank',
			equipment_required: [],
			min_age_group: 'u11'
		});

		expect(isLoadedSession(session(), [item({ exercise_id: 'e1' })], [squat, plank])).toBe(true);
		expect(isLoadedSession(session(), [item({ exercise_id: 'e2' })], [squat, plank])).toBe(false);
		// A running session is never a loaded one, whatever it references.
		expect(
			isLoadedSession(session({ type: 'running' }), [item({ exercise_id: 'e1' })], [squat, plank])
		).toBe(false);
	});
});

describe('scaledRepsCount', () => {
	it('is how a running block progresses: more reps in a harder week', () => {
		const intervals = item({ reps_count: 6, distance_m: 400 });
		expect(scaledRepsCount(intervals, week({ intensity_modifier: 1.15 }))).toBe(7);
		expect(scaledRepsCount(intervals, week({ intensity_modifier: 0.85 }))).toBe(5);
	});

	it('never rounds a week down to nothing', () => {
		// A deload is a lighter week, not a cancelled one.
		expect(scaledRepsCount(item({ reps_count: 2 }), week({ intensity_modifier: 0.2 }))).toBe(1);
	});
});

describe('scaledWorkSeconds', () => {
	it('scales a continuous run to the nearest half minute', () => {
		// 8 minutes at 1.15 is 9:12, shown as a clean 9 minutes.
		expect(scaledWorkSeconds(item({ work_seconds: 480 }), week({ intensity_modifier: 1.15 }))).toBe(
			540
		);
	});

	it('leaves the length of a single effort alone', () => {
		// 6 seconds here is what one sprint is, not how much running there is.
		const effort = item({ work_seconds: 6, reps_count: 6, distance_m: 40 });
		expect(scaledWorkSeconds(effort, week({ intensity_modifier: 1.5 }))).toBe(6);
	});
});

describe('describePrescription — scaled by the week', () => {
	it('shows the week’s running volume, not the nominal one', () => {
		expect(
			describePrescription(
				item({ reps_count: 6, distance_m: 400, recovery_seconds: 120 }),
				week({ intensity_modifier: 0.85 })
			)
		).toBe('5 × 400 m · 2 min recovery');
	});
});

describe('hasScaledPrescription', () => {
	it('is false for a session the week cannot change', () => {
		// Sets and reps alone carry no intensity, so claiming an adjustment was
		// applied to them would be a lie in the UI.
		expect(hasScaledPrescription([item({ sets: 3, reps: '30 s hold' })])).toBe(false);
		expect(hasScaledPrescription([item({ sets: 3, reps: '5', rpe: 7 })])).toBe(true);
		expect(hasScaledPrescription([item({ reps_count: 4, distance_m: 100 })])).toBe(true);
	});
});

describe('warm-up and cool-down items', () => {
	it('are never scaled by the week, in either direction', () => {
		const jog = item({ section: 'warm_up', work_seconds: 240 });
		const buildUps = item({ section: 'warm_up', reps_count: 3, distance_m: 40 });
		for (const intensity_modifier of [0.8, 1.15]) {
			const w = week({ intensity_modifier });
			expect(scaledWorkSeconds(jog, w)).toBe(240);
			expect(scaledRepsCount(buildUps, w)).toBe(3);
			expect(describePrescription(buildUps, w)).toBe('3 × 40 m');
		}
	});

	it('are not scaled by the masters adjustment either', () => {
		const jog = item({ section: 'cool_down', work_seconds: 180 });
		expect(scaledWorkSeconds(jog, week(), 0.85)).toBe(180);
	});

	it('do not make a session claim the week adjusted it', () => {
		// The note under a session says loads include the week's change. A jog in
		// the warm-up must not be the thing that switches it on.
		expect(
			hasScaledPrescription([
				item({ section: 'warm_up', work_seconds: 240, hr_pct_min: 55, hr_pct_max: 65 }),
				item({ sets: 3, reps: '30 s hold' })
			])
		).toBe(false);
	});
});
