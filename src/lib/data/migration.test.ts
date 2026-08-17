import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import type { RepLog, Session } from '$lib/types';

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
