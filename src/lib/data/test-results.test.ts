import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_USER_ID, type TestAttemptResult, type TestProtocol } from '$lib/types';
import { localDate } from '$lib/util/time';

/**
 * Writing a test result is the one storage path with real rules in it: the row
 * only means anything in terms of the protocol it was taken against, so an
 * attempt that is missing, doubled, or carrying a score the protocol cannot
 * award is not a slightly wrong number — it is a row that makes every
 * comparison it joins wrong.
 *
 * Tested against a real (faked) IndexedDB rather than in isolation because the
 * rules are about what is already stored: which protocol this is, and what the
 * rolling baseline was at the moment of writing.
 */
describe('saving a test result', () => {
	beforeEach(async () => {
		const { seedTestProtocols } = await import('./index');
		await seedTestProtocols();
	});

	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	async function protocols() {
		const { repo } = await import('./index');
		const kicking = await repo.getTestProtocolBySlug('kicking-accuracy-senior');
		const setShots = await repo.getTestProtocolBySlug('set-shots');
		const speed = await repo.getTestProtocolBySlug('handball-speed');
		return { kicking: kicking!, setShots: setShots!, speed: speed! };
	}

	/** `n` hits across the first `n` slots, the rest misses. */
	function attempts(protocol: TestProtocol, n: number): TestAttemptResult[] {
		return protocol.attempts.map((spec, i) => ({ index: spec.index, score: i < n ? 1 : 0 }));
	}

	it('stamps the owner, the slug and the local day', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		const saved = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 19)
		});

		expect(saved.user_id).toBe(LOCAL_USER_ID);
		expect(saved.protocol_slug).toBe('kicking-accuracy-senior');
		expect(saved.local_date).toBe(localDate());
		expect(saved._dirty).toBe(1);
		expect(saved._deleted).toBe(0);
		expect(saved.attempts).toHaveLength(30);
	});

	it('refuses a part-finished test rather than poisoning the trend with it', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		await expect(
			repo.saveTestResult({ protocol_id: kicking.id, attempts: attempts(kicking, 30).slice(0, 29) })
		).rejects.toThrow(/every attempt/i);
		expect(await repo.listTestResults()).toHaveLength(0);
	});

	it('refuses a score the protocol cannot award', async () => {
		const { repo } = await import('./index');
		const { kicking, setShots } = await protocols();

		const bad = attempts(kicking, 30);
		bad[0] = { index: 0, score: 6 };
		await expect(repo.saveTestResult({ protocol_id: kicking.id, attempts: bad })).rejects.toThrow(
			/not a valid score/i
		);

		// And the other way round: a set shot cannot score 3.
		const badShot = setShots.attempts.map((spec) => ({ index: spec.index, score: 6 }));
		badShot[0] = { index: 0, score: 3 };
		await expect(
			repo.saveTestResult({ protocol_id: setShots.id, attempts: badShot })
		).rejects.toThrow(/not a valid score/i);
	});

	it('refuses an attempt that is not part of the protocol, or one recorded twice', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		await expect(
			repo.saveTestResult({
				protocol_id: kicking.id,
				attempts: [...attempts(kicking, 30), { index: 99, score: 1 }]
			})
		).rejects.toThrow(/not part of/i);

		const doubled = attempts(kicking, 30);
		doubled[1] = { index: 0, score: 1 };
		await expect(
			repo.saveTestResult({ protocol_id: kicking.id, attempts: doubled })
		).rejects.toThrow(/twice/i);
	});

	it('refuses a timed test with no hit count', async () => {
		const { repo } = await import('./index');
		const { speed } = await protocols();

		await expect(repo.saveTestResult({ protocol_id: speed.id, attempts: [] })).rejects.toThrow(
			/hit count/i
		);
		await expect(
			repo.saveTestResult({ protocol_id: speed.id, attempts: [], timed_hits: -1 })
		).rejects.toThrow(/negative/i);
	});

	it('stores a timed test as a count and no attempts', async () => {
		const { repo } = await import('./index');
		const { speed } = await protocols();

		const saved = await repo.saveTestResult({
			protocol_id: speed.id,
			attempts: [],
			timed_hits: 27
		});
		expect(saved.timed_hits).toBe(27);
		expect(saved.attempts).toEqual([]);
	});

	it('refuses a protocol that does not exist', async () => {
		const { repo } = await import('./index');
		await expect(repo.saveTestResult({ protocol_id: 'nope', attempts: [] })).rejects.toThrow(
			/not found/i
		);
	});

	it('leaves the first result without a baseline, and points the next one at it', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		const first = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 10),
			recorded_at: '2026-03-01T00:00:00.000Z'
		});
		const second = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 11),
			recorded_at: '2026-04-01T00:00:00.000Z'
		});

		expect(first.baseline_result_id).toBeNull();
		expect(second.baseline_result_id).toBe(first.id);
	});

	it('stamps the rolling baseline, not the first result forever', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		// 10, then 12 (clears the margin and re-anchors), then 13.
		const first = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 10),
			recorded_at: '2026-03-01T00:00:00.000Z'
		});
		const second = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 12),
			recorded_at: '2026-04-01T00:00:00.000Z'
		});
		const third = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 13),
			recorded_at: '2026-05-01T00:00:00.000Z'
		});

		expect(second.baseline_result_id).toBe(first.id);
		expect(third.baseline_result_id).toBe(second.id);
	});

	it('keeps each protocol’s history to itself', async () => {
		const { repo } = await import('./index');
		const { kicking, setShots } = await protocols();

		await repo.saveTestResult({ protocol_id: kicking.id, attempts: attempts(kicking, 10) });
		const shot = await repo.saveTestResult({
			protocol_id: setShots.id,
			attempts: setShots.attempts.map((spec) => ({ index: spec.index, score: 6 }))
		});

		// A set shot is not measured against a kicking test.
		expect(shot.baseline_result_id).toBeNull();
		expect(await repo.listTestResults({ protocol_slug: 'set-shots' })).toHaveLength(1);
		expect(await repo.listTestResults()).toHaveLength(2);
	});

	it('returns results newest first', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 10),
			recorded_at: '2026-03-01T00:00:00.000Z'
		});
		await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 20),
			recorded_at: '2026-04-01T00:00:00.000Z'
		});

		const rows = await repo.listTestResults({ protocol_slug: kicking.slug });
		expect(rows.map((r) => r.recorded_at)).toEqual([
			'2026-04-01T00:00:00.000Z',
			'2026-03-01T00:00:00.000Z'
		]);
	});

	it('soft deletes a mis-scored result, so the removal can still be synced', async () => {
		const { repo } = await import('./index');
		const { db } = await import('./db');
		const { kicking } = await protocols();

		const saved = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 10)
		});
		await repo.deleteTestResult(saved.id);

		expect(await repo.listTestResults()).toHaveLength(0);
		const row = await db.test_results.get(saved.id);
		expect(row).toBeDefined();
		expect(row!._deleted).toBe(1);
		expect(row!._dirty).toBe(1);
	});

	it('does not measure a new result against a deleted one', async () => {
		const { repo } = await import('./index');
		const { kicking } = await protocols();

		const scrapped = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 28),
			recorded_at: '2026-03-01T00:00:00.000Z'
		});
		await repo.deleteTestResult(scrapped.id);

		const real = await repo.saveTestResult({
			protocol_id: kicking.id,
			attempts: attempts(kicking, 10),
			recorded_at: '2026-04-01T00:00:00.000Z'
		});
		expect(real.baseline_result_id).toBeNull();
	});
});

describe('seeding test protocols', () => {
	afterEach(async () => {
		await Dexie.delete('skill-dev');
	});

	it('is insert-only, so a protocol is never rewritten under a stored result', async () => {
		const { seedTestProtocols } = await import('./index');
		const { db } = await import('./db');

		await seedTestProtocols();
		const before = await db.test_protocols.count();

		// Stand in for a protocol that was edited in place — which must not happen,
		// and which the seeder must not do on the next boot either.
		await db.test_protocols
			.where('slug')
			.equals('kicking-accuracy-senior')
			.modify({ name: 'Edited by hand' });

		await seedTestProtocols();

		expect(await db.test_protocols.count()).toBe(before);
		const kicking = await db.test_protocols.where('slug').equals('kicking-accuracy-senior').first();
		expect(kicking!.name).toBe('Edited by hand');
	});

	it('seeds every bundled protocol exactly once across repeated boots', async () => {
		const { seedTestProtocols } = await import('./index');
		const { SEED_TEST_PROTOCOLS } = await import('./seed/tests');
		const { db } = await import('./db');

		await seedTestProtocols();
		await seedTestProtocols();

		expect(await db.test_protocols.count()).toBe(SEED_TEST_PROTOCOLS.length);
	});
});
