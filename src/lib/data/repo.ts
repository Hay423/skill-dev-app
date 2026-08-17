import type { Drill, IsoDate, RepLog, Session, SkillCategory, Uuid } from '$lib/types';

/**
 * The seam between the UI and storage.
 *
 * Every read and write in the app goes through this interface, so swapping the
 * Dexie implementation for a Supabase-backed one (or a local-first repo that
 * writes through to Supabase) is a single change in `src/lib/data/index.ts`.
 * Nothing above this line may import Dexie directly.
 */
export interface Repo {
	// --- drills (reference data, read-only) ---
	listDrills(filter?: { category?: SkillCategory }): Promise<Drill[]>;
	getDrill(id: Uuid): Promise<Drill | undefined>;
	getDrillBySlug(slug: string): Promise<Drill | undefined>;

	// --- sessions ---
	startSession(input: { drill_ids: Uuid[]; notes?: string | null }): Promise<Session>;
	completeSession(id: Uuid): Promise<Session | undefined>;
	getSession(id: Uuid): Promise<Session | undefined>;
	listSessions(opts?: { limit?: number }): Promise<Session[]>;
	activeSession(): Promise<Session | undefined>;

	// --- rep logs ---
	logReps(input: NewRepLog): Promise<RepLog>;
	deleteRepLog(id: Uuid): Promise<void>;
	listRepLogs(filter?: {
		from?: IsoDate;
		to?: IsoDate;
		category?: SkillCategory;
		session_id?: Uuid;
		limit?: number;
	}): Promise<RepLog[]>;
}

export interface NewRepLog {
	category: SkillCategory;
	attempts: number;
	successes: number;
	session_id?: Uuid | null;
	drill_id?: Uuid | null;
	distance_m?: number | null;
	foot?: RepLog['foot'];
	notes?: string | null;
	/** Defaults to now. Injectable so tests are deterministic. */
	recorded_at?: string;
}
