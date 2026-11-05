import { type AgeGroup, type IsoDate, type PlayerProfile } from '$lib/types';
import { ageInYears } from '$lib/util/time';

/**
 * When a U17 may train the senior programs.
 *
 * The age gate withholds three blocks from U17 — `preseason-max-strength`,
 * `in-season-strength-maintenance` and `plyo-preseason-power` — because they
 * are the ones prescribing load as `%1RM`, programming power cleans, and
 * programming depth jumps. The U17 variants exist precisely to do that work
 * without any of the three. "Duty of care" in plans/player-profile.md sets out
 * the reasoning, and this module is the one carve-out from it.
 *
 * ## Why an opt-in rather than a wider band
 *
 * An age *band* is a blunt instrument: U17 holds both a fifteen-year-old a
 * season into football and a sixteen-year-old who has been lifting for two
 * years and will be playing seniors next year. Widening the band to let the
 * second player train properly would hand percentage work to the first, and
 * narrowing it leaves the second on a block written around their equipment
 * rather than their readiness.
 *
 * So the decision is moved to the player, and bounded two ways: a real age
 * floor they cannot talk their way past, and an acknowledgement of what they
 * are taking on. Both are required; neither is sufficient.
 *
 * ## Why this stays a data rule
 *
 * The opt-in lives on the profile and is read by the recommendation layer, not
 * applied in a component — so "age gating is a data rule, not a UI suggestion"
 * still holds. More importantly `seniorProgramsUnlocked` re-derives the
 * entitlement from the age on every call instead of trusting the stored flag.
 * A player who sets their age group back to U15, or clears their date of birth,
 * loses the senior blocks immediately and with no migration: the flag is a
 * record of a choice, never a grant of access.
 *
 * The age floor is checked against the real age from `date_of_birth` rather
 * than the age band, which is why the opt-in is only ever offered to a player
 * who has given one. `date_of_birth` is optional on purpose — some players
 * would rather not — and the cost of declining is this feature, not the app.
 * Inferring "probably sixteen" from the U17 band would defeat the only part of
 * this that is hard to game.
 */

/**
 * The real age, in years, a U17 must have reached for the opt-in to be offered.
 *
 * Sixteen is the last year before seniors: a player this age is within twelve
 * months of being handed these programs anyway, and has the training age for
 * percentage-based prescription to mean something. Below it the block is not
 * being withheld on a technicality — it is the wrong work.
 */
export const SENIOR_OPT_IN_MIN_AGE_YEARS = 16;

/** The one band the opt-in applies to. Below it, strength is withheld entirely. */
export const SENIOR_OPT_IN_AGE_GROUP: AgeGroup = 'u17';

/**
 * Whether this player may be *offered* the opt-in — age group, a date of birth,
 * and the age floor. Says nothing about whether they have taken it.
 *
 * Exported so the profile page can show the setting to exactly the players it
 * applies to, and the train page can point at it, rather than either of them
 * re-deriving the rule.
 */
export function canOptInToSeniorPrograms(profile: PlayerProfile, today: IsoDate): boolean {
	if (profile.age_group !== SENIOR_OPT_IN_AGE_GROUP) return false;
	if (!profile.date_of_birth) return false;
	return ageInYears(profile.date_of_birth, today) >= SENIOR_OPT_IN_MIN_AGE_YEARS;
}

/**
 * Whether the senior programs are actually open to this player: they are
 * permitted to opt in **and** they have.
 *
 * Both halves on every call, deliberately — see the module note. This is what
 * the eligibility filter reads.
 */
export function seniorProgramsUnlocked(profile: PlayerProfile, today: IsoDate): boolean {
	return profile.senior_programs_opt_in === 1 && canOptInToSeniorPrograms(profile, today);
}

/**
 * Why a player who has opted in is seeing senior content, in one sentence, for
 * the note the train page shows them. Null when nothing is unlocked, so the
 * caller renders nothing rather than an empty box.
 */
export function describeSeniorOptIn(
	profile: PlayerProfile | undefined,
	today: IsoDate
): string | null {
	if (!profile || !seniorProgramsUnlocked(profile, today)) return null;
	return 'You have opted in to the senior programs, so the percentage-based blocks are included. Loads here assume a tested one-rep max and a coach who has seen your technique.';
}
