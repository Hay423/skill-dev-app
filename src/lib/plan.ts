import { repo } from '$lib/data';
import { recommendDrills, type RecommendationContext } from '$lib/domain/recommend';
import { drillLimitFor, loadModifierFor } from '$lib/domain/load-policy';
import {
	browsableRange,
	planWeek,
	type ActiveProgram,
	type PlannedDay
} from '$lib/domain/schedule';
import { loadTestPhase, type LoadedTestPhase } from '$lib/skill-tests';
import type { IsoDate, PlayerProfile } from '$lib/types';
import { localDate, weekDates } from '$lib/util/time';

/**
 * Assembles everything the week plan needs from storage and hands it to
 * `planWeek`.
 *
 * This is composition, not logic — the scheduling rules all live in
 * `domain/schedule.ts` where they are pure and tested. It exists so the Today
 * card and the Train week strip load the plan the same way instead of each
 * stitching six repo calls together and drifting apart.
 */
export interface LoadedWeekPlan {
	profile: PlayerProfile | undefined;
	days: PlannedDay[];
	/** Monday of the week that was planned. */
	monday: IsoDate;
	today: IsoDate;
	/** The weeks that can be browsed, or null when no block is running. */
	range: { from: IsoDate; to: IsoDate } | null;
	/** The player-level load modifier, for rendering prescriptions. */
	adjust: number;
	/**
	 * The testing picture, which this had to load anyway to place a due retest.
	 *
	 * Handed back so the Today screen can render the retest card from the same
	 * read instead of asking for the protocols and results a second time — the
	 * two would be a tick apart and could disagree about whether a round is
	 * still outstanding. Null before onboarding.
	 */
	tests: LoadedTestPhase | null;
}

/**
 * How many drills to rotate through for the skills suggestions. Wider than the
 * number of days that will be filled, so a week reads as variety rather than
 * the same two drills over and over.
 */
const SKILLS_ROTATION = 5;

export async function loadWeekPlan(anchor?: IsoDate): Promise<LoadedWeekPlan> {
	const today = localDate();
	const dates = weekDates(anchor ?? today);
	const [monday, sunday] = [dates[0], dates[6]];

	const profile = await repo.getProfile();
	if (!profile) {
		return { profile: undefined, days: [], monday, today, range: null, adjust: 1, tests: null };
	}

	const [enrolments, positions, drills, logs, reps, tests] = await Promise.all([
		repo.activeEnrolments(),
		repo.listPositions(),
		repo.listDrills(),
		repo.listSessionLogs({ from: monday, to: sunday }),
		repo.listRepLogs({ from: monday, to: sunday }),
		loadTestPhase()
	]);

	const plans = await Promise.all(
		enrolments.map(async (enrolment) => {
			const plan = await repo.getProgramPlan(enrolment.program_id);
			return plan ? ({ enrolment, plan } satisfies ActiveProgram) : null;
		})
	);

	const context: RecommendationContext = { profile, positions, today };
	const rotation = Math.max(SKILLS_ROTATION, drillLimitFor(profile));
	const recommended = recommendDrills(drills, context, rotation).recommended.map((r) => r.drill);

	const active = plans.filter((p) => p !== null);
	const days = planWeek({
		today,
		anchor,
		profile,
		programs: active,
		logs,
		drills: recommended,
		repDates: reps.map((r) => r.local_date),
		retests: tests.cycle ?? undefined
	});

	return {
		profile,
		days,
		monday,
		today,
		range: browsableRange(active),
		adjust: loadModifierFor(profile),
		tests
	};
}
