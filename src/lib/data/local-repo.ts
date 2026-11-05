import {
	DEFAULT_RETEST_INTERVAL_WEEKS,
	PLAYER_PROFILE_SCHEMA_VERSION,
	SINGLETON_PROFILE_ID,
	type Drill,
	type EquipmentAccess,
	type Exercise,
	type PlayerProfile,
	type IsoDate,
	type ProgramEnrolment,
	type ProgramSessionLog,
	type RepLog,
	type Session,
	type SyncMeta,
	type TestProtocol,
	type TestResult,
	type TrainingProgram,
	type Uuid
} from '$lib/types';
import { localDate, newId, nowIso } from '$lib/util/time';
import { db } from './db';
import { programWeekOn } from '$lib/domain/schedule';
import { currentBaseline, isComplete } from '$lib/domain/tests';
import type {
	DrillInput,
	NewRepLog,
	NewTestResult,
	ProfileInput,
	Repo,
	SessionProgressInput
} from './repo';
import { currentUserId } from './user';

/** Lowercase, hyphenated, alphanumeric-only — matches the seed library's slugs. */
function slugify(text: string): string {
	const base = text
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'drill';
}

/** Sync bookkeeping for a freshly created, not-yet-pushed row. */
function freshMeta(at = nowIso()): SyncMeta {
	return { created_at: at, updated_at: at, synced_at: null, _dirty: 1, _deleted: 0 };
}

/**
 * Dexie-backed repository. The only module in the app that touches `db`
 * directly, apart from the seeder.
 */
export class LocalRepo implements Repo {
	async listDrills(filter?: {
		category?: Drill['category'];
		includeHidden?: boolean;
	}): Promise<Drill[]> {
		let drills = filter?.category
			? await db.drills.where('category').equals(filter.category).toArray()
			: await db.drills.toArray();
		if (!filter?.includeHidden) drills = drills.filter((d) => d.active === 1);
		return drills.sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
	}

	getDrill(id: Uuid) {
		return db.drills.get(id);
	}

	getDrillBySlug(slug: string) {
		return db.drills.where('slug').equals(slug).first();
	}

	/** Builds the new/updated row's content fields from `DrillInput`, leaving id/slug/active/source to the caller. */
	private drillFields(input: DrillInput) {
		return {
			name: input.name,
			category: input.category,
			summary: input.summary,
			setup: input.setup,
			coaching_points: input.coaching_points,
			equipment: input.equipment,
			min_players: input.min_players,
			duration_minutes: input.duration_minutes,
			difficulty: input.difficulty,
			tracks_reps: input.tracks_reps,
			target_reps: input.target_reps,
			position_tags: input.position_tags ?? [],
			equipment_required: input.equipment_required ?? []
		};
	}

	private async uniqueSlug(base: string): Promise<string> {
		const root = slugify(base);
		let slug = root;
		let suffix = 2;
		while (await db.drills.where('slug').equals(slug).first()) {
			slug = `${root}-${suffix++}`;
		}
		return slug;
	}

	async createDrill(input: DrillInput): Promise<Drill> {
		const slug = await this.uniqueSlug(input.slug || input.name);
		const drill: Drill = {
			id: newId(),
			slug,
			active: 1,
			source: 'custom',
			...this.drillFields(input)
		};
		await db.drills.add(drill);
		return drill;
	}

	async updateDrill(id: Uuid, input: DrillInput): Promise<Drill> {
		const existing = await db.drills.get(id);
		if (!existing) throw new Error('Drill not found');
		const updated: Drill = { ...existing, ...this.drillFields(input) };
		await db.drills.put(updated);
		return updated;
	}

	async setDrillActive(id: Uuid, active: boolean): Promise<void> {
		await db.drills.update(id, { active: active ? 1 : 0 });
	}

	async importDrills(inputs: DrillInput[]): Promise<{ created: number; updated: number }> {
		let created = 0;
		let updated = 0;
		for (const input of inputs) {
			const existing = input.slug ? await this.getDrillBySlug(input.slug) : undefined;
			if (existing) {
				await this.updateDrill(existing.id, input);
				updated++;
			} else {
				await this.createDrill(input);
				created++;
			}
		}
		return { created, updated };
	}

	async startSession(input: { drill_ids: Uuid[]; notes?: string | null }): Promise<Session> {
		const at = nowIso();
		const session: Session = {
			id: newId(),
			user_id: currentUserId(),
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
			user_id: currentUserId(),
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

	async getProfile(): Promise<PlayerProfile | undefined> {
		const row = await db.player_profile.get(SINGLETON_PROFILE_ID);
		return row && row._deleted === 0 ? row : undefined;
	}

	async saveProfile(input: ProfileInput): Promise<PlayerProfile> {
		const existing = await db.player_profile.get(SINGLETON_PROFILE_ID);
		const at = nowIso();
		const profile: PlayerProfile = {
			id: SINGLETON_PROFILE_ID,
			user_id: existing?.user_id ?? currentUserId(),
			display_name: input.display_name ?? null,
			primary_position: input.primary_position,
			secondary_position: input.secondary_position ?? null,
			age_group: input.age_group,
			date_of_birth: input.date_of_birth ?? null,
			experience: input.experience,
			sessions_per_week: input.sessions_per_week ?? 0,
			available_days: input.available_days ?? [],
			equipment_access: input.equipment_access ?? [],
			retest_interval_weeks:
				input.retest_interval_weeks ??
				existing?.retest_interval_weeks ??
				DEFAULT_RETEST_INTERVAL_WEEKS,
			schema_version: PLAYER_PROFILE_SCHEMA_VERSION,
			created_at: existing?.created_at ?? at,
			updated_at: at,
			synced_at: existing?.synced_at ?? null,
			_dirty: 1,
			_deleted: 0
		};
		await db.player_profile.put(profile);
		return profile;
	}

	listPositions() {
		return db.positions.toArray();
	}

	async getDisplayName(): Promise<string | null> {
		const profile = await this.getProfile();
		return profile?.display_name ?? null;
	}

	async listExercises(filter?: {
		movement_pattern?: Exercise['movement_pattern'];
		equipment_access?: EquipmentAccess[];
	}) {
		let rows = filter?.movement_pattern
			? await db.exercises.where('movement_pattern').equals(filter.movement_pattern).toArray()
			: await db.exercises.toArray();
		if (filter?.equipment_access) {
			const owned = new Set(filter.equipment_access);
			rows = rows.filter((e) => e.equipment_required.every((eq) => owned.has(eq)));
		}
		return rows;
	}

	async listPrograms(filter?: {
		discipline?: TrainingProgram['discipline'];
		phase?: TrainingProgram['phase'];
	}) {
		let rows = await db.programs.toArray();
		if (filter?.discipline) rows = rows.filter((p) => p.discipline === filter.discipline);
		if (filter?.phase) rows = rows.filter((p) => p.phase === filter.phase);
		return rows;
	}

	async getProgramPlanBySlug(slug: string) {
		const program = await db.programs.where('slug').equals(slug).first();
		return program ? this.getProgramPlan(program.id) : undefined;
	}

	async getProgramPlan(program_id: Uuid) {
		const program = await db.programs.get(program_id);
		if (!program) return undefined;
		const [weeks, sessions] = await Promise.all([
			db.program_weeks.where('program_id').equals(program_id).toArray(),
			db.program_sessions.where('program_id').equals(program_id).toArray()
		]);
		const sessionIds = sessions.map((s) => s.id);
		const items = sessionIds.length
			? await db.program_items.where('session_id').anyOf(sessionIds).toArray()
			: [];
		return { program, weeks, sessions, items };
	}

	/**
	 * Every program still running, newest first.
	 *
	 * A block that has run past its final calendar week is closed off here
	 * rather than in the UI. Programs end by the calendar, so something has to
	 * notice the date has passed, and doing it on read means the completion is
	 * recorded once — with a `_dirty` flag for the sync layer — instead of being
	 * recomputed as a maybe by every caller.
	 */
	async activeEnrolments(): Promise<ProgramEnrolment[]> {
		const rows = await db.program_enrolments.orderBy('started_at').reverse().toArray();
		const open = rows.filter((e) => e.completed_at === null && e._deleted === 0);
		const today = localDate();

		const live: ProgramEnrolment[] = [];
		for (const enrolment of open) {
			const program = await db.programs.get(enrolment.program_id);
			if (!program) continue;
			if (programWeekOn(enrolment, today) > program.weeks) {
				const at = nowIso();
				await db.program_enrolments.update(enrolment.id, {
					completed_at: at,
					updated_at: at,
					_dirty: 1
				});
				continue;
			}
			live.push(enrolment);
		}
		return live;
	}

	async activeEnrolment(
		discipline?: TrainingProgram['discipline']
	): Promise<ProgramEnrolment | undefined> {
		const live = await this.activeEnrolments();
		if (!discipline) return live[0];
		for (const enrolment of live) {
			const program = await db.programs.get(enrolment.program_id);
			if (program?.discipline === discipline) return enrolment;
		}
		return undefined;
	}

	/**
	 * Starting a program ends the one already running in the same discipline,
	 * and only that one — a strength block and a running block are meant to run
	 * side by side, which is what lets the calendar say "lift Tuesday, run
	 * Thursday". Two blocks of the same discipline is a different thing: it is
	 * twice the load with no plan behind it.
	 */
	async enrol(program_id: Uuid): Promise<ProgramEnrolment> {
		const program = await db.programs.get(program_id);
		if (!program) throw new Error('Program not found');

		const current = await this.activeEnrolment(program.discipline);
		if (current) await this.abandonEnrolment(current.id);

		const at = nowIso();
		const enrolment: ProgramEnrolment = {
			id: newId(),
			user_id: currentUserId(),
			program_id,
			started_at: at,
			started_on: localDate(at),
			completed_at: null,
			...freshMeta(at)
		};
		await db.program_enrolments.add(enrolment);
		return enrolment;
	}

	/** Soft delete, so leaving a program can still be replayed to the server. */
	async abandonEnrolment(enrolment_id: Uuid): Promise<void> {
		await db.program_enrolments.update(enrolment_id, {
			_deleted: 1,
			_dirty: 1,
			updated_at: nowIso()
		});
	}

	/**
	 * Upsert one session's progress, keyed by (enrolment, session) so a second
	 * run through the same program starts with a clean slate.
	 */
	async logSessionProgress(input: SessionProgressInput): Promise<ProgramSessionLog> {
		const existing = await db.program_session_logs
			.where('program_session_id')
			.equals(input.program_session_id)
			.and((row) => row.enrolment_id === input.enrolment_id)
			.first();

		const at = nowIso();
		const log: ProgramSessionLog = {
			id: existing?.id ?? newId(),
			user_id: existing?.user_id ?? currentUserId(),
			enrolment_id: input.enrolment_id,
			program_session_id: input.program_session_id,
			local_date: input.local_date,
			// Copied, not stored by reference. Callers pass arrays straight out of
			// Svelte 5 `$state`, and a reactive proxy is not structured-cloneable —
			// IndexedDB throws `DataCloneError` on one. Spreading here makes the
			// whole class of bug impossible at the seam rather than relying on
			// every call site to remember `$state.snapshot`.
			completed_item_ids: [...input.completed_item_ids],
			// Kept rather than restamped, so the day a session was finished on
			// does not move every time an exercise is unticked and ticked again.
			completed_at: input.completed ? (existing?.completed_at ?? at) : null,
			created_at: existing?.created_at ?? at,
			updated_at: at,
			synced_at: existing?.synced_at ?? null,
			_dirty: 1,
			_deleted: 0
		};
		await db.program_session_logs.put(log);
		return log;
	}

	async listSessionLogs(filter?: {
		from?: IsoDate;
		to?: IsoDate;
		enrolment_id?: Uuid;
	}): Promise<ProgramSessionLog[]> {
		let rows: ProgramSessionLog[];
		if (filter?.enrolment_id) {
			rows = await db.program_session_logs
				.where('enrolment_id')
				.equals(filter.enrolment_id)
				.toArray();
		} else if (filter?.from || filter?.to) {
			rows = await db.program_session_logs
				.where('local_date')
				.between(filter.from ?? '0000-00-00', filter.to ?? '9999-99-99', true, true)
				.toArray();
		} else {
			rows = await db.program_session_logs.toArray();
		}
		return rows.filter(notDeleted);
	}

	listTestProtocols(): Promise<TestProtocol[]> {
		return db.test_protocols.toArray();
	}

	getTestProtocolBySlug(slug: string): Promise<TestProtocol | undefined> {
		return db.test_protocols.where('slug').equals(slug).first();
	}

	/**
	 * Record a sat test.
	 *
	 * Validation is deliberately strict here rather than left to the runner. A
	 * result is the one row in the app whose meaning comes entirely from the
	 * protocol it was taken against: a missing attempt, a duplicated slot or a
	 * score of 3 on a hit/miss test is not a slightly wrong number, it is a row
	 * that makes every comparison it takes part in wrong. The runner cannot be
	 * the only thing standing between that and the trend line.
	 */
	async saveTestResult(input: NewTestResult): Promise<TestResult> {
		const protocol = await db.test_protocols.get(input.protocol_id);
		if (!protocol) throw new Error('Test protocol not found');

		const slots = new Set(protocol.attempts.map((spec) => spec.index));
		const seen = new Set<number>();
		const legal = legalScores(protocol);
		for (const attempt of input.attempts) {
			if (!slots.has(attempt.index)) {
				throw new Error(`Attempt ${attempt.index} is not part of ${protocol.slug}`);
			}
			if (seen.has(attempt.index)) {
				throw new Error(`Attempt ${attempt.index} was recorded twice`);
			}
			if (!legal.includes(attempt.score)) {
				throw new Error(`${attempt.score} is not a valid score for ${protocol.slug}`);
			}
			seen.add(attempt.index);
		}
		if (!isComplete(protocol, input.attempts)) {
			throw new Error('Every attempt in the protocol must be scored');
		}

		const timed = protocol.scoring === 'timed_hits';
		if (timed && (input.timed_hits === undefined || input.timed_hits === null)) {
			throw new Error('A timed test needs a hit count');
		}
		if (timed && input.timed_hits! < 0) throw new Error('Hit count cannot be negative');

		// The baseline is read from the history this result is about to join, by
		// the same function the UI reads it with — so the stored id records the
		// comparison that was actually shown, rather than being a second opinion.
		const history = await this.listTestResults({ protocol_slug: protocol.slug });
		const baseline = currentBaseline(protocol, history);

		const at = input.recorded_at ?? nowIso();
		const result: TestResult = {
			id: newId(),
			user_id: currentUserId(),
			protocol_id: protocol.id,
			protocol_slug: protocol.slug,
			recorded_at: at,
			local_date: localDate(at),
			// Copied, not stored by reference: callers pass arrays out of Svelte 5
			// `$state`, and a reactive proxy is not structured-cloneable. Same
			// reasoning as `logSessionProgress`.
			attempts: input.attempts.map((a) => ({ index: a.index, score: a.score })),
			timed_hits: timed ? (input.timed_hits ?? 0) : null,
			baseline_result_id: baseline?.id ?? null,
			estimated: 0,
			converted_from_result_id: null,
			notes: input.notes ?? null,
			...freshMeta(at)
		};
		await db.test_results.add(result);
		return result;
	}

	async listTestResults(filter?: {
		protocol_slug?: string;
		from?: IsoDate;
		to?: IsoDate;
		limit?: number;
	}): Promise<TestResult[]> {
		let rows: TestResult[];
		if (filter?.protocol_slug) {
			rows = await db.test_results.where('protocol_slug').equals(filter.protocol_slug).toArray();
		} else if (filter?.from || filter?.to) {
			rows = await db.test_results
				.where('local_date')
				.between(filter.from ?? '0000-00-00', filter.to ?? '9999-99-99', true, true)
				.toArray();
		} else {
			rows = await db.test_results.toArray();
		}

		rows = rows.filter(notDeleted);
		if (filter?.protocol_slug && (filter.from || filter.to)) {
			const from = filter.from ?? '0000-00-00';
			const to = filter.to ?? '9999-99-99';
			rows = rows.filter((r) => r.local_date >= from && r.local_date <= to);
		}
		rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
		return filter?.limit ? rows.slice(0, filter.limit) : rows;
	}

	/** Soft delete, so the removal can still be replayed to the server. */
	async deleteTestResult(id: Uuid): Promise<void> {
		await db.test_results.update(id, { _deleted: 1, _dirty: 1, updated_at: nowIso() });
	}
}

/** The only scores one attempt of this protocol can legally carry. */
function legalScores(protocol: TestProtocol): number[] {
	switch (protocol.scoring) {
		case 'hit_miss':
			return [0, 1];
		case 'goal_behind_miss':
			return [0, 1, 6];
		case 'timed_hits':
			return [];
	}
}

function notDeleted<T extends { _deleted: 0 | 1 }>(row: T): boolean {
	return row._deleted === 0;
}
