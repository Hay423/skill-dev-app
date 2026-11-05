import {
	AGE_GROUPS,
	AGE_GROUP_LABELS,
	EQUIPMENT_ACCESS_LABELS,
	PHYSICAL_QUALITIES,
	PHYSICAL_QUALITY_LABELS,
	POSITION_LABELS,
	SKILL_CATEGORIES,
	SKILL_CATEGORY_LABELS,
	type AgeGroup,
	type Drill,
	type EquipmentAccess,
	type IsoDate,
	type ExperienceLevel,
	type PhysicalQuality,
	type PlayerProfile,
	type Position,
	type PositionProfile,
	type SkillCategory,
	type TrainingProgram
} from '$lib/types';
import {
	describeDrillFilterReason,
	matchesFilter,
	noDrillFilter,
	type DrillFilter,
	type DrillFilterReason
} from './drill-filter';
import { expandEquipmentAccess } from './equipment';
import { describeProgramCaution, isMasters, MASTERS_COMFORTABLE_SESSIONS } from './load-policy';
import { formatList } from './text';

/**
 * Re-exported so callers that already reach for eligibility keep one import.
 * The implementation moved to `equipment.ts` when the player's own filter
 * started needing it too — see the containment rules there.
 */
export { expandEquipmentAccess };

/**
 * Everything the recommendation layer is allowed to see. Pure input — no
 * storage, no clock beyond `today` — so every function here is deterministic
 * and unit-testable, the same discipline as `stats.ts`.
 */
export interface RecommendationContext {
	profile: PlayerProfile;
	/** Position reference content. An empty list degrades scoring, never breaks it. */
	positions: PositionProfile[];
	today: IsoDate;
	/**
	 * What the player has in front of them right now — who is with them, how
	 * long they have, where they are. Optional because most callers have no
	 * opinion; omitted, it constrains nothing.
	 *
	 * Deliberately part of the context rather than a second argument to
	 * `recommendDrills`: it is an input to the recommendation in exactly the way
	 * the profile is, and a caller that forgets to thread it through is a caller
	 * that hands a solo player a three-person drill.
	 */
	filter?: DrillFilter;
}

/**
 * How much a secondary position counts relative to the primary. One tunable
 * constant: a secondary position pulls recommendations toward itself without
 * ever outvoting the position the player named first.
 */
export const SECONDARY_POSITION_WEIGHT = 0.5;

export interface BlendedWeights {
	skills: Record<SkillCategory, number>;
	physical: Record<PhysicalQuality, number>;
}

function zeroSkills(): Record<SkillCategory, number> {
	return Object.fromEntries(SKILL_CATEGORIES.map((c) => [c, 0])) as Record<SkillCategory, number>;
}

function zeroPhysical(): Record<PhysicalQuality, number> {
	return Object.fromEntries(PHYSICAL_QUALITIES.map((q) => [q, 0])) as Record<
		PhysicalQuality,
		number
	>;
}

/** Scales so the strongest entry is 1. Leaves an all-zero map alone rather than dividing by zero. */
function normalise<K extends string>(weights: Record<K, number>): Record<K, number> {
	const max = Math.max(...Object.values<number>(weights));
	if (max <= 0) return weights;
	const scaled = { ...weights };
	for (const key of Object.keys(scaled) as K[]) scaled[key] = scaled[key] / max;
	return scaled;
}

/**
 * The player's effective skill and physical emphasis, blending primary and
 * secondary positions as `primary + secondary * SECONDARY_POSITION_WEIGHT` and
 * normalising so the strongest emphasis is 1.
 *
 * Normalising after blending matters: a player with two positions should not
 * come out scoring higher across the board than a specialist, only differently
 * shaped.
 */
export function positionWeights(ctx: RecommendationContext): BlendedWeights {
	const byPosition = new Map(ctx.positions.map((p) => [p.position, p]));
	const skills = zeroSkills();
	const physical = zeroPhysical();

	const contributors: Array<{ position: Position | null; share: number }> = [
		{ position: ctx.profile.primary_position, share: 1 },
		{ position: ctx.profile.secondary_position, share: SECONDARY_POSITION_WEIGHT }
	];

	for (const { position, share } of contributors) {
		if (!position) continue;
		const profile = byPosition.get(position);
		if (!profile) continue;
		for (const [category, weight] of Object.entries(profile.skill_weights)) {
			skills[category as SkillCategory] += (weight ?? 0) * share;
		}
		for (const [quality, weight] of Object.entries(profile.physical_weights)) {
			physical[quality as PhysicalQuality] += (weight ?? 0) * share;
		}
	}

	return { skills: normalise(skills), physical: normalise(physical) };
}

/** Why an item was filtered out, structured so the UI can explain it precisely. */
export type ExclusionReason =
	| { kind: 'equipment'; missing: EquipmentAccess[] }
	| { kind: 'age'; required: AgeGroup }
	| { kind: 'junior_strength'; from: AgeGroup };

/**
 * The youngest band shown any strength program at all.
 *
 * Below this, resistance training is withheld entirely rather than regressed to
 * bodyweight: the developing athlete's injury risk is not worth the marginal
 * gain, and an app cannot supervise technique. This is a hard rule in the
 * recommendation layer, not a default the UI may override — see "Duty of care"
 * in plans/player-profile.md.
 *
 * Conditioning is deliberately unaffected. Running is what juniors should be
 * doing, so withholding strength must not leave them with an empty page.
 */
export const STRENGTH_MIN_AGE_GROUP: AgeGroup = 'u17';

/**
 * Whether strength content is withheld from this player entirely. Exported so
 * the UI can say so up front instead of rendering an unexplained empty list.
 */
export function isStrengthWithheld(profile: PlayerProfile): boolean {
	return ageRank(profile.age_group) < ageRank(STRENGTH_MIN_AGE_GROUP);
}

/**
 * The shape eligibility cares about. Deliberately structural rather than
 * `Drill`: Phase 4's `Exercise` carries `min_age_group` and runs through this
 * same filter.
 *
 * `Exercise.contraindicated_regions` is deliberately not read here. Injury
 * flags were forked out to `src/lib/injuries/` (dormant — see that README), so
 * nothing records which regions a player has flagged and the filter has
 * nothing to match against. Exercise content still declares its
 * contraindications; they are simply not consulted while the fork is off.
 */
export interface EligibilityInput {
	equipment_required?: EquipmentAccess[];
	min_age_group?: AgeGroup;
	/** Present on `TrainingProgram`; absent on drills, which are never load-bearing. */
	discipline?: TrainingProgram['discipline'];
}

/** Age bands are ordered, so gating is an index comparison on the fixed taxonomy. */
function ageRank(group: AgeGroup): number {
	return AGE_GROUPS.indexOf(group);
}

/**
 * A hard filter, run before any scoring: age gating and equipment access.
 * Scoring only ever ranks what survives this.
 *
 * Keeping exclusion separate from scoring is what lets the UI say "hidden
 * because you do not have gym access" instead of silently returning a short
 * list. Age gating in particular is a data rule the UI cannot override — see
 * "Duty of care" in plans/player-profile.md.
 *
 * A profile that skipped a question is not punished for it: an empty
 * `equipment_access` means "unknown", so nothing is excluded on equipment.
 * Skipping degrades the ranking rather than emptying the list.
 */
export function isEligible(
	item: EligibilityInput,
	ctx: RecommendationContext
): { eligible: true } | { eligible: false; reason: ExclusionReason } {
	// Checked ahead of `min_age_group` so the player is told the real reason:
	// "strength training starts at Under 17", not "this program is for Under 17
	// and above". The two would otherwise be indistinguishable for a U15.
	if (item.discipline === 'strength' && isStrengthWithheld(ctx.profile)) {
		return {
			eligible: false,
			reason: { kind: 'junior_strength', from: STRENGTH_MIN_AGE_GROUP }
		};
	}

	if (item.min_age_group && ageRank(ctx.profile.age_group) < ageRank(item.min_age_group)) {
		return { eligible: false, reason: { kind: 'age', required: item.min_age_group } };
	}

	const required = item.equipment_required ?? [];
	if (required.length > 0 && ctx.profile.equipment_access.length > 0) {
		const owned = expandEquipmentAccess(ctx.profile.equipment_access);
		const missing = required.filter((eq) => !owned.has(eq));
		if (missing.length > 0) {
			return { eligible: false, reason: { kind: 'equipment', missing } };
		}
	}

	return { eligible: true };
}

/** Sentence fragment for an exclusion, kept here with a test rather than inline in a component. */
export function describeExclusion(reason: ExclusionReason): string {
	switch (reason.kind) {
		case 'equipment':
			return `needs ${formatList(reason.missing.map((e) => EQUIPMENT_ACCESS_LABELS[e].toLowerCase()))}`;
		case 'age':
			return `for ${AGE_GROUP_LABELS[reason.required]} and above`;
		case 'junior_strength':
			return `strength training starts at ${AGE_GROUP_LABELS[reason.from]}`;
	}
}

/**
 * Everything that can keep a drill off the list: the profile-driven rules the
 * player cannot override, and the filter they set themselves.
 *
 * One union because the UI shows them in one disclosure. Keeping them apart in
 * the type would only push the join into every component.
 */
export type DrillExclusionReason = ExclusionReason | DrillFilterReason;

/** Sentence fragment for either kind of exclusion. */
export function describeDrillExclusion(reason: DrillExclusionReason): string {
	switch (reason.kind) {
		case 'players':
		case 'duration':
		case 'place':
			return describeDrillFilterReason(reason);
		default:
			return describeExclusion(reason);
	}
}

export interface ScoredDrill {
	drill: Drill;
	/** 0–1. Comparable within one call, not across profiles. */
	score: number;
	/** Short "why this one" line, or null when nothing about it stands out. */
	reason: string | null;
}

export interface DrillRecommendations {
	recommended: ScoredDrill[];
	/** Shown, not hidden — a collapsed "3 not shown" row that explains itself. */
	excluded: Array<{ drill: Drill; reason: DrillExclusionReason }>;
}

/**
 * A scorer returns 0–1 for one drill. Scoring is a list of weighted scorers
 * rather than one formula so future signals — the obvious next one being
 * "weakest skill", read from `totalsByCategory` in `stats.ts` — drop in
 * without touching the existing ones.
 */
type Scorer = (drill: Drill, ctx: RecommendationContext, weights: BlendedWeights) => number;

/** How closely the drill's skill category matches what the position demands. */
const positionFit: Scorer = (drill, _ctx, weights) => weights.skills[drill.category] ?? 0;

/**
 * Drills explicitly tagged for a position — ruck taps, spoiling, set-shot
 * routines — get a lift over the baseline category match.
 *
 * An untagged drill is general, not irrelevant, so it sits at a neutral
 * midpoint. A drill tagged only for other positions sits below it: a set-shot
 * routine tagged `key_forward` is genuinely less useful to a back pocket than
 * a general kicking drill is.
 */
const UNTAGGED_FIT = 0.4;
const positionTagFit: Scorer = (drill, ctx) => {
	const tags = drill.position_tags ?? [];
	if (tags.length === 0) return UNTAGGED_FIT;
	if (tags.includes(ctx.profile.primary_position)) return 1;
	const secondary = ctx.profile.secondary_position;
	if (secondary && tags.includes(secondary)) return 0.7;
	return 0;
};

/** The difficulty a player is ready for, by experience. */
const TARGET_DIFFICULTY: Record<PlayerProfile['experience'], number> = {
	first_year: 1,
	developing: 2,
	experienced: 3
};

/** Full marks at the matching difficulty, tapering either side rather than cutting off. */
const difficultyFit: Scorer = (drill, ctx) => {
	const target = TARGET_DIFFICULTY[ctx.profile.experience];
	return 1 - Math.abs(drill.difficulty - target) / 2;
};

/**
 * Shorter drills first, for masters only.
 *
 * Deliberately about time rather than difficulty. A masters player is usually
 * the most experienced person in the club and training around work and family:
 * what they are short of is twenty spare minutes, not ability. Dropping them to
 * foundation drills would be solving the wrong problem, and patronising with
 * it.
 *
 * Everyone else gets a flat score, which leaves their ranking exactly as it
 * was — a constant scorer shifts every drill equally.
 */
const NEUTRAL = 0.5;
/** Drills at or under this are "short" for scoring purposes. */
const SHORT_DRILL_MINUTES = 10;
const brevityFit: Scorer = (drill, ctx) => {
	if (!isMasters(ctx.profile)) return NEUTRAL;
	if (drill.duration_minutes <= SHORT_DRILL_MINUTES) return 1;
	return Math.max(0, 1 - (drill.duration_minutes - SHORT_DRILL_MINUTES) / 20);
};

const SCORERS: Array<{ scorer: Scorer; weight: number }> = [
	{ scorer: positionFit, weight: 0.55 },
	{ scorer: positionTagFit, weight: 0.2 },
	{ scorer: difficultyFit, weight: 0.15 },
	{ scorer: brevityFit, weight: 0.1 }
];

/** The skill weight above which a category counts as a priority for the position. */
const PRIORITY_SKILL_WEIGHT = 0.75;

function explain(drill: Drill, ctx: RecommendationContext, weights: BlendedWeights): string | null {
	const tags = drill.position_tags ?? [];
	if (tags.includes(ctx.profile.primary_position)) {
		return `Specific to ${POSITION_LABELS[ctx.profile.primary_position].toLowerCase()}`;
	}
	const secondary = ctx.profile.secondary_position;
	if (secondary && tags.includes(secondary)) {
		return `Specific to ${POSITION_LABELS[secondary].toLowerCase()}, your second position`;
	}
	if ((weights.skills[drill.category] ?? 0) >= PRIORITY_SKILL_WEIGHT) {
		return `${SKILL_CATEGORY_LABELS[drill.category]} is a priority for your position`;
	}
	if (difficultyFit(drill, ctx, weights) === 1) return 'Pitched at your experience level';
	return null;
}

/**
 * Ranks drills for a player: eligibility as a hard filter, then weighted
 * scoring over whatever survives it.
 *
 * Returns the exclusions alongside the recommendations rather than dropping
 * them, so the UI can account for a short list instead of just looking empty.
 * Hidden drills (`active: 0`) are not exclusions — they are gone from the
 * library entirely and normally never reach here.
 *
 * The player's own filter runs after eligibility, not before it, and the order
 * is deliberate. A drill the profile rules out is ruled out whatever the player
 * is standing in front of, so that is the honest reason to show; telling
 * someone a gym program "needs 3 players" when they could not have done it
 * anyway sends them looking for a training partner they do not need.
 */
export function recommendDrills(
	drills: Drill[],
	ctx: RecommendationContext,
	limit?: number
): DrillRecommendations {
	const weights = positionWeights(ctx);
	const filter = ctx.filter ?? noDrillFilter();
	const recommended: ScoredDrill[] = [];
	const excluded: DrillRecommendations['excluded'] = [];

	for (const drill of drills) {
		if (drill.active === 0) continue;
		const eligibility = isEligible(drill, ctx);
		if (!eligibility.eligible) {
			excluded.push({ drill, reason: eligibility.reason });
			continue;
		}
		const fits = matchesFilter(drill, filter);
		if (!fits.matches) {
			excluded.push({ drill, reason: fits.reason });
			continue;
		}
		const score = SCORERS.reduce(
			(sum, { scorer, weight }) => sum + scorer(drill, ctx, weights) * weight,
			0
		);
		recommended.push({ drill, score, reason: explain(drill, ctx, weights) });
	}

	// Name breaks ties so the order is stable across reloads — a list that
	// reshuffles itself mid-session reads as broken.
	recommended.sort((a, b) => b.score - a.score || a.drill.name.localeCompare(b.drill.name));

	return {
		recommended: limit === undefined ? recommended : recommended.slice(0, limit),
		excluded
	};
}

/** The categories the position leans on hardest, strongest first. Drives the "why these" copy. */
export function priorityCategories(ctx: RecommendationContext, limit = 3): SkillCategory[] {
	const { skills } = positionWeights(ctx);
	return SKILL_CATEGORIES.filter((c) => skills[c] > 0)
		.sort((a, b) => skills[b] - skills[a] || a.localeCompare(b))
		.slice(0, limit);
}

export interface ScoredProgram {
	program: TrainingProgram;
	/** 0–1. Comparable within one call, not across profiles. */
	score: number;
	/** Short "why this one" line, or null when nothing about it stands out. */
	reason: string | null;
	/** Why this one asks more than the player needs, for a block shown but not led with. */
	caution: string | null;
}

export interface ProgramRecommendations {
	recommended: ScoredProgram[];
	excluded: Array<{ program: TrainingProgram; reason: ExclusionReason }>;
}

type ProgramScorer = (
	program: TrainingProgram,
	ctx: RecommendationContext,
	weights: BlendedWeights
) => number;

/**
 * How well the program's target qualities line up with what the position
 * demands. Averaged rather than summed so a program targeting one quality the
 * player needs badly is not beaten by one targeting four they need mildly.
 */
const qualityFit: ProgramScorer = (program, _ctx, weights) => {
	if (program.target_qualities.length === 0) return 0.5;
	const total = program.target_qualities.reduce((sum, q) => sum + (weights.physical[q] ?? 0), 0);
	return total / program.target_qualities.length;
};

/**
 * Programs written for a position beat general ones, but an untargeted program
 * is general rather than irrelevant — most strength work applies to everyone —
 * so it sits well above a program written for somebody else's role.
 */
const UNTARGETED_PROGRAM_FIT = 0.6;
const programPositionFit: ProgramScorer = (program, ctx) => {
	if (program.target_positions.length === 0) return UNTARGETED_PROGRAM_FIT;
	if (program.target_positions.includes(ctx.profile.primary_position)) return 1;
	const secondary = ctx.profile.secondary_position;
	if (secondary && program.target_positions.includes(secondary)) return 0.7;
	return 0;
};

/**
 * Experience is a scorer, not a filter. A first-year player choosing an
 * advanced block is making a training mistake, not an unsafe one — the unsafe
 * cases are age and load, and those are already hard filters. Ranking it down
 * keeps the list honest without emptying it.
 */
const EXPERIENCE_ORDER: ExperienceLevel[] = ['first_year', 'developing', 'experienced'];
const programExperienceFit: ProgramScorer = (program, ctx) => {
	if (program.experience.length === 0) return 0.5;
	if (program.experience.includes(ctx.profile.experience)) return 1;
	const player = EXPERIENCE_ORDER.indexOf(ctx.profile.experience);
	const nearest = Math.min(
		...program.experience.map((e) => Math.abs(EXPERIENCE_ORDER.indexOf(e) - player))
	);
	return Math.max(0, 1 - nearest / 2);
};

/**
 * Whether the program asks for more sessions a week than the player has said
 * they train. Asking for fewer is fine — that leaves room for skills work —
 * so only overshoot is penalised.
 */
const availabilityFit: ProgramScorer = (program, ctx) => {
	const available = ctx.profile.sessions_per_week;
	if (available <= 0) return 0.5; // Unanswered, so no signal either way.
	if (program.sessions_per_week <= available) return 1;
	return Math.max(0, 1 - (program.sessions_per_week - available) / available);
};

/**
 * For masters, lighter blocks first: fewer sessions a week, and in-season
 * maintenance ahead of a full pre-season.
 *
 * Ranking rather than filtering, deliberately. A masters player who wants a
 * pre-season block can still have one — it simply is not what the app leads
 * with, and it carries a note saying what it is. Hiding it would be deciding
 * for them.
 */
const recoveryFit: ProgramScorer = (program, ctx) => {
	if (!isMasters(ctx.profile)) return NEUTRAL;
	const frequency = Math.max(
		0,
		1 - Math.max(0, program.sessions_per_week - MASTERS_COMFORTABLE_SESSIONS) / 3
	);
	const phase = program.phase === 'pre_season' ? 0.5 : 1;
	return frequency * phase;
};

/**
 * Content written for the player's own age band, ahead of content written for
 * a much younger one.
 *
 * `min_age_group` is a floor, not an audience: it stops a fifteen year old
 * reaching a barbell, and it does nothing to stop a forty year old being led to
 * a block named "Under 17". The gap is what matters, and only a wide one — a
 * single band's difference is normal and often right, since a first-year senior
 * belongs in the same foundations block as a U17. Two bands or more means the
 * block was written for somebody else.
 */
const AGE_FIT_TOLERANCE = 1;
const ageFit: ProgramScorer = (program, ctx) => {
	const gap = ageRank(ctx.profile.age_group) - ageRank(program.min_age_group);
	if (gap <= AGE_FIT_TOLERANCE) return 1;
	return Math.max(0, 1 - (gap - AGE_FIT_TOLERANCE) / 3);
};

const PROGRAM_SCORERS: Array<{ scorer: ProgramScorer; weight: number }> = [
	{ scorer: qualityFit, weight: 0.35 },
	{ scorer: programPositionFit, weight: 0.15 },
	{ scorer: programExperienceFit, weight: 0.15 },
	{ scorer: availabilityFit, weight: 0.1 },
	{ scorer: recoveryFit, weight: 0.15 },
	{ scorer: ageFit, weight: 0.1 }
];

/** The physical weight above which a quality counts as a priority for the position. */
const PRIORITY_QUALITY_WEIGHT = 0.75;

function explainProgram(
	program: TrainingProgram,
	ctx: RecommendationContext,
	weights: BlendedWeights
): string | null {
	if (program.target_positions.includes(ctx.profile.primary_position)) {
		return `Written for ${POSITION_LABELS[ctx.profile.primary_position].toLowerCase()}`;
	}
	const priority = program.target_qualities.find(
		(q) => (weights.physical[q] ?? 0) >= PRIORITY_QUALITY_WEIGHT
	);
	if (priority) {
		return `${PHYSICAL_QUALITY_LABELS[priority]} is a priority for your position`;
	}
	if (program.experience.includes(ctx.profile.experience))
		return 'Pitched at your experience level';
	return null;
}

/**
 * Ranks programs for a player: eligibility as a hard filter, then weighted
 * scoring over what survives.
 *
 * The exclusions come back rather than being dropped so the UI can explain a
 * short list. For a player below `STRENGTH_MIN_AGE_GROUP` that matters most of
 * all: every strength program will be excluded, and saying why is the whole
 * point — an unexplained empty list reads as a broken app, and this one is a
 * deliberate decision about their safety.
 */
export function recommendPrograms(
	programs: TrainingProgram[],
	ctx: RecommendationContext,
	limit?: number
): ProgramRecommendations {
	const weights = positionWeights(ctx);
	const recommended: ScoredProgram[] = [];
	const excluded: ProgramRecommendations['excluded'] = [];

	for (const program of programs) {
		const eligibility = isEligible(program, ctx);
		if (!eligibility.eligible) {
			excluded.push({ program, reason: eligibility.reason });
			continue;
		}
		const score = PROGRAM_SCORERS.reduce(
			(sum, { scorer, weight }) => sum + scorer(program, ctx, weights) * weight,
			0
		);
		recommended.push({
			program,
			score,
			reason: explainProgram(program, ctx, weights),
			caution: describeProgramCaution(ctx.profile, program.sessions_per_week, program.phase)
		});
	}

	// Name breaks ties so the order is stable across reloads.
	recommended.sort((a, b) => b.score - a.score || a.program.name.localeCompare(b.program.name));

	return {
		recommended: limit === undefined ? recommended : recommended.slice(0, limit),
		excluded
	};
}

/** The qualities the position leans on hardest, strongest first. Drives the "why these" copy. */
export function priorityQualities(ctx: RecommendationContext, limit = 3): PhysicalQuality[] {
	const { physical } = positionWeights(ctx);
	return PHYSICAL_QUALITIES.filter((q) => physical[q] > 0)
		.sort((a, b) => physical[b] - physical[a] || a.localeCompare(b))
		.slice(0, limit);
}
