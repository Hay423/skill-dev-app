import type { PlayerProfile } from '$lib/types';

/**
 * How much training the app asks of a player, as a function of who they are.
 *
 * One module because the answer has to be the same everywhere: the number that
 * ranks a program, the number that scales the load printed on a set, and the
 * number of skills days the calendar fills in all come from here. Splitting
 * them across the recommendation layer and the renderer is how a player ends up
 * being shown a program chosen on one basis and a prescription written on
 * another.
 *
 * ## Masters
 *
 * Masters players train around work, family and a body that repairs more
 * slowly, and soft-tissue injuries — calves, hamstrings, achilles — are what
 * actually costs them seasons. So everything is lighter: loads and running
 * volume come down, shorter and less frequent blocks rank first, and the
 * calendar leaves more days clear.
 *
 * What it deliberately does *not* do is withhold strength work. Resistance
 * training is the main defence against the muscle loss and tendon stiffness
 * behind those injuries, so removing it would work against the reason for
 * reducing the load in the first place. Lighter, not less — which is the
 * opposite of the junior rule in `recommend.ts`, and for the opposite reason.
 */

/** Everything prescribed to a masters player is scaled by this. */
export const MASTERS_LOAD_MODIFIER = 0.85;

/** How many drills the "Recommended for you" block offers. */
export const DEFAULT_DRILL_LIMIT = 3;
export const MASTERS_DRILL_LIMIT = 2;

/** How many otherwise-empty training days the calendar fills with skills work. */
export const MASTERS_MAX_SKILLS_DAYS = 2;

/** How many optional position exercises are appended to a strength session. */
export const DEFAULT_SESSION_EXTRAS = 2;
export const MASTERS_SESSION_EXTRAS = 1;

export function isMasters(profile: PlayerProfile | undefined): boolean {
	return profile?.age_group === 'masters';
}

/**
 * The multiplier applied to prescribed load and volume, on top of the week's
 * own intensity. 1 for everybody but masters.
 */
export function loadModifierFor(profile: PlayerProfile | undefined): number {
	return isMasters(profile) ? MASTERS_LOAD_MODIFIER : 1;
}

export function drillLimitFor(profile: PlayerProfile | undefined): number {
	return isMasters(profile) ? MASTERS_DRILL_LIMIT : DEFAULT_DRILL_LIMIT;
}

export function maxSkillsDaysFor(profile: PlayerProfile | undefined): number {
	return isMasters(profile) ? MASTERS_MAX_SKILLS_DAYS : Number.POSITIVE_INFINITY;
}

export function maxExtrasFor(profile: PlayerProfile | undefined): number {
	return isMasters(profile) ? MASTERS_SESSION_EXTRAS : DEFAULT_SESSION_EXTRAS;
}

/** The sessions-per-week a block should ask of this player before it reads as heavy. */
export const MASTERS_COMFORTABLE_SESSIONS = 2;

/**
 * Why a program is flagged as more than this player needs, or null when it is
 * not. Copy lives here with the rule rather than in the component, so the
 * threshold and the sentence explaining it cannot drift apart.
 */
export function describeProgramCaution(
	profile: PlayerProfile | undefined,
	sessions_per_week: number,
	phase: string
): string | null {
	if (!isMasters(profile)) return null;
	if (sessions_per_week > MASTERS_COMFORTABLE_SESSIONS) {
		return `${sessions_per_week} sessions a week — more than most masters players need`;
	}
	if (phase === 'pre_season') return 'A full pre-season load';
	return null;
}

/** The standing note explaining the reduction, or null when there is nothing to explain. */
export function describeLoadPolicy(profile: PlayerProfile | undefined): string | null {
	if (!isMasters(profile)) return null;
	const percent = Math.round((1 - MASTERS_LOAD_MODIFIER) * 100);
	return `Loads and running volume are cut by ${percent}%, and shorter blocks are listed first. Strength work still matters at your age — it is what keeps the soft-tissue injuries away — so it is lighter rather than fewer.`;
}
