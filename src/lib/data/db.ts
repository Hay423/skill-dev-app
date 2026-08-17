import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
	Drill,
	Exercise,
	PlayerProfile,
	PositionProfile,
	ProgramEnrolment,
	ProgramItem,
	ProgramSession,
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
	}
}

export const db = new SkillDevDb();
