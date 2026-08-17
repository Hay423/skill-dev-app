/**
 * Domain model.
 *
 * Field names are snake_case on purpose: these records map 1:1 onto Postgres
 * columns, so the eventual Supabase sync needs no translation layer. Ids are
 * UUIDs generated client-side (`crypto.randomUUID()`) so a record created
 * offline keeps its identity when it is pushed to the server.
 *
 * Timestamps are ISO-8601 strings in UTC, matching Postgres `timestamptz`.
 */

export type Uuid = string;
export type IsoDateTime = string;
/** Calendar day in the user's local timezone, `YYYY-MM-DD`. */
export type IsoDate = string;

export const SKILL_CATEGORIES = [
	'kicking',
	'goalkicking',
	'handball',
	'marking',
	'ground_ball',
	'tackling',
	'evasion',
	'ruckwork'
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
	kicking: 'Kicking',
	goalkicking: 'Goalkicking',
	handball: 'Handball',
	marking: 'Marking',
	ground_ball: 'Ground ball',
	tackling: 'Tackling',
	evasion: 'Evasion',
	ruckwork: 'Ruckwork'
};

/** 1 = foundation, 2 = developing, 3 = advanced. */
export type Difficulty = 1 | 2 | 3;

export type Foot = 'left' | 'right' | 'both';

/**
 * Sync bookkeeping carried by every user-owned row.
 *
 * `_dirty` and `_deleted` are 0/1 rather than booleans because IndexedDB
 * cannot index boolean values. Deletes are soft so they can be replayed to the
 * server; the sync layer hard-deletes once the server acknowledges.
 */
export interface SyncMeta {
	created_at: IsoDateTime;
	updated_at: IsoDateTime;
	/** Null until the row has been pushed to Supabase at least once. */
	synced_at: IsoDateTime | null;
	_dirty: 0 | 1;
	_deleted: 0 | 1;
}

/**
 * Owner of a user-generated row. Null while the app is anonymous and
 * local-only; the sync layer stamps the real auth uid on first sign-in.
 */
export interface Owned {
	user_id: Uuid | null;
}

/**
 * A drill from the library.
 *
 * Drills are reference data, not user data: they ship with the app and are
 * keyed by a stable `slug` so seed updates can upsert without duplicating.
 */
export interface Drill {
	id: Uuid;
	slug: string;
	name: string;
	category: SkillCategory;
	summary: string;
	setup: string;
	coaching_points: string[];
	equipment: string[];
	min_players: number;
	duration_minutes: number;
	difficulty: Difficulty;
	/** True when the drill produces attempt/success counts worth logging. */
	tracks_reps: boolean;
	/** Suggested attempts per set, when `tracks_reps` is true. */
	target_reps: number | null;
}

/** A training session — a run through one or more drills. */
export interface Session extends Owned, SyncMeta {
	id: Uuid;
	started_at: IsoDateTime;
	/** Null while the session is still in progress. */
	completed_at: IsoDateTime | null;
	/** Ordered drill ids, as planned at the start of the session. */
	drill_ids: Uuid[];
	/** Local calendar day, denormalised so streaks can be computed by index. */
	local_date: IsoDate;
	notes: string | null;
}

/**
 * One set of reps against a skill.
 *
 * `session_id` is null for a quick log made outside a guided session, and
 * `drill_id` is null when the reps were freeform rather than tied to a drill.
 * `category` is always present so progress can be rolled up either way.
 */
export interface RepLog extends Owned, SyncMeta {
	id: Uuid;
	session_id: Uuid | null;
	drill_id: Uuid | null;
	category: SkillCategory;
	attempts: number;
	successes: number;
	/** Distance in metres, for kicking drills where it is meaningful. */
	distance_m: number | null;
	foot: Foot | null;
	recorded_at: IsoDateTime;
	local_date: IsoDate;
	notes: string | null;
}

/** Anything the sync layer pushes. Drills are excluded — they are read-only. */
export type SyncableTable = 'sessions' | 'rep_logs';
