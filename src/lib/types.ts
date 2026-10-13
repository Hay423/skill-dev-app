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
 * Owner of a user-generated row.
 *
 * Always populated, never null. While the app is anonymous it carries
 * `LOCAL_USER_ID`; signing in rewrites those rows to the real auth uid. A
 * nullable owner would cost more than it saves: IndexedDB cannot index `null`,
 * so a nullable `user_id` is unindexable in practice, and every query and
 * migration downstream would have to carry a "no owner yet" branch that only
 * ever matters before sign-in.
 *
 * Maps onto a Postgres `uuid not null` column, which is also what makes the
 * row-level-security policy a one-liner.
 */
export interface Owned {
	user_id: Uuid;
}

/**
 * The owner stamped on rows created before sign-in.
 *
 * A fixed, valid v4 UUID rather than a sentinel like `'local'`, so it is the
 * same shape as a real Supabase auth uid: the column stays `uuid`, and the
 * backfill at first sign-in is an indexed rewrite of one known value rather
 * than a full-table scan for absent ones.
 *
 * Never reuse this value server-side — it is a local placeholder, not an
 * account. See `src/lib/data/user.ts`.
 */
export const LOCAL_USER_ID: Uuid = '00000000-0000-4000-8000-000000000001';

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
 * Age bands, in ascending order — the order is load-bearing: the
 * recommendation layer gates content by comparing indexes into this array, so
 * bands must never be reordered, only appended to or renamed alongside a
 * migration.
 *
 * These bands gate resistance-training content. U11–U15 are shown no strength
 * programs at all, U17 gets light technique-led load, seniors get full
 * periodised programs. That gating lives in the recommendation layer, not the
 * UI — see plans/player-profile.md "Duty of care".
 */
export const AGE_GROUPS = ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
	u11: 'Under 11',
	u13: 'Under 13',
	u15: 'Under 15',
	u17: 'Under 17',
	senior: 'Seniors',
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
	/**
	 * Weeks between skill retests. The player's choice, defaulting to
	 * `DEFAULT_RETEST_INTERVAL_WEEKS` — see the skill tests section below.
	 */
	retest_interval_weeks: number;
	/** Bumped when this shape changes, so a future migration can adapt old rows. */
	schema_version: number;
}

export const PLAYER_PROFILE_SCHEMA_VERSION = 4;

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
	'olympic',
	/**
	 * Range-of-motion work: the leg swings and stretches a warm-up or a
	 * cool-down is made of. Never prescribed as main work, never offered as a
	 * position extra, and carries no heart rate line.
	 */
	'mobility'
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
	/**
	 * What this exercise looks like prescribed as an optional extra, when the
	 * per-pattern default would be wrong — a plank is not "3 × 10". Optional:
	 * most exercises take the default for their movement pattern. See
	 * `ACCESSORY_DOSE` in `domain/exercise-fit.ts`.
	 */
	accessory_dose?: {
		sets: number;
		reps: string;
		rpe?: number | null;
		rest_seconds?: number | null;
	};
	/** Shown in place of this exercise when an injury flag excludes it. */
	regression_slug: string | null;
	progression_slug: string | null;
}

/**
 * A periodised strength, conditioning or plyometric program. Conditioning
 * (running) and plyometric blocks reuse this same hierarchy rather than a
 * parallel one — a conditioning block is `discipline: 'conditioning'` with
 * `type: 'running'` sessions whose items carry distance/time instead of
 * sets/reps, and a plyometric block is `discipline: 'plyometrics'` with
 * `type: 'plyometric'` sessions prescribed in sets and contacts.
 *
 * `discipline` is what the player is enrolled in one of at a time: starting a
 * block ends the one already running in the same discipline and only that one,
 * so a player can carry a lifting block, a running block and a jumping block
 * at once without them replacing each other.
 */
export interface TrainingProgram {
	id: Uuid;
	slug: string;
	name: string;
	discipline: 'strength' | 'conditioning' | 'plyometrics';
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
	type: 'strength' | 'running' | 'skills' | 'recovery' | 'plyometric';
	/** The whole session, warm-up and cool-down included. */
	duration_minutes: number;
	/**
	 * The warm-up and cool-down routines stamped into this session's items,
	 * named and timed so the session view can head each section. Null where the
	 * session has none. Denormalised from `seed/routines.ts` because a routine is
	 * authoring shorthand, not a thing stored in its own right — the items are
	 * the prescription.
	 */
	warm_up_name: string | null;
	warm_up_minutes: number | null;
	cool_down_name: string | null;
	cool_down_minutes: number | null;
}

/**
 * Which part of a session an item belongs to.
 *
 * Warm-up and cool-down items are ticked like any other and count towards the
 * session being done, but the week never scales them — a deload week still
 * warms up properly — and position tailoring never touches them.
 */
export const ITEM_SECTIONS = ['warm_up', 'main', 'cool_down'] as const;
export type ItemSection = (typeof ITEM_SECTIONS)[number];

export interface ProgramItem {
	id: Uuid;
	session_id: Uuid;
	/** Position across the whole session, warm-up first — sections are contiguous. */
	order: number;
	section: ItemSection;
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
	/**
	 * Target working heart rate for this item, as a percentage of the player's
	 * maximum — a band rather than a number, because an interval is held in a
	 * range and nobody sits on a single value.
	 *
	 * Both null where the prescription does not lead with heart rate: a heavy
	 * set of five is prescribed by load, and its heart rate is a consequence
	 * rather than a target. `domain/heart-rate.ts` fills the gap with the
	 * default for the movement, and prints a between-sets recovery threshold
	 * instead of a work band for resistance work.
	 */
	hr_pct_min: number | null;
	hr_pct_max: number | null;
	notes: string | null;
}

/** A program assembled with its weeks/sessions/items, as the repo returns it. */
export interface ProgramPlan {
	program: TrainingProgram;
	weeks: ProgramWeek[];
	sessions: ProgramSession[];
	items: ProgramItem[];
}

/**
 * Which program the player is currently working through.
 *
 * There is no stored `current_week`. A program week is a real calendar week:
 * week 1 is the week the player enrolled, and every Monday moves the block on
 * whether or not the previous week's sessions were done. A stored counter and
 * the calendar would disagree the first time somebody missed a week, and the
 * calendar is the one the player is actually living in — see
 * `programWeekOn` in `domain/schedule.ts`.
 *
 * `started_on` is the local calendar day of enrolment, denormalised from
 * `started_at` for the same reason `RepLog.local_date` is: week arithmetic must
 * happen in the player's own calendar, not in UTC.
 */
export interface ProgramEnrolment extends Owned, SyncMeta {
	id: Uuid;
	program_id: Uuid;
	started_at: IsoDateTime;
	started_on: IsoDate;
	completed_at: IsoDateTime | null;
}

/**
 * One program session's progress: which exercises have been ticked off, and
 * whether the session as a whole is done.
 *
 * Keyed by enrolment as well as session so that re-enrolling in a program later
 * starts from a clean slate rather than inheriting last time's ticks.
 *
 * Ticked items are an array on this row rather than a table of their own. An
 * item tick has no life of its own — it is never queried except through its
 * session, and it disappears with it — so a second table would buy nothing but
 * another thing to keep in sync. The array maps onto a Postgres `uuid[]` when
 * sync lands.
 */
export interface ProgramSessionLog extends Owned, SyncMeta {
	id: Uuid;
	enrolment_id: Uuid;
	program_session_id: Uuid;
	/** The local day this session was scheduled for, so streaks can read it by index. */
	local_date: IsoDate;
	completed_item_ids: Uuid[];
	/** Null while the session is part-done. */
	completed_at: IsoDateTime | null;
}

/**
 * Anything the sync layer pushes. Reference content is excluded — drills,
 * positions, exercises, programs and test protocols all ship with the app and
 * are read-only.
 */
export type SyncableTable =
	| 'sessions'
	| 'rep_logs'
	| 'player_profile'
	| 'program_enrolments'
	| 'program_session_logs'
	| 'test_results';

/* ------------------------------------------------------------------------- *
 * Skill tests
 *
 * A test is not a drill. A drill is something to practise, and its copy can be
 * improved whenever someone thinks of a better coaching point. A test is a
 * **protocol**: a fixed set of attempts, at fixed distances, scored by a fixed
 * rule, so that two results are comparable across months and across players.
 *
 * That makes a published protocol immutable in a stronger sense than a drill
 * id. Changing a drill's wording costs nothing; changing a protocol's
 * distances, attempt count or scoring silently invalidates every result ever
 * recorded against it, because the number stored on an old row no longer means
 * what the new protocol says it means. A protocol that needs to change is a
 * **new protocol with a new id and slug** — never an edit.
 * ------------------------------------------------------------------------- */

/**
 * The three skill tests the app measures progress with.
 *
 * A family is the thing a player thinks of as "the kicking test". It can hold
 * more than one protocol: kicking has a junior and a senior tier (only one of
 * which any player sits), and handball has an accuracy part and a speed part
 * (both of which they sit). The family is what the UI groups under one
 * heading; the protocol is what gets sat and scored.
 */
export const TEST_FAMILIES = ['kicking_accuracy', 'set_shots', 'handball'] as const;
export type TestFamily = (typeof TEST_FAMILIES)[number];

export const TEST_FAMILY_LABELS: Record<TestFamily, string> = {
	kicking_accuracy: 'Kicking accuracy',
	set_shots: 'Goalkicking set shots',
	handball: 'Handball'
};

/**
 * How a protocol turns attempts into a score.
 *
 * - `hit_miss` — one point for a hit, nothing for a miss. Kicking and handball
 *   accuracy.
 * - `goal_behind_miss` — scored like a real game: goal 6, behind 1, miss 0, so
 *   the result reads as a score line rather than a percentage.
 * - `timed_hits` — no fixed attempts at all; the result is how many hits fit
 *   inside a fixed window. Unbounded, so it has a total and no maximum.
 */
export const TEST_SCORINGS = ['hit_miss', 'goal_behind_miss', 'timed_hits'] as const;
export type TestScoring = (typeof TEST_SCORINGS)[number];

/** What one set shot is worth. A result reads as a score line: 9.4.2. */
export const GOAL = 6;
export const BEHIND = 1;
export const MISS = 0;

/** Which tier of a two-tier test a protocol is. `open` = the test has one tier. */
export const TEST_TIERS = ['junior', 'senior', 'open'] as const;
export type TestTier = (typeof TEST_TIERS)[number];

/** Left or right, of whichever limb the protocol measures. */
export type TestSide = 'left' | 'right';

/**
 * One attempt slot in a protocol — the seventh kick, at 30 m, off the left
 * foot.
 *
 * `index` is the slot's permanent identity, not its array position: a stored
 * result holds one outcome per index, so renumbering the slots would re-label
 * every outcome ever recorded. Same rule as a drill id.
 *
 * `distance_m`, `side` and `spot` are what a result is broken down by. They are
 * nullable because not every test has every dimension — a set shot has a spot
 * and no side, a timed wall test has no slots at all — and the breakdown is
 * derived from whichever of them the protocol actually populates rather than
 * configured a second time.
 */
export interface TestAttemptSpec {
	index: number;
	distance_m: number | null;
	side: TestSide | null;
	/** Named position, for set shots: 'Directly in front', 'Left pocket'. */
	spot: string | null;
}

/**
 * Reference content: a test protocol. Ships with the app, identical for
 * everyone, never owned and never pushed — same as drills, positions and
 * programs.
 */
export interface TestProtocol {
	id: Uuid;
	slug: string;
	name: string;
	family: TestFamily;
	tier: TestTier;
	/** The skill it measures, so a result sits alongside the rep logs for it. */
	category: SkillCategory;
	/**
	 * The age bands that sit this protocol. An explicit list rather than a
	 * minimum, because a tier has a ceiling as well as a floor — a senior does
	 * not sit the junior test — and because this is the single rule deciding
	 * which tier a player is shown.
	 */
	age_groups: AgeGroup[];
	scoring: TestScoring;
	summary: string;
	setup: string;
	/** The protocol itself: the rules that make results comparable. Immutable. */
	rules: string[];
	/** Display copy — what to bring. */
	equipment: string[];
	/** Structured, for the "can this player sit it yet" check. */
	equipment_required: EquipmentAccess[];
	duration_minutes: number;
	/** Every attempt, in the order they are taken. Empty for `timed_hits`. */
	attempts: TestAttemptSpec[];
	/** The window for `timed_hits`, in seconds. Null for every other scoring. */
	window_seconds: number | null;
	/**
	 * The other tier of the same test, by slug — the junior protocol names the
	 * senior one and vice versa, so the tier-transition conversion can find its
	 * counterpart. Null on a single-tier test.
	 */
	paired_slug: string | null;
}

/** One attempt's outcome: 0/1 for hit/miss, 0/1/6 for a set shot. */
export interface TestAttemptResult {
	/** The `TestAttemptSpec.index` this outcome belongs to. */
	index: number;
	score: number;
}

/**
 * A sat test. User-owned, soft-deleted and sync-stamped like every other
 * player row.
 *
 * The **parts** are stored, not a total: 30 hit/miss outcomes tagged by foot
 * and distance, or 15 shots tagged by spot. Every number the app shows —
 * overall accuracy, weak foot versus strong foot, 40 m versus 20 m, 10% over
 * baseline — is derived from them in `domain/tests.ts`. A stored total would
 * answer one question and lose the rest.
 */
export interface TestResult extends Owned, SyncMeta {
	id: Uuid;
	protocol_id: Uuid;
	/**
	 * Denormalised from the protocol so a result can be grouped and filtered
	 * without a join, and so history stays readable if a protocol is ever
	 * retired. A protocol's slug never changes, so this cannot drift.
	 */
	protocol_slug: string;
	recorded_at: IsoDateTime;
	/** Local calendar day, for the same reason `RepLog.local_date` is. */
	local_date: IsoDate;
	attempts: TestAttemptResult[];
	/** Hits inside the window, for `timed_hits`. Null for every other scoring. */
	timed_hits: number | null;
	/**
	 * The rolling baseline this result was measured against, or null when it is
	 * itself the baseline.
	 *
	 * Stamped at write time from `rollingBaseline` in `domain/tests.ts`, which
	 * is also what the UI reads — so this records the comparison that was made
	 * rather than being a second source of truth. It is stored because the
	 * aggregate "improved by 10%" metric is meant to be computed server-side
	 * from synced rows, which have no local history in hand.
	 */
	baseline_result_id: Uuid | null;
	/**
	 * 1 when this row is not a sat test but an estimated seed point, converted
	 * from the other tier at an age-group transition.
	 *
	 * Always 0 on a stored row: the seed point is derived on read by
	 * `tierSeedResult` rather than written. See the comment there for why.
	 */
	estimated: 0 | 1;
	/** The result an estimated seed point was converted from. */
	converted_from_result_id: Uuid | null;
	notes: string | null;
}

/**
 * How often the app asks for a retest. The player's choice, defaulting to four
 * weeks — long enough for training to show, short enough that a trend has
 * points in it.
 */
export const RETEST_INTERVAL_WEEKS = [2, 4, 6, 8, 12] as const;
export const DEFAULT_RETEST_INTERVAL_WEEKS = 4;

/**
 * The relative gain over baseline that counts as "improved" — 10%, the
 * product's own outcome metric.
 *
 * Relative, not percentage points: 10/30 to 11/30 is a 10% improvement on 33%,
 * and 24/30 to 27/30 is the same 10% on 80%, which is the harder thing to do
 * and the right thing to credit equally.
 */
export const IMPROVEMENT_THRESHOLD = 0.1;
