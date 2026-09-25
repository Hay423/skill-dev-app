import { describe, expect, it } from 'vitest';
import {
	ageFor,
	bpmFor,
	describeHeartRate,
	describeMaxHrBasis,
	estimateMaxHr,
	hrPrescriptionFor,
	HR_PCT_CEILING,
	HR_PCT_FLOOR,
	HR_ZONES,
	scaleBand,
	SET_RECOVERY_PCT,
	zoneFor
} from './heart-rate';
import { SEED_EXERCISES } from '$lib/data/seed/exercises';
import { SEED_PROGRAM_PLANS } from '$lib/data/seed/programs';
import {
	LOCAL_USER_ID,
	PLAYER_PROFILE_SCHEMA_VERSION,
	SINGLETON_PROFILE_ID,
	type Exercise,
	type PlayerProfile,
	type ProgramItem,
	type ProgramWeek
} from '$lib/types';

const TODAY = '2026-09-25';

function profile(over: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: SINGLETON_PROFILE_ID,
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'inside_midfielder',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'developing',
		sessions_per_week: 3,
		available_days: ['mon', 'wed', 'fri'],
		equipment_access: [],
		schema_version: PLAYER_PROFILE_SCHEMA_VERSION,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 0,
		_deleted: 0,
		...over
	};
}

function item(over: Partial<ProgramItem> = {}): ProgramItem {
	return {
		id: 'i1',
		session_id: 's1',
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
		...over
	};
}

function week(intensity_modifier: number, is_deload = false): ProgramWeek {
	return { program_id: 'p1', week_number: 1, focus: 'x', intensity_modifier, is_deload };
}

const bySlug = new Map(SEED_EXERCISES.map((e) => [e.slug, e]));
function exercise(slug: string): Exercise {
	const found = bySlug.get(slug);
	if (!found) throw new Error(`no seed exercise ${slug}`);
	return found;
}

describe('zones', () => {
	it('covers 50–100% with no gap and no overlap', () => {
		for (let pct = 50; pct <= 100; pct += 1) {
			expect(zoneFor(pct)).toBeDefined();
		}
		for (const [i, zone] of HR_ZONES.entries()) {
			if (i === 0) continue;
			expect(zone.min_pct).toBe(HR_ZONES[i - 1].max_pct);
		}
	});

	it('names a band for where its midpoint sits, not for either end', () => {
		// 78–82% straddles the Z3/Z4 boundary; its midpoint is 80, so it is Z4.
		expect(zoneFor((78 + 82) / 2).label).toBe('Z4');
		// 76–82% sits mostly in Z3.
		expect(zoneFor((76 + 82) / 2).label).toBe('Z3');
	});

	it('lands anything off the scale on the nearest end', () => {
		expect(zoneFor(20).label).toBe('Z1');
		expect(zoneFor(100).label).toBe('Z5');
		expect(zoneFor(140).label).toBe('Z5');
	});
});

describe('estimateMaxHr', () => {
	it('uses the age band when no date of birth was given', () => {
		// Tanaka on the band's typical age: 211 − 0.64 × 12 = 203.3 → 203.
		expect(estimateMaxHr(profile({ age_group: 'u13' }), TODAY)).toBe(203);
		expect(estimateMaxHr(profile({ age_group: 'senior' }), TODAY)).toBe(195);
	});

	it('prefers a date of birth over the band', () => {
		const older = profile({ age_group: 'senior', date_of_birth: '1986-09-25' });
		expect(ageFor(older, TODAY)).toBe(40);
		expect(estimateMaxHr(older, TODAY)).toBe(185);
	});

	it('gives a masters player a lower maximum than a junior', () => {
		expect(estimateMaxHr(profile({ age_group: 'masters' }), TODAY)).toBeLessThan(
			estimateMaxHr(profile({ age_group: 'u13' }), TODAY)
		);
	});

	it('falls back to the band rather than trusting an impossible birth date', () => {
		const future = profile({ age_group: 'senior', date_of_birth: '2030-01-01' });
		expect(ageFor(future, TODAY)).toBe(25);
		const ancient = profile({ age_group: 'senior', date_of_birth: '1850-01-01' });
		expect(ageFor(ancient, TODAY)).toBe(25);
	});
});

describe('scaleBand', () => {
	it('leaves a band alone in a week of no adjustment', () => {
		expect(scaleBand({ min_pct: 85, max_pct: 90 }, week(1))).toEqual({
			min_pct: 85,
			max_pct: 90
		});
	});

	it('moves the band with the week', () => {
		expect(scaleBand({ min_pct: 60, max_pct: 70 }, week(1.1))).toEqual({
			min_pct: 66,
			max_pct: 77
		});
		expect(scaleBand({ min_pct: 80, max_pct: 88 }, week(0.85))).toEqual({
			min_pct: 68,
			max_pct: 75
		});
	});

	it('never scales past a heart rate anybody has', () => {
		// 88–95 in a 1.15 peak week would be 101–109 unclamped.
		expect(scaleBand({ min_pct: 88, max_pct: 95 }, week(1.15))).toEqual({
			min_pct: HR_PCT_CEILING,
			max_pct: HR_PCT_CEILING
		});
	});

	it('keeps a deload a lighter session rather than a walk', () => {
		const scaled = scaleBand({ min_pct: 55, max_pct: 68 }, week(0.8, true));
		expect(scaled.min_pct).toBe(HR_PCT_FLOOR);
		expect(scaled.max_pct).toBeGreaterThanOrEqual(HR_PCT_FLOOR);
	});

	it('applies the player modifier on top of the week', () => {
		const both = scaleBand({ min_pct: 80, max_pct: 90 }, week(1.05), 0.85);
		const weekOnly = scaleBand({ min_pct: 80, max_pct: 90 }, week(1.05));
		expect(both.max_pct).toBeLessThan(weekOnly.max_pct);
	});

	it('never returns a band whose floor is above its ceiling', () => {
		for (const modifier of [0.5, 0.8, 1, 1.1, 1.3, 2]) {
			const scaled = scaleBand({ min_pct: 88, max_pct: 95 }, week(modifier));
			expect(scaled.min_pct).toBeLessThanOrEqual(scaled.max_pct);
		}
	});
});

describe('hrPrescriptionFor', () => {
	it('reads an authored band as the work target', () => {
		const result = hrPrescriptionFor({
			item: item({ hr_pct_min: 85, hr_pct_max: 92, reps_count: 6, distance_m: 400 }),
			exercise: null,
			session_type: 'running'
		});
		expect(result).toEqual({ kind: 'work', band: { min_pct: 85, max_pct: 92 } });
	});

	it('gives a lift a between-sets recovery threshold, not a work band', () => {
		const result = hrPrescriptionFor({
			item: item({ sets: 4, reps: '5', load_pct_1rm: 80 }),
			exercise: exercise('back-squat'),
			session_type: 'strength'
		});
		expect(result).toEqual({ kind: 'recovery', pct: SET_RECOVERY_PCT });
	});

	it('leaves the recovery threshold alone in a deload week', () => {
		// A readiness gate, not a dose: asking for *more* recovery before a lighter
		// set than before a heavy one would be backwards.
		const result = hrPrescriptionFor({
			item: item({ sets: 3, reps: '4', load_pct_1rm: 70 }),
			exercise: exercise('back-squat'),
			session_type: 'strength',
			week: week(0.8, true)
		});
		expect(result).toEqual({ kind: 'recovery', pct: SET_RECOVERY_PCT });
	});

	it('says nothing at all about a plank', () => {
		const result = hrPrescriptionFor({
			item: item({ sets: 3, reps: '45 s hold' }),
			exercise: exercise('plank'),
			session_type: 'strength'
		});
		expect(result).toEqual({ kind: 'none' });
	});

	it('gives jumping a work band wherever it appears', () => {
		// Same treatment on a strength block's power day as in a plyometric block.
		for (const session_type of ['strength', 'plyometric'] as const) {
			const result = hrPrescriptionFor({
				item: item({ sets: 3, reps: '10' }),
				exercise: exercise('pogo-hops'),
				session_type
			});
			expect(result.kind).toBe('work');
		}
	});

	it('tells intervals from a continuous run when nothing was authored', () => {
		const intervals = hrPrescriptionFor({
			item: item({ reps_count: 6, distance_m: 400 }),
			exercise: null,
			session_type: 'running'
		});
		const continuous = hrPrescriptionFor({
			item: item({ work_seconds: 1200 }),
			exercise: null,
			session_type: 'running'
		});
		expect(intervals.kind).toBe('work');
		expect(continuous.kind).toBe('work');
		if (intervals.kind !== 'work' || continuous.kind !== 'work') throw new Error('unreachable');
		expect(intervals.band.max_pct).toBeGreaterThan(continuous.band.max_pct);
	});
});

describe('describeHeartRate', () => {
	const max_hr = 195;

	it('reads as zone, band and beats', () => {
		expect(
			describeHeartRate({
				item: item({ hr_pct_min: 85, hr_pct_max: 90, reps_count: 6, distance_m: 400 }),
				exercise: null,
				session_type: 'running',
				max_hr
			})
		).toBe('Z4 · 85–90% HRmax · ~166–176 bpm');
	});

	it('collapses to one number when the clamp closes the band', () => {
		expect(
			describeHeartRate({
				item: item({ hr_pct_min: 88, hr_pct_max: 95, reps_count: 6, distance_m: 40 }),
				exercise: null,
				session_type: 'running',
				week: week(1.15),
				max_hr
			})
		).toBe('Z5 · 95% HRmax · ~185 bpm');
	});

	it('tells a lifter what to come back down to', () => {
		expect(
			describeHeartRate({
				item: item({ sets: 4, reps: '5', load_pct_1rm: 80 }),
				exercise: exercise('back-squat'),
				session_type: 'strength',
				max_hr
			})
		).toBe('Recover under 65% HRmax · ~127 bpm');
	});

	it('says nothing where there is nothing worth saying', () => {
		expect(
			describeHeartRate({
				item: item({ sets: 3, reps: '45 s hold' }),
				exercise: exercise('plank'),
				session_type: 'strength',
				max_hr
			})
		).toBeNull();
	});

	it('marks every beat figure as an estimate', () => {
		for (const it_ of [
			item({ hr_pct_min: 70, hr_pct_max: 80, work_seconds: 600 }),
			item({ sets: 3, reps: '5', load_pct_1rm: 75, exercise_id: 'x' })
		]) {
			const line = describeHeartRate({
				item: it_,
				exercise: it_.load_pct_1rm !== null ? exercise('back-squat') : null,
				session_type: 'running',
				max_hr
			});
			expect(line).toContain('~');
		}
	});
});

describe('bpmFor', () => {
	it('is a whole number of beats', () => {
		expect(bpmFor(85, 195)).toBe(166);
		expect(Number.isInteger(bpmFor(63, 201))).toBe(true);
	});
});

describe('describeMaxHrBasis', () => {
	it('names the age group when that is all it had to go on', () => {
		expect(describeMaxHrBasis(profile({ age_group: 'u15' }), TODAY)).toContain('your age group');
	});

	it('names the age when a date of birth was given', () => {
		const known = profile({ date_of_birth: '2000-09-25' });
		expect(describeMaxHrBasis(known, TODAY)).toContain('based on your age');
		expect(describeMaxHrBasis(known, TODAY)).not.toContain('age group');
	});
});

describe('seed content prescribes heart rate honestly', () => {
	const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

	it('authors a band on every running effort', () => {
		// A bare running item is where the default is least able to guess: strides
		// and a hard 400 are both reps of a distance and belong in different zones.
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const it_ of plan.items) {
				if (it_.exercise_id !== null) continue;
				if (it_.distance_m === null && it_.work_seconds === null) continue;
				expect(it_.hr_pct_min, `${plan.program.slug} item ${it_.order}`).not.toBeNull();
				expect(it_.hr_pct_max).not.toBeNull();
			}
		}
	});

	it('never authors a band the wrong way round, or off the scale', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const it_ of plan.items) {
				if (it_.hr_pct_min === null || it_.hr_pct_max === null) continue;
				expect(it_.hr_pct_min).toBeLessThan(it_.hr_pct_max);
				expect(it_.hr_pct_min).toBeGreaterThanOrEqual(HR_PCT_FLOOR);
				expect(it_.hr_pct_max).toBeLessThanOrEqual(100);
			}
		}
	});

	it('puts no band on a lift, where load is the prescription', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const it_ of plan.items) {
				if (it_.load_pct_1rm === null) continue;
				expect(it_.hr_pct_min).toBeNull();
			}
		}
	});

	it('keeps jumping out of the conditioning zones', () => {
		// A set of hops that drives the heart rate into Z4 has stopped being a
		// jumping set. The plyometric blocks are prescribed by quality, and the
		// bands are there to say so.
		for (const plan of SEED_PROGRAM_PLANS) {
			if (plan.program.discipline !== 'plyometrics') continue;
			for (const it_ of plan.items) {
				if (it_.hr_pct_max === null) continue;
				expect(it_.hr_pct_max, `${plan.program.slug} item ${it_.order}`).toBeLessThanOrEqual(82);
			}
		}
	});

	it('scales every authored band into a target a player can hold', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const it_ of plan.items) {
				if (it_.hr_pct_min === null || it_.hr_pct_max === null) continue;
				for (const w of plan.weeks) {
					const scaled = scaleBand({ min_pct: it_.hr_pct_min, max_pct: it_.hr_pct_max }, w);
					expect(scaled.max_pct).toBeLessThanOrEqual(HR_PCT_CEILING);
					expect(scaled.min_pct).toBeLessThanOrEqual(scaled.max_pct);
				}
			}
		}
	});

	it('gives every prescribed exercise a line or a considered silence', () => {
		// Nothing should fall through to `kind: 'none'` by accident — only core
		// work, which genuinely has no heart rate worth printing, and the drills
		// and stretches of a warm-up or cool-down, which are not working sets.
		for (const plan of SEED_PROGRAM_PLANS) {
			for (const it_ of plan.items) {
				const ex = it_.exercise_id ? (byId.get(it_.exercise_id) ?? null) : null;
				const result = hrPrescriptionFor({
					item: it_,
					exercise: ex,
					session_type: 'strength'
				});
				if (result.kind === 'none' && it_.section === 'main') {
					expect(ex?.movement_pattern, `${plan.program.slug} item ${it_.order}`).toBe('core');
				}
			}
		}
	});
});
