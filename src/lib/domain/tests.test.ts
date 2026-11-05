import { describe, expect, it } from 'vitest';
import { SEED_TEST_PROTOCOLS } from '$lib/data/seed/tests';
import {
	DEFAULT_RETEST_INTERVAL_WEEKS,
	LOCAL_USER_ID,
	type AgeGroup,
	type EquipmentAccess,
	type PlayerProfile,
	type TestAttemptResult,
	type TestProtocol,
	type TestResult
} from '$lib/types';
import {
	attemptLabel,
	attemptNoun,
	availableProtocols,
	baselinePhase,
	breakdown,
	comparableScore,
	currentBaseline,
	formatGain,
	gainOver,
	groupByFamily,
	improvedOver,
	isComplete,
	maxAttemptScore,
	missingEquipment,
	protocolsByFamily,
	protocolsForAgeGroup,
	rollingBaseline,
	scoreLine,
	scoreResult,
	formatScoreLine,
	sideNoun,
	strongerSide,
	tierSeedResult
} from './tests';

function protocol(slug: string): TestProtocol {
	const found = SEED_TEST_PROTOCOLS.find((p) => p.slug === slug);
	if (!found) throw new Error(`No seed protocol ${slug}`);
	return found;
}

const SENIOR_KICK = protocol('kicking-accuracy-senior');
const JUNIOR_KICK = protocol('kicking-accuracy-junior');
const SET_SHOTS = protocol('set-shots');
const HANDBALL_SPEED = protocol('handball-speed');

/** A result against `p`, with `scores` applied to the slots in protocol order. */
function result(
	p: TestProtocol,
	scores: number[],
	overrides: Partial<TestResult> = {}
): TestResult {
	const attempts: TestAttemptResult[] = p.attempts.map((spec, i) => ({
		index: spec.index,
		score: scores[i] ?? 0
	}));
	return {
		id: `result-${p.slug}-${scores.join('')}`.slice(0, 60),
		user_id: LOCAL_USER_ID,
		protocol_id: p.id,
		protocol_slug: p.slug,
		recorded_at: '2026-03-01T00:00:00.000Z',
		local_date: '2026-03-01',
		attempts,
		timed_hits: null,
		baseline_result_id: null,
		estimated: 0,
		converted_from_result_id: null,
		notes: null,
		created_at: '2026-03-01T00:00:00.000Z',
		updated_at: '2026-03-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

/** `n` hits spread across the first `n` slots of a 30-attempt hit/miss test. */
function hits(p: TestProtocol, n: number, overrides: Partial<TestResult> = {}): TestResult {
	return result(
		p,
		p.attempts.map((_, i) => (i < n ? 1 : 0)),
		overrides
	);
}

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
	return {
		id: 'me',
		user_id: LOCAL_USER_ID,
		display_name: null,
		primary_position: 'inside_midfielder',
		secondary_position: null,
		age_group: 'senior',
		date_of_birth: null,
		experience: 'experienced',
		sessions_per_week: 3,
		available_days: [],
		equipment_access: ['oval', 'goals', 'wall'],
		retest_interval_weeks: DEFAULT_RETEST_INTERVAL_WEEKS,
		schema_version: 4,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		synced_at: null,
		_dirty: 1,
		_deleted: 0,
		...overrides
	};
}

describe('the seeded protocols', () => {
	it('gives every attempt slot a unique, contiguous index', () => {
		for (const p of SEED_TEST_PROTOCOLS) {
			const indexes = p.attempts.map((a) => a.index);
			expect(new Set(indexes).size, p.slug).toBe(indexes.length);
			expect(indexes, p.slug).toEqual(indexes.map((_, i) => i));
		}
	});

	it('covers every age group exactly once per family', () => {
		const families = new Set(SEED_TEST_PROTOCOLS.map((p) => p.family));
		const ages: AgeGroup[] = ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'];
		for (const family of families) {
			const inFamily = SEED_TEST_PROTOCOLS.filter((p) => p.family === family);
			for (const age of ages) {
				const sat = inFamily.filter((p) => p.age_groups.includes(age));
				// A family is one test per age group, except handball, which is
				// deliberately two parts a player sits both of.
				expect(sat.length, `${family} at ${age}`).toBe(family === 'handball' ? 2 : 1);
			}
		}
	});

	it('pairs the two kicking tiers with each other', () => {
		expect(JUNIOR_KICK.paired_slug).toBe(SENIOR_KICK.slug);
		expect(SENIOR_KICK.paired_slug).toBe(JUNIOR_KICK.slug);
		// The conversion depends on this: same shape, so slot n maps to slot n.
		expect(JUNIOR_KICK.attempts.length).toBe(SENIOR_KICK.attempts.length);
	});

	it('runs a timed test on a window and no attempts, and the others the other way round', () => {
		for (const p of SEED_TEST_PROTOCOLS) {
			if (p.scoring === 'timed_hits') {
				expect(p.attempts, p.slug).toHaveLength(0);
				expect(p.window_seconds, p.slug).toBeGreaterThan(0);
			} else {
				expect(p.attempts.length, p.slug).toBeGreaterThan(0);
				expect(p.window_seconds, p.slug).toBeNull();
			}
		}
	});

	it('asks for 30 kicks, five per foot at three distances', () => {
		for (const p of [JUNIOR_KICK, SENIOR_KICK]) {
			expect(p.attempts).toHaveLength(30);
			const distances = new Set(p.attempts.map((a) => a.distance_m));
			expect(distances.size, p.slug).toBe(3);
			for (const distance of distances) {
				const atDistance = p.attempts.filter((a) => a.distance_m === distance);
				expect(atDistance.filter((a) => a.side === 'left')).toHaveLength(5);
				expect(atDistance.filter((a) => a.side === 'right')).toHaveLength(5);
			}
		}
	});
});

describe('scoreResult', () => {
	it('totals a hit/miss test against its maximum', () => {
		const score = scoreResult(SENIOR_KICK, hits(SENIOR_KICK, 19));
		expect(score).toMatchObject({ total: 19, max: 30, recorded: 30, expected: 30, complete: true });
		expect(score.accuracy).toBeCloseTo(19 / 30);
	});

	it('scores a set shot out of six, not out of one', () => {
		expect(maxAttemptScore('goal_behind_miss')).toBe(6);
		// Nine goals, four behinds, two misses.
		const scores = [...Array(9).fill(6), ...Array(4).fill(1), 0, 0];
		const score = scoreResult(SET_SHOTS, result(SET_SHOTS, scores));
		expect(score.total).toBe(58);
		expect(score.max).toBe(90);
	});

	it('gives a timed test a total and no maximum, because it has no ceiling', () => {
		const timed = result(HANDBALL_SPEED, [], { timed_hits: 27 });
		const score = scoreResult(HANDBALL_SPEED, timed);
		expect(score.total).toBe(27);
		expect(score.max).toBeNull();
		expect(score.accuracy).toBeNull();
	});

	it('reports a part-finished test as incomplete rather than as misses', () => {
		const partial = result(SENIOR_KICK, []);
		partial.attempts = partial.attempts.slice(0, 10);
		const score = scoreResult(SENIOR_KICK, partial);
		expect(score.recorded).toBe(10);
		expect(score.complete).toBe(false);
	});
});

describe('scoreLine', () => {
	it('reads a set-shot result as a scoreboard line', () => {
		const scores = [...Array(9).fill(6), ...Array(4).fill(1), 0, 0];
		const line = scoreLine(result(SET_SHOTS, scores));
		expect(line).toEqual({ goals: 9, behinds: 4, misses: 2, points: 58 });
		expect(formatScoreLine(line)).toBe('9.4.2 (58)');
	});
});

describe('breakdown', () => {
	it('splits a kicking result by foot and by distance', () => {
		// Every 20 m kick hit, nothing else did.
		const scores = SENIOR_KICK.attempts.map((spec) => (spec.distance_m === 20 ? 1 : 0));
		const parts = breakdown(SENIOR_KICK, result(SENIOR_KICK, scores));

		expect(parts.byDistance.map((r) => [r.label, r.total])).toEqual([
			['20 m', 10],
			['30 m', 0],
			['40 m', 0]
		]);
		// Five of the ten 20 m hits came off each foot.
		expect(parts.bySide.map((r) => [r.label, r.total, r.max])).toEqual([
			['right foot', 5, 15],
			['left foot', 5, 15]
		]);
		expect(parts.bySpot).toEqual([]);
	});

	it('splits a set-shot result by spot and never by foot', () => {
		const scores = SET_SHOTS.attempts.map((spec) => (spec.spot === 'Left pocket' ? 6 : 0));
		const parts = breakdown(SET_SHOTS, result(SET_SHOTS, scores));
		expect(parts.bySide).toEqual([]);
		expect(parts.bySpot).toHaveLength(5);
		expect(parts.bySpot.find((r) => r.label === 'Left pocket')).toMatchObject({
			total: 18,
			max: 18
		});
	});

	it('leaves unrecorded slots out of the maximum, so a part-done test reads true', () => {
		const partial = result(SENIOR_KICK, []);
		// Only the first five 20 m right-foot kicks, all hits.
		partial.attempts = SENIOR_KICK.attempts.slice(0, 5).map((spec) => ({
			index: spec.index,
			score: 1
		}));
		const parts = breakdown(SENIOR_KICK, partial);
		expect(parts.byDistance).toEqual([
			{ label: '20 m', total: 5, max: 5, accuracy: 1, attempts: 5 }
		]);
	});

	it('gives a timed test nothing to split', () => {
		const parts = breakdown(HANDBALL_SPEED, result(HANDBALL_SPEED, [], { timed_hits: 20 }));
		expect(parts).toEqual({ bySide: [], byDistance: [], bySpot: [] });
	});
});

describe('improvedOver', () => {
	it('needs a full ten percent, relative to the baseline', () => {
		expect(improvedOver(20, 21)).toBe(false);
		expect(improvedOver(20, 22)).toBe(true);
		expect(improvedOver(10, 11)).toBe(true);
	});

	it('counts going from nothing to something, which has no percentage', () => {
		expect(improvedOver(0, 1)).toBe(true);
		expect(improvedOver(0, 0)).toBe(false);
		expect(gainOver(0, 5)).toBeNull();
	});

	it('does not credit a worse result', () => {
		expect(improvedOver(20, 19)).toBe(false);
		expect(gainOver(20, 18)).toBeCloseTo(-0.1);
	});
});

describe('rollingBaseline', () => {
	/** A history of hit counts, one result per month. */
	function history(counts: number[]): TestResult[] {
		return counts.map((n, i) =>
			hits(SENIOR_KICK, n, {
				id: `r${i}`,
				recorded_at: `2026-0${i + 1}-01T00:00:00.000Z`,
				local_date: `2026-0${i + 1}-01`
			})
		);
	}

	it('makes the first result the baseline and compares the rest to it', () => {
		const walked = rollingBaseline(SENIOR_KICK, history([10, 11]));
		expect(walked[0]).toMatchObject({ baseline: null, gain: null, anchored: true });
		expect(walked[1].baseline?.id).toBe('r0');
		expect(walked[1].gain).toBeCloseTo(0.1);
		expect(walked[1].improved).toBe(true);
	});

	it('re-anchors on a clear improvement, so the next one has to clear it again', () => {
		// 10 → 12 clears the margin and becomes the baseline. 13 is then only 8%
		// up on 12, so it does not.
		const walked = rollingBaseline(SENIOR_KICK, history([10, 12, 13]));
		expect(walked[1].anchored).toBe(true);
		expect(walked[2].baseline?.id).toBe('r1');
		expect(walked[2].improved).toBe(false);
	});

	it('never moves the baseline down after a bad day', () => {
		const walked = rollingBaseline(SENIOR_KICK, history([10, 20, 5]));
		expect(walked[2].baseline?.id).toBe('r1');
		expect(walked[2].anchored).toBe(false);
		expect(currentBaseline(SENIOR_KICK, history([10, 20, 5]))?.id).toBe('r1');
	});

	it('sorts the history itself, since every repo read comes back newest first', () => {
		const newestFirst = [...history([10, 20])].reverse();
		const walked = rollingBaseline(SENIOR_KICK, newestFirst);
		expect(walked.map((w) => w.result.id)).toEqual(['r0', 'r1']);
		expect(walked[0].baseline).toBeNull();
	});

	it('leaves estimated seed points out of the chain entirely', () => {
		const rows = [...history([10]), hits(SENIOR_KICK, 25, { id: 'seed', estimated: 1 })];
		const walked = rollingBaseline(SENIOR_KICK, rows);
		expect(walked.map((w) => w.result.id)).toEqual(['r0']);
	});

	it('has no baseline before anything has been sat', () => {
		expect(currentBaseline(SENIOR_KICK, [])).toBeNull();
	});
});

describe('tierSeedResult', () => {
	it('carries the junior outcome onto the senior test slot for slot', () => {
		// Every 15 m kick hit — the junior test's shortest rung.
		const scores = JUNIOR_KICK.attempts.map((spec) => (spec.distance_m === 15 ? 1 : 0));
		const junior = hits(JUNIOR_KICK, 0, { id: 'junior-1' });
		junior.attempts = JUNIOR_KICK.attempts.map((spec, i) => ({
			index: spec.index,
			score: scores[i]
		}));

		const seed = tierSeedResult(junior, JUNIOR_KICK, SENIOR_KICK);
		expect(seed).not.toBeNull();
		expect(seed!.estimated).toBe(1);
		expect(seed!.converted_from_result_id).toBe('junior-1');
		expect(seed!.protocol_slug).toBe(SENIOR_KICK.slug);
		// The ten hits land on the senior test's shortest rung, 20 m.
		expect(comparableScore(SENIOR_KICK, seed!)).toBe(10);
		expect(breakdown(SENIOR_KICK, seed!).byDistance[0]).toMatchObject({
			label: '20 m',
			total: 10
		});
	});

	it('is never pushed, so it carries no dirty flag', () => {
		const seed = tierSeedResult(hits(JUNIOR_KICK, 15), JUNIOR_KICK, SENIOR_KICK);
		expect(seed!._dirty).toBe(0);
		expect(seed!.id).not.toBe(hits(JUNIOR_KICK, 15).id);
	});

	it('refuses rather than guesses when the two protocols are not the same shape', () => {
		expect(tierSeedResult(hits(JUNIOR_KICK, 15), JUNIOR_KICK, SET_SHOTS)).toBeNull();
		expect(tierSeedResult(hits(JUNIOR_KICK, 15), JUNIOR_KICK, HANDBALL_SPEED)).toBeNull();
	});
});

describe('protocolsForAgeGroup', () => {
	it('gives a junior the junior kicking tier and a senior the senior one', () => {
		const junior = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, 'u13').map((p) => p.slug);
		expect(junior).toContain('kicking-accuracy-junior');
		expect(junior).not.toContain('kicking-accuracy-senior');

		const senior = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, 'senior').map((p) => p.slug);
		expect(senior).toContain('kicking-accuracy-senior');
		expect(senior).not.toContain('kicking-accuracy-junior');
	});

	it('gives masters the senior tier, not a tier of their own', () => {
		const masters = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, 'masters').map((p) => p.slug);
		expect(masters).toContain('kicking-accuracy-senior');
	});

	it('asks every age group for four protocols across three families', () => {
		for (const age of ['u11', 'u13', 'u15', 'u17', 'senior', 'masters'] as AgeGroup[]) {
			const sat = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, age);
			expect(sat, age).toHaveLength(4);
			expect(protocolsByFamily(sat), age).toHaveLength(3);
		}
	});
});

describe('missingEquipment', () => {
	it('expands what the player claimed, so goals implies an oval', () => {
		expect(missingEquipment(SENIOR_KICK, ['goals'])).toEqual([]);
		expect(missingEquipment(SET_SHOTS, ['oval'])).toEqual(['goals']);
	});

	it('names what is actually missing', () => {
		expect(missingEquipment(HANDBALL_SPEED, ['oval'] as EquipmentAccess[])).toEqual(['wall']);
	});
});

describe('baselinePhase', () => {
	const today = '2026-03-15';

	it('counts every test the player can reach, and none of them done at first', () => {
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [], profile());
		expect(phase.required).toBe(4);
		expect(phase.done).toBe(0);
		expect(phase.complete).toBe(false);
		expect(phase.blocked).toBe(false);
		expect(phase.next?.protocol.slug).toBe('kicking-accuracy-senior');
	});

	it('completes once every reachable test has a result', () => {
		const results = protocolsForAgeGroup(SEED_TEST_PROTOCOLS, 'senior').map((p) =>
			p.scoring === 'timed_hits'
				? result(p, [], { id: `res-${p.slug}`, timed_hits: 20, local_date: today })
				: hits(p, 10, { id: `res-${p.slug}`, local_date: today })
		);
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, results, profile());
		expect(phase.done).toBe(4);
		expect(phase.complete).toBe(true);
		expect(phase.next).toBeUndefined();
	});

	it('leaves a test the player has no access to out of the count, but still lists it', () => {
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [], profile({ equipment_access: ['oval'] }));
		// No goals and no wall: set shots and the timed handball test drop out.
		expect(phase.required).toBe(2);
		expect(phase.tests).toHaveLength(4);
		const setShots = phase.tests.find((t) => t.protocol.slug === 'set-shots')!;
		expect(setShots.available).toBe(false);
		expect(setShots.missing_equipment).toEqual(['goals']);
	});

	it('treats a result as proof of access, whatever the profile claims', () => {
		// They never ticked goals, but they have plainly been to a ground.
		const sat = hits(SET_SHOTS, 5, { id: 'sat-set-shots', local_date: today });
		const phase = baselinePhase(
			SEED_TEST_PROTOCOLS,
			[sat],
			profile({ equipment_access: ['oval'] })
		);
		const setShots = phase.tests.find((t) => t.protocol.slug === 'set-shots')!;
		expect(setShots.available).toBe(true);
		expect(setShots.done).toBe(true);
	});

	it('is blocked, not zero of zero, when nothing is within reach', () => {
		const phase = baselinePhase(
			SEED_TEST_PROTOCOLS,
			[],
			profile({ equipment_access: ['backyard'] })
		);
		expect(phase.blocked).toBe(true);
		expect(phase.required).toBe(0);
		expect(phase.complete).toBe(false);
	});

	it('offers the next unsat test, and knows nothing about retests', () => {
		// When a round falls due is `domain/retest.ts`'s question. The baseline
		// means *ever sat*, so the benchmark panel it unlocks does not re-lock
		// itself every four weeks.
		const sat = hits(SENIOR_KICK, 10, { id: 'sat', local_date: '2026-01-01' });
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [sat], profile());
		expect(phase.next?.protocol.slug).toBe('set-shots');
		expect(phase.tests.find((t) => t.protocol.slug === SENIOR_KICK.slug)!.done).toBe(true);
	});

	it('lists only the tests this player sits and can reach', () => {
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [], profile({ equipment_access: ['oval'] }));
		expect(availableProtocols(phase).map((p) => p.slug)).toEqual([
			'kicking-accuracy-senior',
			'handball-accuracy'
		]);
	});

	it('carries a seed point onto the senior tier for a player who has aged up', () => {
		const junior = hits(JUNIOR_KICK, 18, { id: 'junior-1', local_date: '2026-01-01' });
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [junior], profile());
		const kicking = phase.tests.find((t) => t.protocol.slug === SENIOR_KICK.slug)!;
		expect(kicking.seed?.estimated).toBe(1);
		// A seed point is an estimate, not a sat test: it does not tick the box.
		expect(kicking.done).toBe(false);
		expect(phase.complete).toBe(false);
	});

	it('drops the seed point the moment the senior test is actually sat', () => {
		const junior = hits(JUNIOR_KICK, 18, { id: 'junior-1', local_date: '2026-01-01' });
		const senior = hits(SENIOR_KICK, 12, { id: 'senior-1', local_date: today });
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [junior, senior], profile());
		const kicking = phase.tests.find((t) => t.protocol.slug === SENIOR_KICK.slug)!;
		expect(kicking.seed).toBeUndefined();
		expect(kicking.done).toBe(true);
	});

	it('groups the four protocols under three headings', () => {
		const phase = baselinePhase(SEED_TEST_PROTOCOLS, [], profile());
		const groups = groupByFamily(phase.tests);
		expect(groups.map((g) => g.family)).toEqual(['kicking_accuracy', 'set_shots', 'handball']);
		expect(groups.find((g) => g.family === 'handball')!.tests).toHaveLength(2);
	});
});

describe('isComplete', () => {
	it('needs every slot scored', () => {
		const full = hits(SENIOR_KICK, 30);
		expect(isComplete(SENIOR_KICK, full.attempts)).toBe(true);
		expect(isComplete(SENIOR_KICK, full.attempts.slice(0, 29))).toBe(false);
	});

	it('is always true for a timed test, which has no slots to fill', () => {
		expect(isComplete(HANDBALL_SPEED, [])).toBe(true);
	});
});

describe('copy helpers', () => {
	it('calls a kick a kick and a handball a handball', () => {
		expect(attemptNoun(SENIOR_KICK)).toBe('Kick');
		expect(attemptNoun(SET_SHOTS)).toBe('Shot');
		expect(attemptNoun(HANDBALL_SPEED)).toBe('Handball');
		expect(sideNoun(SENIOR_KICK)).toBe('foot');
		expect(sideNoun(protocol('handball-accuracy'))).toBe('hand');
	});

	it('tells the player what the next attempt is', () => {
		expect(attemptLabel(SENIOR_KICK, SENIOR_KICK.attempts[0])).toBe('20 m · right foot');
		expect(attemptLabel(SENIOR_KICK, SENIOR_KICK.attempts[29])).toBe('40 m · left foot');
		expect(attemptLabel(SET_SHOTS, SET_SHOTS.attempts[0])).toBe('Directly in front · 30 m');
	});

	it('formats a gain, with nothing to say when there is no baseline', () => {
		expect(formatGain(0.18)).toBe('+18%');
		expect(formatGain(-0.07)).toBe('−7%');
		expect(formatGain(0.001)).toBe('level');
		expect(formatGain(null)).toBeNull();
	});

	it('names the stronger foot, and stays quiet when they are level', () => {
		const lopsided = SENIOR_KICK.attempts.map((spec) => (spec.side === 'right' ? 1 : 0));
		const parts = breakdown(SENIOR_KICK, result(SENIOR_KICK, lopsided));
		expect(strongerSide(parts.bySide)).toBe('right');

		const even = breakdown(SENIOR_KICK, hits(SENIOR_KICK, 0));
		expect(strongerSide(even.bySide)).toBeNull();
	});
});
