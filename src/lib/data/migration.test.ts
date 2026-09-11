import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { Drill, RepLog, Session } from '$lib/types';

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
			user_id: null,
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
			user_id: null,
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
			user_id: null,
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
		// The rest of the row is untouched, and the schema version records the change.
		expect(profile).toMatchObject({
			display_name: 'Test player',
			primary_position: 'ruck',
			equipment_access: ['oval'],
			schema_version: 2
		});

		v4.close();
	});
});
