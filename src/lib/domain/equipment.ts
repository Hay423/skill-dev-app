import type { EquipmentAccess } from '$lib/types';

/**
 * Kit and places that contain other kit and places.
 *
 * Two distinct kinds of containment live here, and the distinction is what
 * keeps the list defensible:
 *
 * - **Gear**: a full gym has dumbbells and bands in it, so a player who ticked
 *   only "Full gym" must not be excluded from a program written for home
 *   weights.
 * - **Space**: the places form a chain by size. Goals stand on an oval, an oval
 *   contains a park and a park a backyard, so a drill authored for 5 m of grass
 *   runs anywhere bigger. A wall is a backyard with something to kick against.
 *
 * The chain runs one way only, and the asymmetry is the point: **goals imply an
 * oval, an oval does not imply goals.** Posts are a fixture, not a size — most
 * suburban ovals are locked or marked for cricket half the year — but there is
 * nowhere to put posts except a ground.
 *
 * That direction started mattering when the player's filter went single-select:
 * somebody standing at the goals can only name one place, and they should still
 * be offered everything that runs on the grass around them. Ranking a player out
 * of eight drills because they said where they were is the opposite of what the
 * filter is for.
 *
 * The map is transitively closed by hand (`goals` lists `park` and `backyard`
 * as well as `oval`) so expansion stays a single pass. Any new entry must be
 * closed the same way.
 */
const EQUIPMENT_IMPLIES: Partial<Record<EquipmentAccess, EquipmentAccess[]>> = {
	full_gym: ['home_weights', 'bands'],
	goals: ['oval', 'park', 'backyard'],
	oval: ['park', 'backyard'],
	park: ['backyard'],
	wall: ['backyard']
};

/** What a player can actually train with, including the kit and space their access implies. */
export function expandEquipmentAccess(access: EquipmentAccess[]): Set<EquipmentAccess> {
	const owned = new Set(access);
	for (const item of access) {
		for (const implied of EQUIPMENT_IMPLIES[item] ?? []) owned.add(implied);
	}
	return owned;
}
