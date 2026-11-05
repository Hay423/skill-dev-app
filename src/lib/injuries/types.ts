/**
 * Injury flag types — DORMANT. See ./README.md.
 *
 * These lived in `src/lib/types.ts` until injury collection was forked out of
 * the app to avoid storing health data. Nothing imports them today. They are
 * kept here, unchanged, so re-enabling is a wiring job rather than a rewrite.
 *
 * `BodyRegion` is deliberately still imported from the live domain model: it
 * describes reference content (which regions an exercise is unsuitable for),
 * not anything about a player, so it never left.
 */
import type { BodyRegion, IsoDate } from '$lib/types';

export const INJURY_STATUSES = ['current', 'recent', 'historical'] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
	current: 'Current',
	recent: 'Recent',
	historical: 'Historical (fully recovered)'
};

/**
 * A body region and a coarse status — never clinical detail. A flagged
 * region excludes contraindicated content; the app never implies it is
 * treating or resolving anything.
 */
export interface InjuryFlag {
	region: BodyRegion;
	status: InjuryStatus;
	note: string | null;
	since: IsoDate | null;
}
