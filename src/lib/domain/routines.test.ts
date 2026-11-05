import { describe, expect, it } from 'vitest';
import type { MovementPattern } from '$lib/types';
import { FAST_RUNNING_HR_PCT, isMainItem, routineFocus, splitSections } from './routines';

describe('routineFocus', () => {
	const lift = (movement_pattern: MovementPattern) => ({ movement_pattern, hr_pct_max: null });
	const run = (hr_pct_max: number | null) => ({ movement_pattern: null, hr_pct_max });

	it('warms up the legs for a leg day', () => {
		expect(
			routineFocus('strength', [lift('squat'), lift('hinge'), lift('lunge'), lift('core')])
		).toBe('gym_lower');
	});

	it('warms up the shoulders only when pushing and pulling is most of the session', () => {
		expect(routineFocus('strength', [lift('push'), lift('pull'), lift('push'), lift('core')])).toBe(
			'gym_upper'
		);
	});

	it('breaks a tie towards the legs', () => {
		// The hamstring is the injury a skipped warm-up costs a footballer.
		expect(routineFocus('strength', [lift('push'), lift('squat')])).toBe('gym_lower');
	});

	it('reads a power day as lower body — jumps and cleans start from the floor', () => {
		expect(
			routineFocus('strength', [lift('plyometric'), lift('olympic'), lift('push'), lift('core')])
		).toBe('gym_lower');
	});

	it('calls a running session fast when any effort reaches the threshold', () => {
		expect(routineFocus('running', [run(75), run(FAST_RUNNING_HR_PCT)])).toBe('run_fast');
		expect(routineFocus('running', [run(75), run(FAST_RUNNING_HR_PCT - 1)])).toBe('run_easy');
	});

	it('treats a running session with no bands at all as easy', () => {
		expect(routineFocus('running', [run(null)])).toBe('run_easy');
	});

	it('gives a jumping session the jumping warm-up', () => {
		expect(routineFocus('plyometric', [lift('plyometric')])).toBe('jump');
	});

	it('gives a skills or recovery session no routine', () => {
		expect(routineFocus('skills', [])).toBeNull();
		expect(routineFocus('recovery', [run(55)])).toBeNull();
	});
});

describe('splitSections', () => {
	it('splits items into the three sections, keeping the order within each', () => {
		const items = [
			{ id: 'w1', section: 'warm_up' as const },
			{ id: 'w2', section: 'warm_up' as const },
			{ id: 'm1', section: 'main' as const },
			{ id: 'm2', section: 'main' as const },
			{ id: 'c1', section: 'cool_down' as const }
		];
		const split = splitSections(items, (i) => i);
		expect(split.warm_up.map((i) => i.id)).toEqual(['w1', 'w2']);
		expect(split.main.map((i) => i.id)).toEqual(['m1', 'm2']);
		expect(split.cool_down.map((i) => i.id)).toEqual(['c1']);
	});

	it('reads the section through a wrapper, as the session view holds items', () => {
		const wrapped = [
			{ item: { section: 'cool_down' as const } },
			{ item: { section: 'main' as const } }
		];
		const split = splitSections(wrapped, (w) => w.item);
		expect(split.main).toHaveLength(1);
		expect(split.cool_down).toHaveLength(1);
		expect(split.warm_up).toEqual([]);
	});
});

describe('isMainItem', () => {
	it('is true only for main work', () => {
		expect(isMainItem({ section: 'main' })).toBe(true);
		expect(isMainItem({ section: 'warm_up' })).toBe(false);
		expect(isMainItem({ section: 'cool_down' })).toBe(false);
	});
});
