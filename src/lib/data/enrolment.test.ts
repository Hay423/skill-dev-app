import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localDate } from '$lib/util/time';

/**
 * The enrolment and ticking rules live in the repo rather than in a pure
 * function, because both are about what is already stored: which programs are
 * running, and what has been ticked before. They are tested against a real
 * (faked) IndexedDB for the same reason the seeders are — the rules are easy to
 * break with a plausible-looking change, and nothing else would catch it.
 */
describe('enrolment and session ticking', () => {
	beforeEach(async () => {
		const { seedExercises, seedPrograms } = await import('./index');
		await seedExercises();
		await seedPrograms();
	});

	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	async function programs() {
		const { db } = await import('./db');
		const strength = await db.programs.where('slug').equals('preseason-max-strength').first();
		const strength2 = await db.programs
			.where('slug')
			.equals('in-season-strength-maintenance')
			.first();
		const running = await db.programs.where('slug').equals('repeat-sprint-builder').first();
		return { strength: strength!, strength2: strength2!, running: running! };
	}

	it('runs a strength block and a running block side by side', async () => {
		const { repo } = await import('./index');
		const { strength, running } = await programs();

		await repo.enrol(strength.id);
		await repo.enrol(running.id);

		const live = await repo.activeEnrolments();
		expect(live).toHaveLength(2);
		expect(new Set(live.map((e) => e.program_id))).toEqual(new Set([strength.id, running.id]));
	});

	it('replaces only the block of the same discipline', async () => {
		const { repo } = await import('./index');
		const { strength, strength2, running } = await programs();

		await repo.enrol(strength.id);
		await repo.enrol(running.id);
		await repo.enrol(strength2.id);

		const live = await repo.activeEnrolments();
		expect(live).toHaveLength(2);
		// The running block is untouched; the first strength block is gone.
		expect(new Set(live.map((e) => e.program_id))).toEqual(new Set([strength2.id, running.id]));
		await expect(repo.activeEnrolment('strength')).resolves.toMatchObject({
			program_id: strength2.id
		});
		await expect(repo.activeEnrolment('conditioning')).resolves.toMatchObject({
			program_id: running.id
		});
	});

	it('stamps the local day of enrolment, which the calendar counts weeks from', async () => {
		const { repo } = await import('./index');
		const { strength } = await programs();
		const enrolment = await repo.enrol(strength.id);
		expect(enrolment.started_on).toBe(localDate());
	});

	it('closes off a block whose last calendar week has passed', async () => {
		const { db } = await import('./db');
		const { repo } = await import('./index');
		const { strength } = await programs();

		const enrolment = await repo.enrol(strength.id);
		// Backdate past the end of an eight-week block.
		await db.program_enrolments.update(enrolment.id, { started_on: '2020-01-06' });

		await expect(repo.activeEnrolments()).resolves.toEqual([]);
		// And the completion is recorded, not merely inferred, so the sync layer
		// has something to push and the history reads correctly.
		await expect(db.program_enrolments.get(enrolment.id)).resolves.toMatchObject({
			_dirty: 1
		});
		expect((await db.program_enrolments.get(enrolment.id))!.completed_at).not.toBeNull();
	});

	it('upserts session progress rather than piling up rows', async () => {
		const { repo } = await import('./index');
		const { strength } = await programs();
		const enrolment = await repo.enrol(strength.id);
		const plan = await repo.getProgramPlan(strength.id);
		const session = plan!.sessions[0];
		const items = plan!.items.filter((i) => i.session_id === session.id);

		await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: session.id,
			local_date: '2026-09-14',
			completed_item_ids: [items[0].id],
			completed: false
		});
		const partial = await repo.listSessionLogs();
		expect(partial).toHaveLength(1);
		expect(partial[0].completed_at).toBeNull();

		await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: session.id,
			local_date: '2026-09-14',
			completed_item_ids: items.map((i) => i.id),
			completed: true
		});
		const done = await repo.listSessionLogs();
		expect(done).toHaveLength(1);
		expect(done[0].completed_at).not.toBeNull();
		expect(done[0].completed_item_ids).toHaveLength(items.length);
	});

	it('keeps the day a session was finished on when an exercise is toggled afterwards', async () => {
		const { repo } = await import('./index');
		const { strength } = await programs();
		const enrolment = await repo.enrol(strength.id);
		const plan = await repo.getProgramPlan(strength.id);
		const session = plan!.sessions[0];
		const items = plan!.items.filter((i) => i.session_id === session.id);

		const first = await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: session.id,
			local_date: '2026-09-14',
			completed_item_ids: items.map((i) => i.id),
			completed: true
		});
		const again = await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: session.id,
			local_date: '2026-09-14',
			completed_item_ids: items.map((i) => i.id),
			completed: true
		});
		// Restamping would move the session to a different day every time an
		// exercise was unticked and ticked again.
		expect(again.completed_at).toBe(first.completed_at);
	});

	it('starts a clean slate when the same program is taken up again', async () => {
		const { repo } = await import('./index');
		const { strength } = await programs();
		const plan = await repo.getProgramPlan(strength.id);
		const session = plan!.sessions[0];

		const first = await repo.enrol(strength.id);
		await repo.logSessionProgress({
			enrolment_id: first.id,
			program_session_id: session.id,
			local_date: '2026-09-14',
			completed_item_ids: ['x'],
			completed: true
		});

		const second = await repo.enrol(strength.id);
		const logs = await repo.listSessionLogs({ enrolment_id: second.id });
		expect(logs).toEqual([]);
		// The old enrolment's record is kept, not overwritten.
		await expect(repo.listSessionLogs({ enrolment_id: first.id })).resolves.toHaveLength(1);
	});

	it('filters session logs by date range for the week strip', async () => {
		const { repo } = await import('./index');
		const { strength } = await programs();
		const enrolment = await repo.enrol(strength.id);
		const plan = await repo.getProgramPlan(strength.id);

		await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: plan!.sessions[0].id,
			local_date: '2026-09-14',
			completed_item_ids: [],
			completed: false
		});
		await repo.logSessionProgress({
			enrolment_id: enrolment.id,
			program_session_id: plan!.sessions[1].id,
			local_date: '2026-09-28',
			completed_item_ids: [],
			completed: false
		});

		const week = await repo.listSessionLogs({ from: '2026-09-14', to: '2026-09-20' });
		expect(week.map((l) => l.local_date)).toEqual(['2026-09-14']);
	});
});
