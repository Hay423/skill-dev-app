import Dexie, { type EntityTable, type Table } from 'dexie';
import { AGE_GROUPS, LOCAL_USER_ID, PLAYER_PROFILE_SCHEMA_VERSION } from '$lib/types';
import { localDate } from '$lib/util/time';
import { SEED_DRILLS } from './seed/drills';
import type {
	AgeGroup,
	Drill,
	Exercise,
	PlayerProfile,
	PositionProfile,
	ProgramEnrolment,
	ProgramItem,
	ProgramSession,
	ProgramSessionLog,
	ProgramWeek,
	RepLog,
	Session,
	TrainingProgram,
	Uuid
} from '$lib/types';

/**
 * IndexedDB schema.
 *
 * Indexes exist for the queries the app actually runs: rep logs by day (streaks
 * and the "today" view), by category (progress rollups) and by session; plus
 * `_dirty` on both user tables so the future sync layer can find pending rows
 * in one indexed scan rather than a full table walk.
 *
 * v2 adds the player-profile and content tables in one bump (see
 * plans/player-profile.md) even though content import (positions, exercises,
 * programs) lands in a later phase — Dexie versions are cheap, and this way a
 * v1 user upgrades once rather than once per phase.
 */
export class SkillDevDb extends Dexie {
	drills!: EntityTable<Drill, 'id'>;
	sessions!: EntityTable<Session, 'id'>;
	rep_logs!: EntityTable<RepLog, 'id'>;
	player_profile!: EntityTable<PlayerProfile, 'id'>;
	positions!: EntityTable<PositionProfile, 'position'>;
	exercises!: EntityTable<Exercise, 'id'>;
	programs!: EntityTable<TrainingProgram, 'id'>;
	// Compound-keyed on [program_id+week_number]; ProgramWeek has no `id` field.
	program_weeks!: Table<ProgramWeek, [Uuid, number]>;
	program_sessions!: EntityTable<ProgramSession, 'id'>;
	program_items!: EntityTable<ProgramItem, 'id'>;
	program_enrolments!: EntityTable<ProgramEnrolment, 'id'>;
	program_session_logs!: EntityTable<ProgramSessionLog, 'id'>;

	constructor() {
		super('skill-dev');

		this.version(1).stores({
			drills: 'id, &slug, category, difficulty',
			sessions: 'id, local_date, started_at, completed_at, _dirty',
			rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty'
		});

		this.version(2).stores({
			// Unchanged tables must still be listed or Dexie drops them.
			drills: 'id, &slug, category, difficulty',
			sessions: 'id, local_date, started_at, completed_at, _dirty',
			rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
			// New.
			player_profile: 'id, _dirty',
			positions: '&position, group',
			exercises: 'id, &slug, movement_pattern',
			programs: 'id, &slug, discipline, phase',
			program_weeks: '[program_id+week_number], program_id',
			program_sessions: 'id, program_id, week_number',
			program_items: 'id, session_id',
			program_enrolments: 'id, program_id, completed_at, _dirty'
		});

		// v3 adds `active` (soft-hide) and `source` (seed/custom) to drills so the
		// admin library can edit, hide and add drills without ever recycling an id
		// that a rep log might reference. Existing rows backfill as visible seed
		// content.
		this.version(3)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await tx
					.table('drills')
					.toCollection()
					.modify((d) => {
						d.active = 1;
						d.source = 'seed';
					});
			});

		// v4 purges injury flags. Collecting a body region and an injury status
		// is collecting health data, which is what drives the app's privacy
		// obligations, so the feature was forked out to `src/lib/injuries/`
		// (dormant) and the stored data is deleted here rather than left to
		// linger on devices that never save their profile again.
		//
		// This upgrade must stay even if injuries return: a v4 user has already
		// had the key removed, so re-enabling is a fresh write, not a restore.
		// No index changes — `injuries` was only ever a property on the row.
		this.version(4)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await tx
					.table('player_profile')
					.toCollection()
					.modify((profile) => {
						delete profile.injuries;
						profile.schema_version = 2;
					});
			});

		// v5 renames the junior age bands to match how community football
		// actually grades them: U12/U14/U16/U18 become U13/U15/U17/Seniors, and
		// U11 is added below them. The values are the primary key of a data rule
		// — `AGE_GROUPS` order drives every age gate — so a stored profile
		// carrying an old value has to be rewritten rather than mapped at read
		// time, or the gate silently fails open on a band it does not recognise.
		//
		// `u18` folds into `senior` because the new taxonomy has no U18: an 18
		// year old is a senior. That is a widening of access (full programs
		// instead of gated ones) for the only band where it is safe.
		//
		// The content tables are deliberately not touched: `exercises` and
		// `programs` have been empty in every released version — their seeds
		// land in this same change — so no stored row can carry an old band.
		//
		// v5 also indexes `program_enrolments.started_at`, which `activeEnrolment`
		// has sorted on since Phase 1. Dexie throws `SchemaError` on an unindexed
		// `orderBy`, so that call has always been broken — it was simply never
		// reached until Phase 4 gave enrolment a UI.
		this.version(5)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await tx
					.table('player_profile')
					.toCollection()
					.modify((profile) => {
						const renamed = RENAMED_AGE_GROUPS[profile.age_group as string];
						// An unrecognised value lands on the most conservative band
						// rather than staying unmapped: a profile the age gate cannot
						// read is a profile the age gate cannot protect.
						if (renamed) profile.age_group = renamed;
						else if (!(AGE_GROUPS as readonly string[]).includes(profile.age_group)) {
							profile.age_group = 'u11';
						}
						profile.schema_version = PLAYER_PROFILE_SCHEMA_VERSION;
					});
			});

		// v6 adds session ticking, and with it a calendar.
		//
		// `program_session_logs` is the new user-owned table: one row per session
		// per enrolment, holding the ticked exercises and whether the session is
		// finished. Indexed on `local_date` because the streak and the week strip
		// both slice by day, and on `_dirty` like every other syncable table.
		//
		// `program_enrolments` changes shape at the same time. `current_week` is
		// gone and `started_on` replaces it: a program week is now a real calendar
		// week counted from enrolment, so a stored counter would be a second
		// source of truth that drifts the first time a week is missed. Existing
		// rows backfill `started_on` from `started_at` in the player's own
		// timezone — which is the timezone the counter was always implicitly in.
		this.version(6)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await tx
					.table('program_enrolments')
					.toCollection()
					.modify((enrolment) => {
						enrolment.started_on = localDate(enrolment.started_at);
						delete enrolment.current_week;
					});
			});

		// v7 indexes `user_id` on every syncable table and backfills the rows
		// written before there was an owner to stamp.
		//
		// `user_id` has been on these rows since v1, but always `null`, which
		// made it dead weight: IndexedDB rejects `null` as a key, so a row with a
		// null `user_id` is simply absent from a `user_id` index — the index
		// would have been empty. Backfilling to `LOCAL_USER_ID` is what makes it
		// queryable, and it is the migration that would otherwise have had to
		// happen at first sign-in, under a network, against rows already being
		// pushed.
		//
		// After this, "rows belonging to the current user" is an indexed lookup
		// in every table, and first sign-in is a rewrite of one known value
		// rather than a scan for absent ones.
		//
		// Reference tables (drills, positions, exercises, programs and the
		// program subtree) are deliberately untouched: they ship with the app,
		// are identical for everyone, and are never pushed. Giving them an owner
		// would imply a per-user copy that does not exist.
		this.version(7)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await Promise.all(
					OWNED_TABLES.map((table) =>
						tx
							.table(table)
							.toCollection()
							.modify((row) => {
								// Only fills a gap. A row that somehow already carries a
								// real owner (a restored backup, a future re-import) keeps
								// it — this migration must never reassign someone's data.
								if (!row.user_id) row.user_id = LOCAL_USER_ID;
							})
					)
				);
			});

		// v8 adds heart rate bands to program items, and plyometrics as a third
		// discipline alongside strength and conditioning.
		//
		// The program subtree is cleared rather than patched, so `seedPrograms`
		// rewrites it from `seed/programs.ts` on the next boot. That is the only
		// honest option: `hr_pct_min`/`hr_pct_max` are authored content, not
		// something a migration can compute from a stored row, and leaving the
		// existing rows in place would mean the same program prescribed different
		// heart rates on a device that had already seeded it than on a fresh
		// install.
		//
		// Clearing it is safe because none of it is user data and none of the ids
		// move. Programs carry hard-coded UUIDs and their weeks, sessions and
		// items are derived from those by `childId`, so a re-seed reproduces every
		// id exactly. An enrolment points at a `program_id` and a session log at a
		// `program_session_id` and a list of item ids, and all three still resolve
		// afterwards — a player mid-block keeps their week and their ticks.
		//
		// Enrolments and session logs are therefore deliberately untouched. No
		// index changes: a heart rate band is read off an item that has already
		// been fetched, never queried across.
		this.version(8)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await Promise.all(PROGRAM_CONTENT_TABLES.map((table) => tx.table(table).clear()));
			});

		// v9 backfills `equipment_required` onto the bundled drills.
		//
		// The field has existed on `Drill` since the Phase 3 eligibility work but
		// no seed drill ever set it, so it did nothing. It now also drives the
		// player's own "where am I" filter, which means an empty value is the
		// difference between a filter that works and one that silently keeps
		// everything.
		//
		// A migration rather than a change to `seedDrills`, because that seeder is
		// insert-only on purpose: it is what lets admin edits and hidden state
		// survive a boot, and making it overwrite would undo that for the sake of
		// one field.
		//
		// Only fills a gap. A drill someone already edited keeps whatever they
		// chose, and custom drills are left alone entirely — there is no seed to
		// read a value from. The one case this gets wrong is a seed drill an admin
		// deliberately saved with *no* requirement before this version, since the
		// form writes `[]` either way and an empty array is indistinguishable from
		// an unanswered one. That is one tick to put back, against a library-wide
		// filter that would otherwise do nothing.
		//
		// No index changes: a requirement is read off a drill already in hand,
		// never queried across.
		this.version(9)
			.stores({
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
			})
			.upgrade(async (tx) => {
				const required = new Map(
					SEED_DRILLS.map((drill) => [drill.id, drill.equipment_required ?? []])
				);
				await tx
					.table('drills')
					.toCollection()
					.modify((drill) => {
						if (drill.equipment_required?.length) return;
						const value = required.get(drill.id);
						if (value?.length) drill.equipment_required = [...value];
					});
			});

		// v10 wraps every program session in a warm-up and a cool-down.
		//
		// Items gain a `section` and sessions gain the names and lengths of the
		// routines stamped into them — authored content again, so the program
		// subtree is cleared for `seedPrograms` to rewrite, exactly as v8 did.
		//
		// Unlike v8, some item ids do move: the ad-hoc warm-up drills that used to
		// open a session's main work are gone, and ids are derived from position.
		// A session log's `completed_item_ids` may therefore hold ids that no
		// longer resolve. That is harmless — a tick is only ever read against the
		// session's current items, so a stale one is ignored rather than
		// miscounted — and a session already finished stays finished, because
		// `completed_at` is on the log, not derived from the ticks. What a player
		// mid-week loses is the ticks on a part-done session, which is the
		// trade that was agreed for getting warm-ups out of the main work.
		//
		// The new mobility exercises need no migration: `seedExercises` is
		// insert-only by id and adds them on the next boot.
		this.version(10)
			.stores({
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
			})
			.upgrade(async (tx) => {
				await Promise.all(PROGRAM_CONTENT_TABLES.map((table) => tx.table(table).clear()));
			});
	}
}

/**
 * Tables whose rows carry an owner. Mirrors `SyncableTable` in `$lib/types` —
 * the same set, because "is owned by a user" and "gets pushed to the server"
 * are the same property here.
 */
const OWNED_TABLES = [
	'sessions',
	'rep_logs',
	'player_profile',
	'program_enrolments',
	'program_session_logs'
] as const;

/**
 * The bundled program subtree: reference content, rewritten from the seed
 * whenever its shape changes.
 *
 * Distinct from `OWNED_TABLES` in exactly the way that matters here — nothing in
 * these tables belongs to anybody, so clearing them loses nothing and the
 * seeder puts every row back with the same id it had.
 */
const PROGRAM_CONTENT_TABLES = [
	'programs',
	'program_weeks',
	'program_sessions',
	'program_items'
] as const;

/** The v4 age bands, mapped onto their v5 replacements. */
const RENAMED_AGE_GROUPS: Record<string, AgeGroup> = {
	u12: 'u13',
	u14: 'u15',
	u16: 'u17',
	u18: 'senior'
};

export const db = new SkillDevDb();
