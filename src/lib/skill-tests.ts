import { repo } from '$lib/data';
import { availableProtocols, baselinePhase, type BaselinePhase } from '$lib/domain/tests';
import {
	latestComparison,
	retestCycle,
	type RetestCycle,
	type RoundComparison
} from '$lib/domain/retest';
import type { IsoDate, PlayerProfile, TestProtocol, TestResult } from '$lib/types';
import { localDate } from '$lib/util/time';

/**
 * Assembles the testing picture from storage: the baseline, the monthly retest
 * cycle, and the latest round against the one before it.
 *
 * Composition only, same as `plan.ts` — every rule lives in `domain/tests.ts`
 * (one result) and `domain/retest.ts` (results over time), where they are pure
 * and tested. This exists so the Today card, the Tests pages, the week plan and
 * the Progress panel all read the same picture instead of each stitching the
 * repo calls together and drifting apart.
 */
export interface LoadedTestPhase {
	profile: PlayerProfile | undefined;
	/** Null before onboarding — there is no age band to pick a tier with. */
	phase: BaselinePhase | null;
	/** Null before onboarding, for the same reason. */
	cycle: RetestCycle | null;
	/** The most recent round against the one before it. Null before anything is sat. */
	comparison: RoundComparison | null;
	/** Every result, so the report and the trends need no second read. */
	results: TestResult[];
	/** The tests this player sits and can reach — what a round is made of. */
	protocols: TestProtocol[];
	today: IsoDate;
}

export async function loadTestPhase(): Promise<LoadedTestPhase> {
	const today = localDate();
	const [profile, protocols, results] = await Promise.all([
		repo.getProfile(),
		repo.listTestProtocols(),
		repo.listTestResults()
	]);

	if (!profile) {
		return {
			profile: undefined,
			phase: null,
			cycle: null,
			comparison: null,
			results,
			protocols: [],
			today
		};
	}

	const phase = baselinePhase(protocols, results, profile);
	// The cycle counts rounds over the tests the player actually sits: the
	// tier for their age group, and only the ones within reach. Handing it the
	// whole library would leave every round permanently one test short.
	const sat = availableProtocols(phase);
	const cycle = retestCycle(sat, results, profile.retest_interval_weeks, today);

	return {
		profile,
		phase,
		cycle,
		comparison: latestComparison(cycle, results, sat),
		results,
		protocols: sat,
		today
	};
}
