import type { Drill } from '$lib/types';

/**
 * How a drill is described in a list.
 *
 * One function because the player count appears everywhere a drill name does —
 * the library, the detail page, the picker on the log screen, the week plan, the
 * admin library — and a count worded one way in one place and another way in the
 * next reads as two different facts about the same drill.
 */

/**
 * The player requirement in brackets, as it is appended to a drill's name.
 *
 * `min_players` is a floor, not an exact figure: a drill written for two works
 * with three, so anything above one reads as `2+`. One player is `solo` rather
 * than `1 player`, because "can I do this on my own?" is the question actually
 * being asked — by a player standing in a park at seven in the morning with a
 * ball and nobody else there.
 */
export function describePlayerCount(min_players: number): string {
	// Content is validated on import (`drill-import.ts` rejects anything below
	// one), but a hand-edited row should still read sensibly rather than
	// claiming "0+ players".
	if (min_players <= 1) return 'solo';
	return `${min_players}+ players`;
}

/** A drill's name with its player requirement in brackets: `Wall kick repeaters (solo)`. */
export function drillTitle(drill: Pick<Drill, 'name' | 'min_players'>): string {
	return `${drill.name} (${describePlayerCount(drill.min_players)})`;
}
