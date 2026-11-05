import {
	BEHIND,
	DEFAULT_RETEST_INTERVAL_WEEKS,
	GOAL,
	IMPROVEMENT_THRESHOLD,
	type AgeGroup,
	type EquipmentAccess,
	type IsoDate,
	type PlayerProfile,
	type TestAttemptResult,
	type TestAttemptSpec,
	type TestFamily,
	type TestProtocol,
	type TestResult,
	type TestScoring,
	type TestSide
} from '$lib/types';
import { addDays, daysBetween } from '$lib/util/time';
import { expandEquipmentAccess } from './equipment';

/**
 * Everything derived from a test result lives here, as pure functions over a
 * protocol and its results.
 *
 * Nothing is stored that can be worked out: a result holds its thirty hit/miss
 * outcomes and nothing else, and overall accuracy, weak foot versus strong
 * foot, 40 m versus 20 m, the rolling baseline and "10% better than baseline"
 * are all read off them here. That is the house rule, and it earns its keep
 * twice over on tests — the three-layer benchmark plan keeps adding questions
 * to ask of the same thirty numbers.
 */

/** The most one attempt can score, or null where attempts are not the unit. */
export function maxAttemptScore(scoring: TestScoring): number | null {
	switch (scoring) {
		case 'hit_miss':
			return 1;
		case 'goal_behind_miss':
			return GOAL;
		case 'timed_hits':
			return null;
	}
}

export interface TestScore {
	/** Points scored. For a timed test, the number of hits. */
	total: number;
	/** The most this protocol can score, or null when unbounded. */
	max: number | null;
	/** 0–1 against `max`, or null when there is no maximum to measure against. */
	accuracy: number | null;
	/** Outcomes recorded. */
	recorded: number;
	/** Outcomes the protocol asks for. 0 for a timed test. */
	expected: number;
	/** Every attempt the protocol asks for has an outcome. */
	complete: boolean;
}

/**
 * Score a result against its protocol.
 *
 * A timed test has no attempt slots, so its total is the hit count and it has
 * no maximum — "27 handballs in 30 seconds" is a rate, and dividing it by
 * something would invent a ceiling the protocol does not have.
 */
export function scoreResult(protocol: TestProtocol, result: TestResult): TestScore {
	if (protocol.scoring === 'timed_hits') {
		const total = result.timed_hits ?? 0;
		return { total, max: null, accuracy: null, recorded: total, expected: 0, complete: true };
	}

	const per = maxAttemptScore(protocol.scoring) ?? 1;
	const expected = protocol.attempts.length;
	const total = result.attempts.reduce((sum, a) => sum + a.score, 0);
	const max = expected * per;
	return {
		total,
		max,
		accuracy: max === 0 ? null : total / max,
		recorded: result.attempts.length,
		expected,
		complete: result.attempts.length === expected
	};
}

/**
 * The one number two results of the same protocol are compared on.
 *
 * Deliberately the raw total rather than accuracy: within a protocol the
 * attempt count is fixed, so the two are the same ordering, and the total is
 * the thing that survives a timed test having no maximum.
 */
export function comparableScore(protocol: TestProtocol, result: TestResult): number {
	return scoreResult(protocol, result).total;
}

/** Goals, behinds and misses, for a set-shot result read as a score line. */
export interface ScoreLine {
	goals: number;
	behinds: number;
	misses: number;
	points: number;
}

export function scoreLine(result: TestResult): ScoreLine {
	let goals = 0;
	let behinds = 0;
	let misses = 0;
	for (const attempt of result.attempts) {
		if (attempt.score === GOAL) goals++;
		else if (attempt.score === BEHIND) behinds++;
		else misses++;
	}
	return { goals, behinds, misses, points: goals * GOAL + behinds * BEHIND };
}

/** `9.4.2 (58)` — the way a score reads on a scoreboard. */
export function formatScoreLine(line: ScoreLine): string {
	return `${line.goals}.${line.behinds}.${line.misses} (${line.points})`;
}

/** What to tell the player to do for one attempt: `30 m · left foot`. */
export function attemptLabel(protocol: TestProtocol, spec: TestAttemptSpec): string {
	const parts: string[] = [];
	if (spec.spot) parts.push(spec.spot);
	if (spec.distance_m !== null) parts.push(`${spec.distance_m} m`);
	if (spec.side) parts.push(`${spec.side} ${sideNoun(protocol)}`);
	return parts.join(' · ');
}

/** Whether this protocol's sides are feet or hands. */
export function sideNoun(protocol: TestProtocol): 'foot' | 'hand' {
	return protocol.category === 'handball' ? 'hand' : 'foot';
}

/**
 * What one attempt is called, so the runner can count "Kick 7 of 30" rather
 * than "Attempt 7 of 30".
 *
 * Derived from the skill, not stored on the protocol: a goalkicking test counts
 * shots, a handball test counts handballs, and anything else counts kicks.
 * Correct football words are the cheapest way for the app to sound like it
 * knows the game.
 */
export function attemptNoun(protocol: TestProtocol): string {
	switch (protocol.category) {
		case 'goalkicking':
			return 'Shot';
		case 'handball':
			return 'Handball';
		default:
			return 'Kick';
	}
}

export interface BreakdownRow {
	label: string;
	total: number;
	max: number;
	/** 0–1, or null when nothing was recorded for this slice. */
	accuracy: number | null;
	attempts: number;
}

export interface Breakdown {
	bySide: BreakdownRow[];
	byDistance: BreakdownRow[];
	bySpot: BreakdownRow[];
}

/**
 * The result split along whichever dimensions the protocol actually uses.
 *
 * Derived from the attempt specs rather than declared on the protocol: a spec
 * that carries a distance is a result with a distance breakdown, and there is
 * no way for the two to disagree. A timed test has no specs and so no
 * breakdown, which is correct — there is nothing in it to split.
 */
export function breakdown(protocol: TestProtocol, result: TestResult): Breakdown {
	const per = maxAttemptScore(protocol.scoring) ?? 1;
	const scores = new Map(result.attempts.map((a) => [a.index, a.score]));

	function group(key: (spec: TestAttemptSpec) => string | null): BreakdownRow[] {
		const rows = new Map<string, { total: number; attempts: number; order: number }>();
		for (const spec of protocol.attempts) {
			const label = key(spec);
			if (label === null) continue;
			const score = scores.get(spec.index);
			// A slot with no outcome yet is left out of both the total and the
			// maximum, so a part-finished test reads as a true score so far
			// rather than as a pile of misses.
			if (score === undefined) continue;
			const row = rows.get(label) ?? { total: 0, attempts: 0, order: rows.size };
			row.total += score;
			row.attempts += 1;
			rows.set(label, row);
		}
		return [...rows.entries()]
			.sort((a, b) => a[1].order - b[1].order)
			.map(([label, row]) => ({
				label,
				total: row.total,
				max: row.attempts * per,
				accuracy: row.attempts === 0 ? null : row.total / (row.attempts * per),
				attempts: row.attempts
			}));
	}

	return {
		bySide: group((s) => (s.side ? `${s.side} ${sideNoun(protocol)}` : null)),
		byDistance: group((s) => (s.distance_m === null ? null : `${s.distance_m} m`)),
		bySpot: group((s) => s.spot)
	};
}

/**
 * Relative gain of `score` over `baseline`, or null when there is nothing
 * meaningful to divide by.
 *
 * A baseline of zero has no percentage: going from nothing to something is an
 * infinite improvement, which is true and useless. `improvedOver` still
 * credits it.
 */
export function gainOver(baseline: number, score: number): number | null {
	if (baseline <= 0) return null;
	return (score - baseline) / baseline;
}

/** Cleared the 10% relative margin over the baseline. */
export function improvedOver(baseline: number, score: number): boolean {
	if (baseline <= 0) return score > 0;
	return score >= baseline * (1 + IMPROVEMENT_THRESHOLD);
}

export interface BaselinedResult {
	result: TestResult;
	score: TestScore;
	/** The rolling baseline it was measured against; null for the baseline itself. */
	baseline: TestResult | null;
	/** Relative gain over that baseline, or null when there is none to compute. */
	gain: number | null;
	/** Cleared the improvement margin. */
	improved: boolean;
	/** Became the rolling baseline for everything after it. */
	anchored: boolean;
}

/**
 * Walk a protocol's history oldest first, carrying a **rolling** baseline.
 *
 * The first result is the baseline. Any later result that clears it by the 10%
 * margin counts as improved *and* becomes the baseline for the results after
 * it, so the next improvement has to clear 10% again from the higher mark. The
 * baseline never moves downward: a bad day is measured against the standard
 * already set, and does not erase it.
 *
 * Pinning the baseline to the first result forever would make "improved" a
 * one-off that stays true for years; re-anchoring on every personal best would
 * make a single lucky test the thing every later result is punished against.
 * Re-anchoring only on a clear margin is what makes one rule answer both "has
 * this player improved?" and "what are they improving from?".
 *
 * `results` may arrive in any order; it is sorted here rather than trusted,
 * because the baseline chain is order-dependent and a caller that passes
 * newest-first (which every repo read does) would otherwise get a silently
 * inverted answer.
 */
export function rollingBaseline(protocol: TestProtocol, results: TestResult[]): BaselinedResult[] {
	const ordered = [...results]
		.filter((r) => r.estimated === 0)
		.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));

	let baseline: TestResult | null = null;
	const out: BaselinedResult[] = [];

	for (const result of ordered) {
		const score = scoreResult(protocol, result);
		if (baseline === null) {
			out.push({ result, score, baseline: null, gain: null, improved: false, anchored: true });
			baseline = result;
			continue;
		}
		const baselineScore = comparableScore(protocol, baseline);
		const improved = improvedOver(baselineScore, score.total);
		out.push({
			result,
			score,
			baseline,
			gain: gainOver(baselineScore, score.total),
			improved,
			anchored: improved
		});
		if (improved) baseline = result;
	}

	return out;
}

/**
 * The rolling baseline a result sat *now* would be measured against, or null
 * when there is no history yet.
 *
 * This is what stamps `baseline_result_id` on a new row. The stored value and
 * what the UI shows therefore come from the same function, which is the only
 * reason it is safe to store a derived answer at all.
 */
export function currentBaseline(protocol: TestProtocol, history: TestResult[]): TestResult | null {
	const walked = rollingBaseline(protocol, history);
	for (let i = walked.length - 1; i >= 0; i--) {
		if (walked[i].anchored) return walked[i].result;
	}
	return null;
}

/**
 * The estimated senior-tier seed point converted from a junior-tier result.
 *
 * A player crossing from U13 to U15 has a history in distances the senior test
 * does not use. Rather than a gap in the trend line, or two disconnected
 * trends, their last junior result is converted into an estimated starting
 * point for the senior test, labelled as estimated, and dropped the moment they
 * actually sit the senior test.
 *
 * The conversion is the junior outcome applied slot for slot, which works
 * because the two tiers are the same shape — thirty kicks, three rungs, five
 * per foot — so junior slot 7 (15 m, left) maps onto senior slot 7 (20 m,
 * left). It is deliberately not a fitted model: it has to hold a trend line
 * together across one transition, not predict anything. Shapes that do not
 * match get no seed point rather than a reshuffled guess.
 *
 * **Derived, never written.** It would be a stored row that has to be found and
 * invalidated the first time a real result lands — the same second source of
 * truth that `current_week` was for the program calendar, and removed for the
 * same reason. `notes/product-direction.md` planned to store it; computing it
 * on read gives the same trend line with nothing to keep in sync, and the
 * `estimated` flag stays on the type because this row carries it.
 */
export function tierSeedResult(
	from: TestResult,
	fromProtocol: TestProtocol,
	toProtocol: TestProtocol
): TestResult | null {
	if (fromProtocol.attempts.length !== toProtocol.attempts.length) return null;
	if (fromProtocol.scoring !== toProtocol.scoring) return null;

	return {
		...from,
		// Never persisted, so this is a readable marker rather than a UUID. It is
		// stable for the same source result, which is what list keying needs.
		id: `estimated-${from.id}`,
		protocol_id: toProtocol.id,
		protocol_slug: toProtocol.slug,
		estimated: 1,
		converted_from_result_id: from.id,
		baseline_result_id: null,
		_dirty: 0
	};
}

/** Protocols this player sits: the tier for their age band, and nothing else. */
export function protocolsForAgeGroup(
	protocols: TestProtocol[],
	age_group: AgeGroup
): TestProtocol[] {
	return protocols.filter((p) => p.age_groups.includes(age_group));
}

/**
 * Equipment the protocol needs that the profile has not claimed.
 *
 * Expanded through `domain/equipment.ts`, so a player who ticked only "Goals"
 * is not told they are missing an oval.
 */
export function missingEquipment(
	protocol: TestProtocol,
	access: EquipmentAccess[]
): EquipmentAccess[] {
	const owned = expandEquipmentAccess(access);
	return protocol.equipment_required.filter((item) => !owned.has(item));
}

export interface BaselineTest {
	protocol: TestProtocol;
	/** Latest result actually sat, newest of the real ones. */
	latest: TestResult | undefined;
	score: TestScore | null;
	/** The whole history for this protocol, newest first. */
	history: TestResult[];
	/**
	 * The estimated tier-transition seed point, when the player has a result on
	 * the other tier and none on this one. Not a result: it does not make the
	 * test done.
	 */
	seed: TestResult | undefined;
	done: boolean;
	/** Equipment the profile has not claimed. Empty when the player can sit it. */
	missing_equipment: EquipmentAccess[];
	/** Within reach: the profile covers it, or a result proves they got to one. */
	available: boolean;
}

export interface BaselinePhase {
	tests: BaselineTest[];
	/** Available tests — the denominator the card counts towards. */
	required: number;
	/** Available tests with a real result. */
	done: number;
	complete: boolean;
	/**
	 * Not one test is within reach of the equipment on the profile. `complete`
	 * is false, but nothing here is the player's doing — the card says what
	 * access is needed instead of counting towards zero.
	 */
	blocked: boolean;
	/** The next baseline test to put in front of the player, if any are left. */
	next: BaselineTest | undefined;
}

/**
 * The state of the player's **baseline**: what they sit, what they have ever
 * sat, and what they cannot reach yet.
 *
 * Every user goes through this once. It is not a gate — a 30-kick test needs an
 * oval, and nobody can finish one at the moment they finish onboarding — so the
 * app stays usable throughout and this drives a prompt and a locked benchmark
 * panel instead of a locked app.
 *
 * `done` and `complete` mean *ever*, not *this round*. Once the baseline is in
 * it stays in: the benchmark panel it unlocks must not re-lock itself every
 * four weeks. Which tests are outstanding **now** is the retest cycle's
 * question — see `domain/retest.ts`.
 */
export function baselinePhase(
	protocols: TestProtocol[],
	results: TestResult[],
	profile: Pick<PlayerProfile, 'age_group' | 'equipment_access'>
): BaselinePhase {
	const applicable = protocolsForAgeGroup(protocols, profile.age_group);
	const bySlug = new Map(protocols.map((p) => [p.slug, p]));

	const tests: BaselineTest[] = applicable.map((protocol) => {
		const history = results
			.filter((r) => r.protocol_slug === protocol.slug && r.estimated === 0)
			.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
		const latest = history[0];
		const missing = missingEquipment(protocol, profile.equipment_access);

		// A result is proof of access, whatever the profile says: a player who
		// walked to a ground and kicked thirty has sat the test, and telling them
		// afterwards that they cannot would be absurd.
		const available = missing.length === 0 || latest !== undefined;

		const paired = protocol.paired_slug ? bySlug.get(protocol.paired_slug) : undefined;
		const pairedLatest = paired
			? results
					.filter((r) => r.protocol_slug === paired.slug && r.estimated === 0)
					.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
			: undefined;
		const seed =
			latest === undefined && paired && pairedLatest
				? (tierSeedResult(pairedLatest, paired, protocol) ?? undefined)
				: undefined;

		return {
			protocol,
			latest,
			score: latest ? scoreResult(protocol, latest) : null,
			history,
			seed,
			done: latest !== undefined,
			missing_equipment: missing,
			available
		};
	});

	const availableTests = tests.filter((t) => t.available);
	const required = availableTests.length;
	const done = availableTests.filter((t) => t.done).length;

	return {
		tests,
		required,
		done,
		complete: required > 0 && done === required,
		blocked: required === 0,
		next: availableTests.find((t) => !t.done)
	};
}

/** The tests this player sits that are also within reach — what a round is made of. */
export function availableProtocols(phase: BaselinePhase): TestProtocol[] {
	return phase.tests.filter((t) => t.available).map((t) => t.protocol);
}

/**
 * Group anything that carries a protocol under the family heading a player
 * recognises — "Handball", not "handball accuracy" and "handball speed".
 *
 * Insertion-ordered rather than sorted, so the display order is the seed
 * file's: kicking, then goalkicking, then handball, which is the order they
 * are meant to be sat in.
 */
export function groupByFamily<T extends { protocol: TestProtocol }>(
	items: T[]
): Array<{ family: TestFamily; tests: T[] }> {
	const groups = new Map<TestFamily, T[]>();
	for (const item of items) {
		const bucket = groups.get(item.protocol.family);
		if (bucket) bucket.push(item);
		else groups.set(item.protocol.family, [item]);
	}
	return [...groups.entries()].map(([family, tests]) => ({ family, tests }));
}

/** The same grouping over bare protocols, for copy that has no results yet. */
export function protocolsByFamily(
	protocols: TestProtocol[]
): Array<{ family: TestFamily; protocols: TestProtocol[] }> {
	return groupByFamily(protocols.map((protocol) => ({ protocol }))).map((group) => ({
		family: group.family,
		protocols: group.tests.map((item) => item.protocol)
	}));
}

/** Every attempt the protocol asks for has an outcome. */
export function isComplete(protocol: TestProtocol, attempts: TestAttemptResult[]): boolean {
	if (protocol.scoring === 'timed_hits') return true;
	const seen = new Set(attempts.map((a) => a.index));
	return protocol.attempts.every((spec) => seen.has(spec.index));
}

/** `+18%`, `−7%`, or null when there was nothing to compare against. */
export function formatGain(gain: number | null): string | null {
	if (gain === null) return null;
	const pct = Math.round(gain * 100);
	if (pct === 0) return 'level';
	// U+2212 minus, not a hyphen — it lines up with the digits in tabular nums.
	return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/** The stronger side, for the weak-foot line. Null when they are level. */
export function strongerSide(rows: BreakdownRow[]): TestSide | null {
	if (rows.length !== 2) return null;
	const [first, second] = rows;
	if (first.accuracy === null || second.accuracy === null) return null;
	if (first.accuracy === second.accuracy) return null;
	const label = (first.accuracy > second.accuracy ? first : second).label;
	return label.startsWith('left') ? 'left' : 'right';
}
