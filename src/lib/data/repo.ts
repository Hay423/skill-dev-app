import type {
	AgeGroup,
	Difficulty,
	Drill,
	EquipmentAccess,
	Exercise,
	ExperienceLevel,
	InjuryFlag,
	IsoDate,
	MovementPattern,
	PlayerProfile,
	Position,
	PositionProfile,
	ProgramEnrolment,
	ProgramPlan,
	RepLog,
	Session,
	SkillCategory,
	TrainingProgram,
	Uuid,
	Weekday
} from '$lib/types';

/**
 * The seam between the UI and storage.
 *
 * Every read and write in the app goes through this interface, so swapping the
 * Dexie implementation for a Supabase-backed one (or a local-first repo that
 * writes through to Supabase) is a single change in `src/lib/data/index.ts`.
 * Nothing above this line may import Dexie directly.
 */
export interface Repo {
	// --- drills (reference data, editable via the admin library) ---
	/** `includeHidden` is for the admin library; every other caller wants the default (active only). */
	listDrills(filter?: {
		category?: SkillCategory;
		includeHidden?: boolean;
	}): Promise<Drill[]>;
	getDrill(id: Uuid): Promise<Drill | undefined>;
	getDrillBySlug(slug: string): Promise<Drill | undefined>;
	createDrill(input: DrillInput): Promise<Drill>;
	updateDrill(id: Uuid, input: DrillInput): Promise<Drill>;
	/** Soft-hide/show. Never deletes the row — rep logs may reference its id. */
	setDrillActive(id: Uuid, active: boolean): Promise<void>;
	/** Bulk add/update by slug, for the admin library's file-upload path. */
	importDrills(inputs: DrillInput[]): Promise<{ created: number; updated: number }>;

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

	// --- player profile ---
	/** The singleton profile row, or `undefined` before onboarding has ever run. */
	getProfile(): Promise<PlayerProfile | undefined>;
	saveProfile(input: ProfileInput): Promise<PlayerProfile>;

	// --- position/content reference data (populated by the Phase 2 importer) ---
	listPositions(): Promise<PositionProfile[]>;
	listExercises(filter?: {
		movement_pattern?: MovementPattern;
		equipment_access?: EquipmentAccess[];
	}): Promise<Exercise[]>;
	listPrograms(filter?: {
		discipline?: TrainingProgram['discipline'];
		phase?: TrainingProgram['phase'];
	}): Promise<TrainingProgram[]>;
	getProgramPlan(program_id: Uuid): Promise<ProgramPlan | undefined>;

	// --- program enrolment ---
	activeEnrolment(): Promise<ProgramEnrolment | undefined>;
	enrol(program_id: Uuid): Promise<ProgramEnrolment>;
	advanceWeek(enrolment_id: Uuid): Promise<ProgramEnrolment | undefined>;
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

/**
 * Input to `createDrill`/`updateDrill`/`importDrills`.
 *
 * `slug` is optional on create (derived from `name` if omitted) and ignored on
 * update — a drill's slug, like its id, never changes once assigned. On
 * `importDrills`, a row whose `slug` matches an existing drill updates it in
 * place; otherwise a new drill is created.
 */
export interface DrillInput {
	slug?: string;
	name: string;
	category: SkillCategory;
	summary: string;
	setup: string;
	coaching_points: string[];
	equipment: string[];
	min_players: number;
	duration_minutes: number;
	difficulty: Difficulty;
	tracks_reps: boolean;
	target_reps: number | null;
	position_tags?: Position[];
	equipment_required?: EquipmentAccess[];
}

/** Input to `saveProfile`. A full replace of editable fields, not a patch. */
export interface ProfileInput {
	display_name?: string | null;
	primary_position: Position;
	secondary_position?: Position | null;
	age_group: AgeGroup;
	date_of_birth?: IsoDate | null;
	experience: ExperienceLevel;
	sessions_per_week?: number;
	available_days?: Weekday[];
	equipment_access?: EquipmentAccess[];
	injuries?: InjuryFlag[];
}
