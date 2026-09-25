import {
	type AgeGroup,
	type Exercise,
	type MovementPattern,
	type IsoDate,
	type PlayerProfile,
	type ProgramItem,
	type ProgramSession,
	type ProgramWeek
} from '$lib/types';
import { daysBetween } from '$lib/util/time';

/**
 * Heart rate, from a percentage on a prescription to the line a player reads
 * with a watch on their wrist.
 *
 * Everything here is a pure function of the item, the week and the profile, for
 * the same reason `program-plan.ts` is: the number printed on a session and the
 * number a future session-summary screen compares against have to come from one
 * place, or a player is shown a target on one screen and judged against a
 * different one on the next.
 *
 * ## Percentage of maximum, not of reserve
 *
 * Bands are `%HRmax`, which is what a consumer watch shows without being told
 * anything. `%HRR` (Karvonen) is the more accurate prescription, but it needs a
 * resting heart rate measured properly on waking, and a resting figure guessed
 * at the end of a session is worse than an honest `%HRmax`.
 *
 * ## Why the maximum is estimated rather than asked for
 *
 * `estimateMaxHr` uses Tanaka (211 − 0.64 × age) rather than the older
 * 220 − age, which overstates a junior's maximum and understates a masters
 * player's — the two bands this app most needs to get right. It is still an
 * estimate: an individual maximum sits within roughly ±10 bpm of it, which is
 * why every bpm figure is printed with a `~` and the percentage stays the
 * prescription. A measured maximum requires a supervised test to exhaustion,
 * which is not something to ask a player training alone in a park to do.
 */

export interface HrZone {
	zone: 1 | 2 | 3 | 4 | 5;
	/** The short label on a prescription line. */
	label: string;
	/** What the zone is for, in words a player recognises. */
	name: string;
	min_pct: number;
	max_pct: number;
}

/**
 * Five zones, contiguous across 50–100% so every band lands in exactly one.
 *
 * Boundaries are inclusive at the bottom and exclusive at the top, except Z5
 * which runs to 100 — a band's zone is decided by its midpoint (see
 * `zoneFor`), so a prescription that straddles a boundary is named for where
 * most of it sits rather than for whichever end is read first.
 */
export const HR_ZONES: readonly HrZone[] = [
	{ zone: 1, label: 'Z1', name: 'Recovery', min_pct: 50, max_pct: 60 },
	{ zone: 2, label: 'Z2', name: 'Easy aerobic', min_pct: 60, max_pct: 70 },
	{ zone: 3, label: 'Z3', name: 'Steady', min_pct: 70, max_pct: 80 },
	{ zone: 4, label: 'Z4', name: 'Hard aerobic', min_pct: 80, max_pct: 90 },
	{ zone: 5, label: 'Z5', name: 'Maximal', min_pct: 90, max_pct: 100 }
];

/**
 * The band a working prescription is clamped into after the week's intensity is
 * applied.
 *
 * The ceiling is the load-bearing one: a 90% band in a 1.15 peak week scales to
 * 103%, which is not a heart rate anybody has. 95% is the top of what a player
 * can actually hold for the length of a rep, so that is where it stops. The
 * floor keeps a deload a lighter session rather than a walk.
 */
export const HR_PCT_CEILING = 95;
export const HR_PCT_FLOOR = 50;

/**
 * The threshold a lifter waits to drop back below between sets.
 *
 * Fixed, deliberately, where work bands scale with the week: this is a
 * readiness gate rather than a dose. Scaling it would mean a deload asked a
 * player to be *more* recovered before a lighter set than before a heavy one,
 * which is backwards.
 */
export const SET_RECOVERY_PCT = 65;

/** Typical age for a band, used when no date of birth was given. */
const AGE_GROUP_TYPICAL_AGE: Record<AgeGroup, number> = {
	u11: 10,
	u13: 12,
	u15: 14,
	u17: 16,
	senior: 25,
	masters: 40
};

/**
 * The player's age in whole years, from a date of birth where there is one and
 * the middle of their age band where there is not.
 *
 * `date_of_birth` is optional on purpose — some players would rather not give
 * one — so the band has to be able to answer this on its own. It is the less
 * precise answer, not a broken one: the bands are narrow enough below seniors
 * that a year either way moves an estimated maximum by well under a beat.
 */
export function ageFor(profile: PlayerProfile, today: IsoDate): number {
	if (profile.date_of_birth) {
		const years = daysBetween(profile.date_of_birth, today) / 365.25;
		// A date of birth in the future, or one so old it cannot be right, falls
		// back to the band rather than producing a negative or absurd maximum.
		if (years >= 0 && years < 120) return Math.floor(years);
	}
	return AGE_GROUP_TYPICAL_AGE[profile.age_group] ?? AGE_GROUP_TYPICAL_AGE.senior;
}

/** Estimated maximum heart rate in bpm — Tanaka, rounded to a whole beat. */
export function estimateMaxHr(profile: PlayerProfile, today: IsoDate): number {
	return Math.round(211 - 0.64 * ageFor(profile, today));
}

/** Which zone a percentage falls in. Anything off the scale lands on the nearest end. */
export function zoneFor(pct: number): HrZone {
	if (pct < HR_ZONES[0].min_pct) return HR_ZONES[0];
	const found = HR_ZONES.find((z) => pct >= z.min_pct && pct < z.max_pct);
	return found ?? HR_ZONES[HR_ZONES.length - 1];
}

export interface HrBand {
	min_pct: number;
	max_pct: number;
}

/**
 * Default work bands by movement, used when an item carries no authored band.
 *
 * Content should author its own — a hard 400 and a jog to finish are both
 * continuous running and belong in different zones — but a default means a
 * newly imported program is never silent about heart rate, and it keeps the
 * fallback a documented decision rather than an empty line.
 */
const DEFAULT_INTERVAL_BAND: HrBand = { min_pct: 80, max_pct: 90 };
const DEFAULT_CONTINUOUS_BAND: HrBand = { min_pct: 65, max_pct: 75 };
const DEFAULT_PLYOMETRIC_BAND: HrBand = { min_pct: 60, max_pct: 75 };

/**
 * Movement patterns that carry external load, or enough of the player's own to
 * count: these are prescribed by load and read a between-sets recovery
 * threshold rather than a work band.
 *
 * `core` is deliberately absent. A 45-second plank or a balance hold has no
 * heart rate worth printing, and a recovery threshold over the top of one would
 * be noise on the busiest line of the busiest screen in the app.
 *
 * `plyometric` is absent for the opposite reason: jumping gets a real work
 * band, low and deliberately so — a set of hops that pushes the heart rate up
 * has stopped being jumping and become conditioning.
 */
const LOADED_PATTERNS: ReadonlySet<MovementPattern> = new Set([
	'squat',
	'hinge',
	'push',
	'pull',
	'lunge',
	'carry',
	'olympic'
]);

/**
 * What kind of heart rate line an item gets.
 *
 * Keyed on the movement rather than on the session it sits in, so pogo hops
 * read the same way on a power day inside a strength block as they do in a
 * plyometric one. Only when there is no exercise to look at — a bare running
 * item — does the prescription's own shape decide.
 */
export type HrPrescription =
	{ kind: 'work'; band: HrBand } | { kind: 'recovery'; pct: number } | { kind: 'none' };

export interface HrInput {
	item: ProgramItem;
	/** Null for a bare running item, which prescribes an effort rather than a movement. */
	exercise: Exercise | null;
	session_type: ProgramSession['type'];
	week?: ProgramWeek;
	/** The player-level load modifier from `load-policy.ts`. */
	adjust?: number;
}

/**
 * The item's authored band, or the default for its movement, scaled by the
 * week and clamped — or a between-sets recovery threshold for resistance work,
 * which is prescribed by load rather than by heart rate.
 */
export function hrPrescriptionFor(input: HrInput): HrPrescription {
	const { item, exercise, session_type, week, adjust = 1 } = input;

	const authored =
		item.hr_pct_min !== null && item.hr_pct_max !== null
			? { min_pct: item.hr_pct_min, max_pct: item.hr_pct_max }
			: null;

	if (authored) return { kind: 'work', band: scaleBand(authored, week, adjust) };

	if (exercise !== null) {
		if (exercise.movement_pattern === 'plyometric') {
			return { kind: 'work', band: scaleBand(DEFAULT_PLYOMETRIC_BAND, week, adjust) };
		}
		// A lift or a carry: heart rate is a consequence of the load rather than
		// the thing being prescribed, so the useful number is the one to come back
		// down to before the next set.
		if (LOADED_PATTERNS.has(exercise.movement_pattern)) {
			return { kind: 'recovery', pct: SET_RECOVERY_PCT };
		}
		return { kind: 'none' };
	}

	// A bare item with no exercise: running, and the only thing to read it by is
	// the prescription. Reps of a distance are intervals; a stretch of time on
	// its own is continuous.
	if (item.distance_m !== null || item.work_seconds !== null) {
		const band = item.reps_count !== null ? DEFAULT_INTERVAL_BAND : DEFAULT_CONTINUOUS_BAND;
		return { kind: 'work', band: scaleBand(band, week, adjust) };
	}

	// Nothing to go on. A recovery session is the honest case here.
	if (session_type === 'recovery') return { kind: 'work', band: { min_pct: 50, max_pct: 60 } };
	return { kind: 'none' };
}

/**
 * The week's intensity applied to a band, rounded to whole percent and clamped
 * into `HR_PCT_FLOOR`–`HR_PCT_CEILING`.
 *
 * Scaling heart rate alongside load and rep count is what keeps a deload a
 * deload: a week written to be lighter that still asked for 90% of maximum
 * would be lighter in name only. The clamp is what keeps it honest at the other
 * end — see `HR_PCT_CEILING`.
 */
export function scaleBand(band: HrBand, week: ProgramWeek | undefined, adjust = 1): HrBand {
	const modifier = (week?.intensity_modifier ?? 1) * adjust;
	const clamp = (pct: number) =>
		Math.min(HR_PCT_CEILING, Math.max(HR_PCT_FLOOR, Math.round(pct * modifier)));
	const min_pct = clamp(band.min_pct);
	const max_pct = clamp(band.max_pct);
	// Both ends can land on the ceiling in a peak week, which is a single target
	// rather than a band — `describeHeartRate` prints it as one number.
	return { min_pct: Math.min(min_pct, max_pct), max_pct };
}

/** Percentage of a maximum as whole bpm. */
export function bpmFor(pct: number, max_hr: number): number {
	return Math.round((pct / 100) * max_hr);
}

/**
 * The heart rate line for an item: zone, band and estimated bpm, or the
 * between-sets recovery threshold for a lift. Null when there is nothing
 * meaningful to say.
 *
 * bpm is prefixed with `~` wherever it appears, because it comes from an
 * estimated maximum. The percentage is the prescription; the beats are the
 * convenience.
 */
export function describeHeartRate(input: HrInput & { max_hr: number }): string | null {
	const prescription = hrPrescriptionFor(input);
	const { max_hr } = input;

	if (prescription.kind === 'none') return null;

	if (prescription.kind === 'recovery') {
		const { pct } = prescription;
		return `Recover under ${pct}% HRmax · ~${bpmFor(pct, max_hr)} bpm`;
	}

	const { min_pct, max_pct } = prescription.band;
	const zone = zoneFor((min_pct + max_pct) / 2);
	const low = bpmFor(min_pct, max_hr);
	const high = bpmFor(max_pct, max_hr);

	if (min_pct === max_pct) {
		return `${zone.label} · ${min_pct}% HRmax · ~${low} bpm`;
	}
	return `${zone.label} · ${min_pct}–${max_pct}% HRmax · ~${low}–${high} bpm`;
}

/**
 * The standing note under a session, explaining where the beats came from.
 *
 * Shown rather than left implicit: a player who knows their own maximum needs
 * to be told these numbers are not it, and a player who does not needs to know
 * the percentage is the part to trust.
 */
export function describeMaxHrBasis(profile: PlayerProfile, today: IsoDate): string {
	const max = estimateMaxHr(profile, today);
	const basis = profile.date_of_birth ? 'your age' : 'your age group';
	return `Beats are worked out from an estimated maximum of ${max} bpm, based on ${basis}. Treat the percentage as the target — an individual maximum sits either side of an estimate.`;
}
