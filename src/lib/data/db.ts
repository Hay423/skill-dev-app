import Dexie, { type EntityTable, type Table } from 'dexie';
import { AGE_GROUPS, PLAYER_PROFILE_SCHEMA_VERSION } from '$lib/types';
import { localDate } from '$lib/util/time';
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
	}
}

/** The v4 age bands, mapped onto their v5 replacements. */
const RENAMED_AGE_GROUPS: Record<string, AgeGroup> = {
	u12: 'u13',
	u14: 'u15',
	u16: 'u17',
	u18: 'senior'
};

export const db = new SkillDevDb();
