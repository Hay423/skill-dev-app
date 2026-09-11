import {
	AGE_GROUPS,
	AGE_GROUP_LABELS,
	EQUIPMENT_ACCESS_LABELS,
	PHYSICAL_QUALITIES,
	POSITION_LABELS,
	SKILL_CATEGORIES,
	SKILL_CATEGORY_LABELS,
	type AgeGroup,
	type Drill,
	type EquipmentAccess,
	type IsoDate,
	type PhysicalQuality,
	type PlayerProfile,
	type Position,
	type PositionProfile,
	type SkillCategory
} from '$lib/types';

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
	{ kind: 'equipment'; missing: EquipmentAccess[] } | { kind: 'age'; required: AgeGroup };

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
	if (item.min_age_group && ageRank(ctx.profile.age_group) < ageRank(item.min_age_group)) {
		return { eligible: false, reason: { kind: 'age', required: item.min_age_group } };
	}

	const required = item.equipment_required ?? [];
	if (required.length > 0 && ctx.profile.equipment_access.length > 0) {
		const owned = new Set(ctx.profile.equipment_access);
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
	}
}

function formatList(items: string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
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
	excluded: Array<{ drill: Drill; reason: ExclusionReason }>;
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

const SCORERS: Array<{ scorer: Scorer; weight: number }> = [
	{ scorer: positionFit, weight: 0.6 },
	{ scorer: positionTagFit, weight: 0.2 },
	{ scorer: difficultyFit, weight: 0.2 }
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
 */
export function recommendDrills(
	drills: Drill[],
	ctx: RecommendationContext,
	limit?: number
): DrillRecommendations {
	const weights = positionWeights(ctx);
	const recommended: ScoredDrill[] = [];
	const excluded: DrillRecommendations['excluded'] = [];

	for (const drill of drills) {
		if (drill.active === 0) continue;
		const eligibility = isEligible(drill, ctx);
		if (!eligibility.eligible) {
			excluded.push({ drill, reason: eligibility.reason });
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
