import Dexie, { type EntityTable } from 'dexie';
import type { Drill, RepLog, Session } from '$lib/types';

/**
 * IndexedDB schema.
 *
 * Indexes exist for the queries the app actually runs: rep logs by day (streaks
 * and the "today" view), by category (progress rollups) and by session; plus
 * `_dirty` on both user tables so the future sync layer can find pending rows
 * in one indexed scan rather than a full table walk.
 */
export class SkillDevDb extends Dexie {
	drills!: EntityTable<Drill, 'id'>;
	sessions!: EntityTable<Session, 'id'>;
	rep_logs!: EntityTable<RepLog, 'id'>;

	constructor() {
		super('skill-dev');

		this.version(1).stores({
			drills: 'id, &slug, category, difficulty',
			sessions: 'id, local_date, started_at, completed_at, _dirty',
			rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty'
		});
	}
}

export const db = new SkillDevDb();
