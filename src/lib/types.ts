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
	/** Position-specific override on top of the baseline category match. Empty for general drills. */
	position_tags?: Position[];
	/** Structured equipment for eligibility filtering. `equipment` above stays for display. */
	equipment_required?: EquipmentAccess[];
	/** `seed` ships with the app; `custom` was added locally through the admin library. */
	source: 'seed' | 'custom';
	/**
	 * 0 soft-hides the drill from the library, drill picker and recommendations
	 * without deleting the row, since rep logs may reference its id permanently.
	 */
	active: 0 | 1;
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

/**
 * Nine role-based positions, grouped for display. Traditional 18-position
 * names are deliberately not used — they no longer describe how anyone
 * trains. See plans/player-profile.md for the full rationale.
 */
export const POSITION_GROUPS = ['defence', 'midfield', 'ruck', 'forward', 'utility'] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export const POSITIONS = [
	'key_defender',
	'general_defender',
	'inside_midfielder',
	'outside_midfielder',
	'ruck',
	'key_forward',
	'medium_forward',
	'small_forward',
	'utility'
] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
	key_defender: 'Key defender',
	general_defender: 'General defender',
	inside_midfielder: 'Inside midfielder',
	outside_midfielder: 'Outside midfielder',
	ruck: 'Ruck',
	key_forward: 'Key forward',
	medium_forward: 'Medium forward',
	small_forward: 'Small forward',
	utility: 'Utility'
};

/** Fixed taxonomy, not content — unlike the skill/physical weights in `PositionProfile`. */
export const POSITION_GROUP_OF: Record<Position, PositionGroup> = {
	key_defender: 'defence',
	general_defender: 'defence',
	inside_midfielder: 'midfield',
	outside_midfielder: 'midfield',
	ruck: 'ruck',
	key_forward: 'forward',
	medium_forward: 'forward',
	small_forward: 'forward',
	utility: 'utility'
};

/**
 * Physical qualities a strength/conditioning program can target. Distinct
 * from `SkillCategory`, which is football skill, not physical capacity.
 */
export const PHYSICAL_QUALITIES = [
	'max_strength',
	'power',
	'speed',
	'acceleration',
	'agility',
	'repeat_sprint',
	'aerobic_capacity',
	'aerobic_power',
	'mobility',
	'robustness'
] as const;
export type PhysicalQuality = (typeof PHYSICAL_QUALITIES)[number];

export const PHYSICAL_QUALITY_LABELS: Record<PhysicalQuality, string> = {
	max_strength: 'Max strength',
	power: 'Power',
	speed: 'Speed',
	acceleration: 'Acceleration',
	agility: 'Agility',
	repeat_sprint: 'Repeat sprint',
	aerobic_capacity: 'Aerobic capacity',
	aerobic_power: 'Aerobic power',
	mobility: 'Mobility',
	robustness: 'Robustness'
};

/**
 * Age bands that gate resistance-training content. U12–U14 gets no external
 * load, U16 gets light technique-led load, U18+ gets full programs. This
 * gating lives in the recommendation layer, not the UI — see
 * plans/player-profile.md "Duty of care".
 */
export const AGE_GROUPS = ['u12', 'u14', 'u16', 'u18', 'senior', 'masters'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
	u12: 'Under 12',
	u14: 'Under 14',
	u16: 'Under 16',
	u18: 'Under 18',
	senior: 'Senior',
	masters: 'Masters'
};

export const EXPERIENCE_LEVELS = ['first_year', 'developing', 'experienced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
	first_year: 'First year playing',
	developing: 'Developing',
	experienced: 'Experienced'
};

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
	mon: 'Mon',
	tue: 'Tue',
	wed: 'Wed',
	thu: 'Thu',
	fri: 'Fri',
	sat: 'Sat',
	sun: 'Sun'
};

/** What a player can train with. Also used to gate drills, exercises and programs. */
export const EQUIPMENT_ACCESS = [
	'full_gym',
	'home_weights',
	'bands',
	'oval',
	'goals',
	'park',
	'backyard',
	'wall'
] as const;
export type EquipmentAccess = (typeof EQUIPMENT_ACCESS)[number];

export const EQUIPMENT_ACCESS_LABELS: Record<EquipmentAccess, string> = {
	full_gym: 'Full gym',
	home_weights: 'Home weights',
	bands: 'Resistance bands',
	oval: 'Oval access',
	goals: 'Goals',
	park: 'Local park',
	backyard: 'Backyard',
	wall: 'Wall'
};

/**
 * Body regions, used to describe reference content — which regions an exercise
 * is unsuitable for. This says nothing about any particular player, so it
 * carries no privacy weight and stayed when injury collection was forked out
 * to `src/lib/injuries/` (dormant — see that directory's README).
 */
export const BODY_REGIONS = [
	'ankle',
	'knee',
	'hamstring',
	'quad',
	'groin',
	'hip',
	'back',
	'shoulder',
	'other'
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
	ankle: 'Ankle',
	knee: 'Knee',
	hamstring: 'Hamstring',
	quad: 'Quad',
	groin: 'Groin',
	hip: 'Hip',
	back: 'Back',
	shoulder: 'Shoulder',
	other: 'Other'
};

/**
 * The player's own profile. A singleton row keyed `'me'` until auth lands —
 * see plans/player-profile.md open question on multi-player support.
 */
export interface PlayerProfile extends Owned, SyncMeta {
	id: Uuid;
	display_name: string | null;
	primary_position: Position;
	secondary_position: Position | null;
	age_group: AgeGroup;
	/** Optional even where age_group is set — some players would rather not give a DOB. */
	date_of_birth: IsoDate | null;
	experience: ExperienceLevel;
	sessions_per_week: number;
	available_days: Weekday[];
	equipment_access: EquipmentAccess[];
	/** Bumped when this shape changes, so a future migration can adapt old rows. */
	schema_version: number;
}

export const PLAYER_PROFILE_SCHEMA_VERSION = 2;

/** The constant singleton id `PlayerProfile` rows are keyed by until auth lands. */
export const SINGLETON_PROFILE_ID = 'me';

/**
 * Weightings that drive drill, program and conditioning recommendations for
 * a position. Reference content loaded from the content pipeline (see
 * plans/player-profile.md) — empty until content is imported.
 */
export interface PositionProfile {
	position: Position;
	group: PositionGroup;
	label: string;
	summary: string;
	/** SkillCategory → 0..1 emphasis. Drives drill scoring. */
	skill_weights: Partial<Record<SkillCategory, number>>;
	/** PhysicalQuality → 0..1 emphasis. Drives program and conditioning selection. */
	physical_weights: Partial<Record<PhysicalQuality, number>>;
}

export const MOVEMENT_PATTERNS = [
	'squat',
	'hinge',
	'push',
	'pull',
	'lunge',
	'carry',
	'core',
	'plyometric',
	'olympic'
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Reference content: a single strength/conditioning exercise. */
export interface Exercise {
	id: Uuid;
	slug: string;
	name: string;
	movement_pattern: MovementPattern;
	primary_qualities: PhysicalQuality[];
	equipment_required: EquipmentAccess[];
	min_age_group: AgeGroup;
	contraindicated_regions: BodyRegion[];
	coaching_points: string[];
	/** Shown in place of this exercise when an injury flag excludes it. */
	regression_slug: string | null;
	progression_slug: string | null;
}

/**
 * A periodised strength or conditioning program. Conditioning (running)
 * blocks reuse this same hierarchy rather than a parallel one — a
 * conditioning block is `discipline: 'conditioning'` with `type: 'running'`
 * sessions whose items carry distance/time instead of sets/reps.
 */
export interface TrainingProgram {
	id: Uuid;
	slug: string;
	name: string;
	discipline: 'strength' | 'conditioning';
	phase: 'off_season' | 'pre_season' | 'in_season' | 'finals' | 'return_to_play';
	/** Empty = applies to all positions. */
	target_positions: Position[];
	target_qualities: PhysicalQuality[];
	min_age_group: AgeGroup;
	experience: ExperienceLevel[];
	weeks: number;
	sessions_per_week: number;
	equipment_required: EquipmentAccess[];
	summary: string;
}

export interface ProgramWeek {
	program_id: Uuid;
	week_number: number;
	focus: string;
	intensity_modifier: number;
	is_deload: boolean;
}

export interface ProgramSession {
	id: Uuid;
	program_id: Uuid;
	week_number: number;
	day_index: number;
	name: string;
	type: 'strength' | 'running' | 'skills' | 'recovery';
	duration_minutes: number;
}

export interface ProgramItem {
	id: Uuid;
	session_id: Uuid;
	order: number;
	exercise_id: Uuid | null;
	/** Strength prescription. */
	sets: number | null;
	reps: string | null; // "8" or "6-8" or "AMRAP"
	rpe: number | null;
	load_pct_1rm: number | null;
	rest_seconds: number | null;
	/** Running prescription. */
	distance_m: number | null;
	work_seconds: number | null;
	reps_count: number | null;
	recovery_seconds: number | null;
	notes: string | null;
}

/** A program assembled with its weeks/sessions/items, as the repo returns it. */
export interface ProgramPlan {
	program: TrainingProgram;
	weeks: ProgramWeek[];
	sessions: ProgramSession[];
	items: ProgramItem[];
}

/** Which program the player is currently working through. */
export interface ProgramEnrolment extends Owned, SyncMeta {
	id: Uuid;
	program_id: Uuid;
	started_at: IsoDateTime;
	current_week: number;
	completed_at: IsoDateTime | null;
}

/** Anything the sync layer pushes. Drills are excluded — they are read-only. */
export type SyncableTable = 'sessions' | 'rep_logs' | 'player_profile' | 'program_enrolments';
