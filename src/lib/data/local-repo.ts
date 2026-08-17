import type { Drill, RepLog, Session, SyncMeta, Uuid } from '$lib/types';
import { localDate, newId, nowIso } from '$lib/util/time';
import { db } from './db';
import type { NewRepLog, Repo } from './repo';

/** Sync bookkeeping for a freshly created, not-yet-pushed row. */
function freshMeta(at = nowIso()): SyncMeta {
	return { created_at: at, updated_at: at, synced_at: null, _dirty: 1, _deleted: 0 };
}

/**
 * Dexie-backed repository. The only module in the app that touches `db`
 * directly, apart from the seeder.
 */
export class LocalRepo implements Repo {
	async listDrills(filter?: { category?: Drill['category'] }): Promise<Drill[]> {
		const drills = filter?.category
			? await db.drills.where('category').equals(filter.category).toArray()
			: await db.drills.toArray();
		return drills.sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
	}

	getDrill(id: Uuid) {
		return db.drills.get(id);
	}

	getDrillBySlug(slug: string) {
		return db.drills.where('slug').equals(slug).first();
	}

	async startSession(input: { drill_ids: Uuid[]; notes?: string | null }): Promise<Session> {
		const at = nowIso();
		const session: Session = {
			id: newId(),
			user_id: null,
			started_at: at,
			completed_at: null,
			drill_ids: input.drill_ids,
			local_date: localDate(at),
			notes: input.notes ?? null,
			...freshMeta(at)
		};
		await db.sessions.add(session);
		return session;
	}

	async completeSession(id: Uuid): Promise<Session | undefined> {
		const at = nowIso();
		await db.sessions.update(id, { completed_at: at, updated_at: at, _dirty: 1 });
		return db.sessions.get(id);
	}

	getSession(id: Uuid) {
		return db.sessions.get(id);
	}

	async listSessions(opts?: { limit?: number }): Promise<Session[]> {
		let query = db.sessions.orderBy('started_at').reverse().filter(notDeleted);
		if (opts?.limit) query = query.limit(opts.limit);
		return query.toArray();
	}

	/** The most recent session that has been started but not completed. */
	async activeSession(): Promise<Session | undefined> {
		// `completed_at: null` is not indexable in IndexedDB, so filter in memory
		// over the newest sessions rather than scanning the whole table.
		const recent = await db.sessions.orderBy('started_at').reverse().limit(20).toArray();
		return recent.find((s) => s.completed_at === null && s._deleted === 0);
	}

	async logReps(input: NewRepLog): Promise<RepLog> {
		if (input.attempts < 0 || input.successes < 0) {
			throw new Error('attempts and successes must be non-negative');
		}
		if (input.successes > input.attempts) {
			throw new Error('successes cannot exceed attempts');
		}

		const at = input.recorded_at ?? nowIso();
		const log: RepLog = {
			id: newId(),
			user_id: null,
			session_id: input.session_id ?? null,
			drill_id: input.drill_id ?? null,
			category: input.category,
			attempts: input.attempts,
			successes: input.successes,
			distance_m: input.distance_m ?? null,
			foot: input.foot ?? null,
			recorded_at: at,
			local_date: localDate(at),
			notes: input.notes ?? null,
			...freshMeta(at)
		};
		await db.rep_logs.add(log);
		return log;
	}

	/** Soft delete, so the removal can still be replayed to the server. */
	async deleteRepLog(id: Uuid): Promise<void> {
		await db.rep_logs.update(id, { _deleted: 1, _dirty: 1, updated_at: nowIso() });
	}

	async listRepLogs(filter?: {
		from?: string;
		to?: string;
		category?: RepLog['category'];
		session_id?: Uuid;
		limit?: number;
	}): Promise<RepLog[]> {
		let rows: RepLog[];

		if (filter?.session_id) {
			rows = await db.rep_logs.where('session_id').equals(filter.session_id).toArray();
		} else if (filter?.from || filter?.to) {
			// `local_date` sorts lexicographically because it is zero-padded ISO.
			rows = await db.rep_logs
				.where('local_date')
				.between(filter.from ?? '0000-00-00', filter.to ?? '9999-99-99', true, true)
				.toArray();
		} else {
			rows = await db.rep_logs.toArray();
		}

		rows = rows.filter(notDeleted);
		if (filter?.category) rows = rows.filter((r) => r.category === filter.category);
		rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
		return filter?.limit ? rows.slice(0, filter.limit) : rows;
	}
}

function notDeleted<T extends { _deleted: 0 | 1 }>(row: T): boolean {
	return row._deleted === 0;
}
