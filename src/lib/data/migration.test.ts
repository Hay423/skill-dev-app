import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCAL_USER_ID, type Drill, type RepLog, type Session } from '$lib/types';

/**
 * Simulates a real v1 user upgrading to v2: a database is opened with only
 * the original `stores()` definition, seeded with data, then reopened
 * through the real `SkillDevDb` (which chains v1 -> v2). Existing rows must
 * survive and the new player-profile/content tables must come up empty but
 * queryable.
 */
describe('v1 -> v2 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('preserves existing sessions and rep_logs, and adds the new tables', async () => {
		class V1Db extends Dexie {
			constructor() {
				super('skill-dev');
				this.version(1).stores({
					drills: 'id, &slug, category, difficulty',
					sessions: 'id, local_date, started_at, completed_at, _dirty',
					rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty'
				});
			}
		}

		const session: Session = {
			id: 'session-1',
			user_id: LOCAL_USER_ID,
			started_at: '2026-08-01T10:00:00.000Z',
			completed_at: null,
			drill_ids: ['drill-1'],
			local_date: '2026-08-01',
			notes: null,
			created_at: '2026-08-01T10:00:00.000Z',
			updated_at: '2026-08-01T10:00:00.000Z',
			synced_at: null,
			_dirty: 1,
			_deleted: 0
		};
		const repLog: RepLog = {
			id: 'rep-1',
			user_id: LOCAL_USER_ID,
			session_id: 'session-1',
			drill_id: 'drill-1',
			category: 'kicking',
			attempts: 10,
			successes: 7,
			distance_m: null,
			foot: 'right',
			recorded_at: '2026-08-01T10:05:00.000Z',
			local_date: '2026-08-01',
			notes: null,
			created_at: '2026-08-01T10:05:00.000Z',
			updated_at: '2026-08-01T10:05:00.000Z',
			synced_at: null,
			_dirty: 1,
			_deleted: 0
		};

		const v1 = new V1Db();
		await v1.table('sessions').add(session);
		await v1.table('rep_logs').add(repLog);
		v1.close();

		// Import fresh so the module's `SkillDevDb` (v1 -> v2 chain) opens the
		// same on-disk database rather than reusing an already-open instance.
		const { SkillDevDb } = await import('./db');
		const v2 = new SkillDevDb();

		await expect(v2.sessions.get('session-1')).resolves.toMatchObject({ id: 'session-1' });
		await expect(v2.rep_logs.get('rep-1')).resolves.toMatchObject({ id: 'rep-1', attempts: 10 });

		await expect(v2.player_profile.toArray()).resolves.toEqual([]);
		await expect(v2.positions.toArray()).resolves.toEqual([]);
		await expect(v2.programs.toArray()).resolves.toEqual([]);

		v2.close();
	});
});

/**
 * Simulates a v2 user upgrading to v3: a drill seeded before `active`/`source`
 * existed must come up visible (`active: 1`) and attributed to the seed
 * library, not silently hidden or orphaned.
 */
describe('v2 -> v3 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('backfills active and source on existing drills', async () => {
		class V2Db extends Dexie {
			constructor() {
				super('skill-dev');
				this.version(1).stores({
					drills: 'id, &slug, category, difficulty',
					sessions: 'id, local_date, started_at, completed_at, _dirty',
					rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty'
				});
				this.version(2).stores({
					drills: 'id, &slug, category, difficulty',
					sessions: 'id, local_date, started_at, completed_at, _dirty',
					rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
					player_profile: 'id, _dirty',
					positions: '&position, group',
					exercises: 'id, &slug, movement_pattern',
					programs: 'id, &slug, discipline, phase',
					program_weeks: '[program_id+week_number], program_id',
					program_sessions: 'id, program_id, week_number',
					program_items: 'id, session_id',
					program_enrolments: 'id, program_id, completed_at, _dirty'
				});
			}
		}

		const drill: Omit<Drill, 'active' | 'source'> = {
			id: 'drill-1',
			slug: 'wall-kick-repeaters',
			name: 'Wall kick repeaters',
			category: 'kicking',
			summary: 'Summary',
			setup: 'Setup',
			coaching_points: [],
			equipment: [],
			min_players: 1,
			duration_minutes: 10,
			difficulty: 1,
			tracks_reps: true,
			target_reps: 20
		};

		const v2 = new V2Db();
		await v2.table('drills').add(drill);
		v2.close();

		const { SkillDevDb } = await import('./db');
		const v3 = new SkillDevDb();

		await expect(v3.drills.get('drill-1')).resolves.toMatchObject({
			id: 'drill-1',
			active: 1,
			source: 'seed'
		});

		v3.close();
	});
});

/**
 * Simulates a v3 user upgrading to v4, after injury collection was forked out
 * of the app. The stored `injuries` key must actually be gone — not merely
 * unread — since deleting it is the whole point of the version bump. Everything
 * else on the profile has to survive untouched.
 */
describe('v3 -> v4 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('purges stored injury flags and leaves the rest of the profile intact', async () => {
		class V3Db extends Dexie {
			constructor() {
				super('skill-dev');
				this.version(3).stores({
					drills: 'id, &slug, category, difficulty, active',
					sessions: 'id, local_date, started_at, completed_at, _dirty',
					rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
					player_profile: 'id, _dirty',
					positions: '&position, group',
					exercises: 'id, &slug, movement_pattern',
					programs: 'id, &slug, discipline, phase',
					program_weeks: '[program_id+week_number], program_id',
					program_sessions: 'id, program_id, week_number',
					program_items: 'id, session_id',
					program_enrolments: 'id, program_id, completed_at, _dirty'
				});
			}
		}

		const v3 = new V3Db();
		await v3.table('player_profile').add({
			id: 'me',
			user_id: LOCAL_USER_ID,
			display_name: 'Test player',
			primary_position: 'ruck',
			secondary_position: null,
			age_group: 'senior',
			date_of_birth: null,
			experience: 'developing',
			sessions_per_week: 3,
			available_days: ['mon'],
			equipment_access: ['oval'],
			injuries: [{ region: 'hamstring', status: 'current', note: 'grade 1', since: '2026-07-01' }],
			schema_version: 1,
			created_at: '2026-08-01T00:00:00.000Z',
			updated_at: '2026-08-01T00:00:00.000Z',
			synced_at: null,
			_dirty: 1,
			_deleted: 0
		});
		v3.close();

		const { SkillDevDb } = await import('./db');
		const v4 = new SkillDevDb();

		const profile = (await v4.player_profile.get('me')) as Record<string, unknown> | undefined;
		expect(profile).toBeDefined();
		expect('injuries' in profile!).toBe(false);
		// The rest of the row is untouched. The schema version reads 3 rather than
		// 2 because Dexie runs the whole chain in one open: a v3 database is
		// carried through v4 (injuries purged) and on through v5 (age bands
		// renamed) before it is handed back.
		expect(profile).toMatchObject({
			display_name: 'Test player',
			primary_position: 'ruck',
			equipment_access: ['oval'],
			schema_version: 3
		});

		v4.close();
	});
});

/**
 * Simulates a v4 user upgrading to v5, when the junior age bands were renamed
 * from U12/U14/U16/U18 to U13/U15/U17/Seniors.
 *
 * The stored value is the input to a safety rule, not a label: `AGE_GROUPS`
 * order is what every age gate compares against, so a row left carrying `u14`
 * would rank as -1 and gate incorrectly. Rewriting the value is the migration's
 * whole purpose.
 */
describe('v4 -> v5 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	const V4_STORES = {
		drills: 'id, &slug, category, difficulty, active',
		sessions: 'id, local_date, started_at, completed_at, _dirty',
		rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
		player_profile: 'id, _dirty',
		positions: '&position, group',
		exercises: 'id, &slug, movement_pattern',
		programs: 'id, &slug, discipline, phase',
		program_weeks: '[program_id+week_number], program_id',
		program_sessions: 'id, program_id, week_number',
		program_items: 'id, session_id',
		program_enrolments: 'id, program_id, completed_at, _dirty'
	};

	class V4Db extends Dexie {
		constructor() {
			super('skill-dev');
			this.version(4).stores(V4_STORES);
		}
	}

	function v4Profile(age_group: string) {
		return {
			id: 'me',
			user_id: LOCAL_USER_ID,
			display_name: 'Test player',
			primary_position: 'small_forward',
			secondary_position: null,
			age_group,
			date_of_birth: null,
			experience: 'developing',
			sessions_per_week: 3,
			available_days: ['mon'],
			equipment_access: ['oval'],
			schema_version: 2,
			created_at: '2026-08-01T00:00:00.000Z',
			updated_at: '2026-08-01T00:00:00.000Z',
			synced_at: null,
			_dirty: 1 as const,
			_deleted: 0 as const
		};
	}

	async function upgradedAgeGroup(stored: string): Promise<unknown> {
		const v4 = new V4Db();
		await v4.table('player_profile').add(v4Profile(stored));
		v4.close();

		const { SkillDevDb } = await import('./db');
		const v5 = new SkillDevDb();
		const profile = await v5.player_profile.get('me');
		v5.close();
		return profile?.age_group;
	}

	it('renames each old band onto its replacement', async () => {
		expect(await upgradedAgeGroup('u12')).toBe('u13');
		await Dexie.delete('skill-dev');
		expect(await upgradedAgeGroup('u14')).toBe('u15');
		await Dexie.delete('skill-dev');
		expect(await upgradedAgeGroup('u16')).toBe('u17');
	});

	it('folds U18 into seniors, the one band where widening access is safe', async () => {
		expect(await upgradedAgeGroup('u18')).toBe('senior');
	});

	it('leaves the bands that did not change alone', async () => {
		expect(await upgradedAgeGroup('senior')).toBe('senior');
		await Dexie.delete('skill-dev');
		expect(await upgradedAgeGroup('masters')).toBe('masters');
	});

	it('lands an unrecognised band on the most conservative one', async () => {
		// A value no gate can read is a value no gate can enforce, so it fails
		// closed rather than staying unmapped.
		expect(await upgradedAgeGroup('u10')).toBe('u11');
	});

	it('stamps the new profile schema version', async () => {
		const v4 = new V4Db();
		await v4.table('player_profile').add(v4Profile('u14'));
		v4.close();

		const { SkillDevDb } = await import('./db');
		const v5 = new SkillDevDb();
		await expect(v5.player_profile.get('me')).resolves.toMatchObject({
			display_name: 'Test player',
			equipment_access: ['oval'],
			schema_version: 3
		});
		v5.close();
	});
});

/**
 * Simulates a v5 user upgrading to v6, when session ticking and the calendar
 * landed.
 *
 * `current_week` is replaced by `started_on`: a program week became a real
 * calendar week, so the stored counter is not merely redundant, it is a second
 * source of truth that would disagree with the calendar the first time a week
 * was missed. The enrolment itself has to survive — a player mid-block should
 * not lose their program to an app update.
 */
describe('v5 -> v6 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('replaces the stored week counter with the day the player enrolled', async () => {
		class V5Db extends Dexie {
			constructor() {
				super('skill-dev');
				this.version(5).stores({
					drills: 'id, &slug, category, difficulty, active',
					sessions: 'id, local_date, started_at, completed_at, _dirty',
					rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
					player_profile: 'id, _dirty',
					positions: '&position, group',
					exercises: 'id, &slug, movement_pattern',
					programs: 'id, &slug, discipline, phase',
					program_weeks: '[program_id+week_number], program_id',
					program_sessions: 'id, program_id, week_number',
					program_items: 'id, session_id',
					program_enrolments: 'id, program_id, started_at, completed_at, _dirty'
				});
			}
		}

		// Midday local time, so the local calendar day is unambiguous whatever
		// timezone the test runs in.
		const startedAt = new Date(2026, 8, 16, 12, 0, 0).toISOString();

		const v5 = new V5Db();
		await v5.table('program_enrolments').add({
			id: 'enrol-1',
			user_id: LOCAL_USER_ID,
			program_id: 'program-1',
			started_at: startedAt,
			current_week: 3,
			completed_at: null,
			created_at: startedAt,
			updated_at: startedAt,
			synced_at: null,
			_dirty: 1,
			_deleted: 0
		});
		v5.close();

		const { SkillDevDb } = await import('./db');
		const v6 = new SkillDevDb();

		const row = (await v6.program_enrolments.get('enrol-1')) as Record<string, unknown> | undefined;
		expect(row).toBeDefined();
		expect(row!.started_on).toBe('2026-09-16');
		expect('current_week' in row!).toBe(false);
		expect(row).toMatchObject({ program_id: 'program-1', completed_at: null });

		// The new table comes up empty but queryable.
		await expect(v6.program_session_logs.toArray()).resolves.toEqual([]);

		v6.close();
	});
});

describe('v6 -> v7 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	/** The v6 schema, before `user_id` was indexed anywhere. */
	class V6Db extends Dexie {
		constructor() {
			super('skill-dev');
			this.version(6).stores({
				drills: 'id, &slug, category, difficulty, active',
				sessions: 'id, local_date, started_at, completed_at, _dirty',
				rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
				player_profile: 'id, _dirty',
				positions: '&position, group',
				exercises: 'id, &slug, movement_pattern',
				programs: 'id, &slug, discipline, phase',
				program_weeks: '[program_id+week_number], program_id',
				program_sessions: 'id, program_id, week_number',
				program_items: 'id, session_id',
				program_enrolments: 'id, program_id, started_at, completed_at, _dirty',
				program_session_logs:
					'id, enrolment_id, program_session_id, local_date, completed_at, _dirty'
			});
		}
	}

	const at = '2026-09-16T02:00:00.000Z';
	const meta = {
		created_at: at,
		updated_at: at,
		synced_at: null,
		_dirty: 1 as const,
		_deleted: 0 as const
	};

	it('backfills the placeholder owner onto every owned table', async () => {
		const v6 = new V6Db();
		await v6.table('sessions').add({
			id: 'session-1',
			user_id: null,
			started_at: at,
			completed_at: null,
			drill_ids: [],
			local_date: '2026-09-16',
			notes: null,
			...meta
		});
		await v6.table('rep_logs').add({
			id: 'rep-1',
			user_id: null,
			session_id: null,
			drill_id: null,
			category: 'kicking',
			attempts: 10,
			successes: 7,
			distance_m: null,
			foot: null,
			recorded_at: at,
			local_date: '2026-09-16',
			notes: null,
			...meta
		});
		await v6.table('player_profile').add({
			id: 'me',
			user_id: null,
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
			...meta
		});
		await v6.table('program_enrolments').add({
			id: 'enrol-1',
			user_id: null,
			program_id: 'program-1',
			started_at: at,
			started_on: '2026-09-16',
			completed_at: null,
			...meta
		});
		await v6.table('program_session_logs').add({
			id: 'log-1',
			user_id: null,
			enrolment_id: 'enrol-1',
			program_session_id: 'ps-1',
			local_date: '2026-09-16',
			completed_item_ids: [],
			completed_at: null,
			...meta
		});
		v6.close();

		const { SkillDevDb } = await import('./db');
		const v7 = new SkillDevDb();

		expect((await v7.sessions.get('session-1'))!.user_id).toBe(LOCAL_USER_ID);
		expect((await v7.rep_logs.get('rep-1'))!.user_id).toBe(LOCAL_USER_ID);
		expect((await v7.player_profile.get('me'))!.user_id).toBe(LOCAL_USER_ID);
		expect((await v7.program_enrolments.get('enrol-1'))!.user_id).toBe(LOCAL_USER_ID);
		expect((await v7.program_session_logs.get('log-1'))!.user_id).toBe(LOCAL_USER_ID);

		v7.close();
	});

	it('makes user_id queryable by index, which a null owner never was', async () => {
		const v6 = new V6Db();
		await v6.table('rep_logs').add({
			id: 'rep-1',
			user_id: null,
			session_id: null,
			drill_id: null,
			category: 'kicking',
			attempts: 10,
			successes: 7,
			distance_m: null,
			foot: null,
			recorded_at: at,
			local_date: '2026-09-16',
			notes: null,
			...meta
		});
		v6.close();

		const { SkillDevDb } = await import('./db');
		const v7 = new SkillDevDb();

		const mine = await v7.rep_logs.where('user_id').equals(LOCAL_USER_ID).toArray();
		expect(mine.map((r) => r.id)).toEqual(['rep-1']);

		v7.close();
	});

	it('never reassigns a row that already carries a real owner', async () => {
		const theirs = '11111111-1111-4111-8111-111111111111';
		const v6 = new V6Db();
		await v6.table('sessions').add({
			id: 'session-1',
			user_id: theirs,
			started_at: at,
			completed_at: null,
			drill_ids: [],
			local_date: '2026-09-16',
			notes: null,
			...meta
		});
		v6.close();

		const { SkillDevDb } = await import('./db');
		const v7 = new SkillDevDb();

		expect((await v7.sessions.get('session-1'))!.user_id).toBe(theirs);

		v7.close();
	});
});

describe('v7 -> v8 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	/** The v7 schema, before program items carried a heart rate band. */
	class V7Db extends Dexie {
		constructor() {
			super('skill-dev');
			this.version(7).stores({
				drills: 'id, &slug, category, difficulty, active',
				sessions: 'id, user_id, local_date, started_at, completed_at, _dirty',
				rep_logs: 'id, user_id, local_date, category, session_id, drill_id, recorded_at, _dirty',
				player_profile: 'id, user_id, _dirty',
				positions: '&position, group',
				exercises: 'id, &slug, movement_pattern',
				programs: 'id, &slug, discipline, phase',
				program_weeks: '[program_id+week_number], program_id',
				program_sessions: 'id, program_id, week_number',
				program_items: 'id, session_id',
				program_enrolments: 'id, user_id, program_id, started_at, completed_at, _dirty',
				program_session_logs:
					'id, user_id, enrolment_id, program_session_id, local_date, completed_at, _dirty'
			});
		}
	}

	const at = '2026-09-16T02:00:00.000Z';
	const meta = {
		created_at: at,
		updated_at: at,
		synced_at: null,
		_dirty: 1 as const,
		_deleted: 0 as const
	};

	/** A stored program subtree with no heart rate on its items, as v7 wrote it. */
	async function seedV7Content(db: V7Db): Promise<void> {
		await db.table('programs').add({
			id: 'program-1',
			slug: 'old-block',
			name: 'Old block',
			discipline: 'conditioning',
			phase: 'pre_season',
			target_positions: [],
			target_qualities: ['aerobic_capacity'],
			min_age_group: 'u11',
			experience: ['developing'],
			weeks: 1,
			sessions_per_week: 1,
			equipment_required: [],
			summary: 'Seeded before heart rate existed.'
		});
		await db.table('program_weeks').add({
			program_id: 'program-1',
			week_number: 1,
			focus: 'Build',
			intensity_modifier: 1,
			is_deload: false
		});
		await db.table('program_sessions').add({
			id: 'session-1',
			program_id: 'program-1',
			week_number: 1,
			day_index: 1,
			name: 'Run',
			type: 'running',
			duration_minutes: 30
		});
		await db.table('program_items').add({
			id: 'item-1',
			session_id: 'session-1',
			order: 1,
			exercise_id: null,
			sets: null,
			reps: null,
			rpe: null,
			load_pct_1rm: null,
			rest_seconds: null,
			distance_m: null,
			work_seconds: 600,
			reps_count: null,
			recovery_seconds: null,
			notes: 'Easy run'
		});
	}

	it('clears the bundled program subtree so the seeder can rewrite it', async () => {
		// Heart rate bands are authored content, not something an upgrade can
		// compute from a stored row. Clearing is what makes a re-seed the single
		// source of the prescription, rather than leaving a device that seeded
		// before v8 showing a program with no heart rate on it forever.
		const v7 = new V7Db();
		await seedV7Content(v7);
		v7.close();

		const { SkillDevDb } = await import('./db');
		const v8 = new SkillDevDb();

		expect(await v8.programs.count()).toBe(0);
		expect(await v8.program_weeks.count()).toBe(0);
		expect(await v8.program_sessions.count()).toBe(0);
		expect(await v8.program_items.count()).toBe(0);

		v8.close();
	});

	it('leaves the player’s own enrolment and ticks alone', async () => {
		// The subtree is safe to clear precisely because nothing user-owned is in
		// it, and because every id in it is derived from the program's, so a
		// re-seed reproduces each one exactly. A player mid-block keeps their week
		// and the exercises they had already ticked off.
		const v7 = new V7Db();
		await seedV7Content(v7);
		await v7.table('program_enrolments').add({
			id: 'enrolment-1',
			user_id: LOCAL_USER_ID,
			program_id: 'program-1',
			started_at: at,
			started_on: '2026-09-16',
			completed_at: null,
			...meta
		});
		await v7.table('program_session_logs').add({
			id: 'log-1',
			user_id: LOCAL_USER_ID,
			enrolment_id: 'enrolment-1',
			program_session_id: 'session-1',
			local_date: '2026-09-16',
			completed_item_ids: ['item-1'],
			completed_at: at,
			...meta
		});
		v7.close();

		const { SkillDevDb } = await import('./db');
		const v8 = new SkillDevDb();

		const enrolment = await v8.program_enrolments.get('enrolment-1');
		expect(enrolment).toBeDefined();
		expect(enrolment!.started_on).toBe('2026-09-16');
		expect(enrolment!.program_id).toBe('program-1');

		const log = await v8.program_session_logs.get('log-1');
		expect(log).toBeDefined();
		expect(log!.program_session_id).toBe('session-1');
		expect(log!.completed_item_ids).toEqual(['item-1']);

		v8.close();
	});

	it('leaves the other reference tables alone', async () => {
		// Only the program subtree changed shape. Drills in particular carry the
		// player's own edits and hide/show state from the admin library, and must
		// never be swept up in a content refresh.
		const v7 = new V7Db();
		await v7.table('drills').add({
			id: 'drill-1',
			slug: 'my-drill',
			name: 'My drill',
			category: 'kicking',
			summary: 's',
			setup: 's',
			coaching_points: [],
			equipment: [],
			min_players: 1,
			duration_minutes: 10,
			difficulty: 1,
			tracks_reps: 1,
			target_reps: 10,
			source: 'custom',
			active: 0
		});
		await v7.table('positions').add({
			position: 'ruck',
			group: 'ruck',
			label: 'Ruck',
			summary: 's',
			skill_weights: {},
			physical_weights: {}
		});
		v7.close();

		const { SkillDevDb } = await import('./db');
		const v8 = new SkillDevDb();

		const drill = await v8.drills.get('drill-1');
		expect(drill).toBeDefined();
		expect(drill!.active).toBe(0);
		expect(drill!.source).toBe('custom');
		expect(await v8.positions.count()).toBe(1);

		v8.close();
	});
});

describe('v8 -> v9 Dexie migration', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	/** The v8 schema, before the bundled drills declared the space they need. */
	class V8Db extends Dexie {
		constructor() {
			super('skill-dev');
			this.version(8).stores({
				drills: 'id, &slug, category, difficulty, active',
				sessions: 'id, user_id, local_date, started_at, completed_at, _dirty',
				rep_logs: 'id, user_id, local_date, category, session_id, drill_id, recorded_at, _dirty',
				player_profile: 'id, user_id, _dirty',
				positions: '&position, group',
				exercises: 'id, &slug, movement_pattern',
				programs: 'id, &slug, discipline, phase',
				program_weeks: '[program_id+week_number], program_id',
				program_sessions: 'id, program_id, week_number',
				program_items: 'id, session_id',
				program_enrolments: 'id, user_id, program_id, started_at, completed_at, _dirty',
				program_session_logs:
					'id, user_id, enrolment_id, program_session_id, local_date, completed_at, _dirty'
			});
		}
	}

	/** A stored drill as v8 wrote it: seeded, and carrying no structured requirement. */
	function storedDrill(overrides: Record<string, unknown> = {}) {
		return {
			id: 'unseeded',
			slug: 'unseeded',
			name: 'Hand-written drill',
			category: 'kicking',
			summary: '',
			setup: '',
			coaching_points: [],
			equipment: [],
			min_players: 1,
			duration_minutes: 10,
			difficulty: 1,
			tracks_reps: true,
			target_reps: 20,
			source: 'seed',
			active: 1,
			...overrides
		};
	}

	it('backfills the bundled requirement onto a seed drill that has none', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const wallDrill = SEED_DRILLS.find((d) => d.slug === 'wall-kick-repeaters')!;

		const v8 = new V8Db();
		await v8.open();
		await v8.table('drills').add(storedDrill({ id: wallDrill.id, slug: wallDrill.slug }));
		v8.close();

		const { SkillDevDb } = await import('./db');
		const v9 = new SkillDevDb();
		await expect(v9.drills.get(wallDrill.id)).resolves.toMatchObject({
			equipment_required: ['wall']
		});
		v9.close();
	});

	it('never overwrites a requirement someone has already chosen', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const wallDrill = SEED_DRILLS.find((d) => d.slug === 'wall-kick-repeaters')!;

		const v8 = new V8Db();
		await v8.open();
		await v8
			.table('drills')
			.add(
				storedDrill({ id: wallDrill.id, slug: wallDrill.slug, equipment_required: ['backyard'] })
			);
		v8.close();

		const { SkillDevDb } = await import('./db');
		const v9 = new SkillDevDb();
		await expect(v9.drills.get(wallDrill.id)).resolves.toMatchObject({
			equipment_required: ['backyard']
		});
		v9.close();
	});

	it('leaves a custom drill alone — there is no seed to read a value from', async () => {
		const v8 = new V8Db();
		await v8.open();
		await v8
			.table('drills')
			.add(storedDrill({ id: 'custom-1', slug: 'custom-1', source: 'custom' }));
		v8.close();

		const { SkillDevDb } = await import('./db');
		const v9 = new SkillDevDb();
		const drill = await v9.drills.get('custom-1');
		expect(drill!.equipment_required).toBeUndefined();
		v9.close();
	});

	it('leaves the rest of the drill row untouched, including hidden state', async () => {
		const { SEED_DRILLS } = await import('./seed/drills');
		const seed = SEED_DRILLS.find((d) => d.slug === 'set-shot-routine')!;

		const v8 = new V8Db();
		await v8.open();
		await v8
			.table('drills')
			.add(storedDrill({ id: seed.id, slug: seed.slug, name: 'Locally renamed', active: 0 }));
		v8.close();

		const { SkillDevDb } = await import('./db');
		const v9 = new SkillDevDb();
		await expect(v9.drills.get(seed.id)).resolves.toMatchObject({
			name: 'Locally renamed',
			active: 0,
			equipment_required: ['goals']
		});
		v9.close();
	});
});
