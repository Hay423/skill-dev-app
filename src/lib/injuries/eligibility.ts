/**
 * Injury contraindication filter — DORMANT. See ./README.md.
 *
 * Forked out of `isEligible` in `src/lib/domain/recommend.ts`. Pure, tested,
 * and called by nothing. To re-enable, call `injuryExclusion()` from
 * `isEligible` between the age gate and the equipment check, and restore
 * `{ kind: 'injury' }` to `ExclusionReason`.
 */
import { BODY_REGION_LABELS, type BodyRegion } from '$lib/types';
import type { InjuryFlag } from './types';

/** The exclusion `isEligible` would return. Kept structurally identical to the live reasons. */
export interface InjuryExclusion {
	kind: 'injury';
	regions: BodyRegion[];
}

/**
 * The regions an item is contraindicated for that the player currently has
 * flagged, or null when nothing collides.
 *
 * A historical injury is recovered, so it no longer excludes anything. Current
 * and recent ones do — the app excludes, it never treats or clears.
 */
export function injuryExclusion(
	item: { contraindicated_regions?: BodyRegion[] },
	injuries: InjuryFlag[]
): InjuryExclusion | null {
	const flagged = new Set(injuries.filter((i) => i.status !== 'historical').map((i) => i.region));
	const contraindicated = (item.contraindicated_regions ?? []).filter((r) => flagged.has(r));
	return contraindicated.length > 0 ? { kind: 'injury', regions: contraindicated } : null;
}

/**
 * Sentence fragment for the exclusions row. Worded so it never reads as
 * clearance or as a claim that anything has healed.
 */
export function describeInjuryExclusion(exclusion: InjuryExclusion): string {
	const regions = exclusion.regions.map((r) => BODY_REGION_LABELS[r].toLowerCase());
	const list =
		regions.length <= 1
			? (regions[0] ?? '')
			: `${regions.slice(0, -1).join(', ')} and ${regions.at(-1)}`;
	return `set aside while your ${list} is flagged`;
}
