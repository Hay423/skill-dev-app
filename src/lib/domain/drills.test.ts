import { describe, expect, it } from 'vitest';
import { describePlayerCount, drillTitle } from './drills';
import { SEED_DRILLS } from '$lib/data/seed/drills';

describe('describePlayerCount', () => {
	it('calls one player solo rather than counting them', () => {
		expect(describePlayerCount(1)).toBe('solo');
	});

	it('reads a minimum as a minimum', () => {
		expect(describePlayerCount(2)).toBe('2+ players');
		expect(describePlayerCount(3)).toBe('3+ players');
		expect(describePlayerCount(12)).toBe('12+ players');
	});

	it('never claims nobody is needed', () => {
		// Content is validated on import, but a hand-edited row must not render as
		// "0+ players" — an impossible drill is worse than an imprecise one.
		expect(describePlayerCount(0)).toBe('solo');
		expect(describePlayerCount(-1)).toBe('solo');
	});
});

describe('drillTitle', () => {
	it('puts the requirement in brackets after the name', () => {
		expect(drillTitle({ name: 'Wall kick repeaters', min_players: 1 })).toBe(
			'Wall kick repeaters (solo)'
		);
		expect(drillTitle({ name: 'Kick to a leading target', min_players: 2 })).toBe(
			'Kick to a leading target (2+ players)'
		);
	});

	it('brackets every drill in the seed library exactly once', () => {
		// The count is in the name now, so a drill whose authored name already
		// carried one would read "(2+ players) (2+ players)".
		for (const drill of SEED_DRILLS) {
			const title = drillTitle(drill);
			expect(title.match(/\(/g)).toHaveLength(1);
			expect(title.endsWith(')')).toBe(true);
			expect(title.startsWith(drill.name)).toBe(true);
		}
	});
});
