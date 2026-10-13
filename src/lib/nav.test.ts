import { describe, expect, it } from 'vitest';
import { BOTTOM_NAV_HREFS, isNavActive, nextTabHref, tabSlideDirection } from './nav';

describe('isNavActive', () => {
	it('matches Today only exactly', () => {
		expect(isNavActive('/', '/')).toBe(true);
		expect(isNavActive('/', '/log')).toBe(false);
	});

	it('counts a nested route as active for its top-level link', () => {
		expect(isNavActive('/train', '/train/aerobic-base/3')).toBe(true);
		expect(isNavActive('/tests', '/tests/kicking-accuracy-senior')).toBe(true);
	});
});

describe('nextTabHref', () => {
	it('walks forward and back along the bottom bar', () => {
		expect(nextTabHref('/', 'left')).toBe('/log');
		expect(nextTabHref('/log', 'left')).toBe('/train');
		expect(nextTabHref('/train', 'left')).toBe('/tests');
		expect(nextTabHref('/tests', 'left')).toBe('/progress');
		expect(nextTabHref('/tests', 'right')).toBe('/train');
		expect(nextTabHref('/train', 'right')).toBe('/log');
		expect(nextTabHref('/log', 'right')).toBe('/');
	});

	it('stops at both ends rather than wrapping', () => {
		expect(nextTabHref('/', 'right')).toBeNull();
		expect(nextTabHref(BOTTOM_NAV_HREFS.at(-1)!, 'left')).toBeNull();
	});

	it('ignores pages outside the bottom bar', () => {
		expect(nextTabHref('/drills', 'left')).toBeNull();
		expect(nextTabHref('/profile', 'right')).toBeNull();
	});

	it('ignores nested pages, where sideways means back', () => {
		expect(nextTabHref('/train/aerobic-base', 'left')).toBeNull();
		expect(nextTabHref('/drills/drop-punt-20m', 'right')).toBeNull();
		// Mid-test, a sideways flick must not walk off the runner.
		expect(nextTabHref('/tests/set-shots', 'left')).toBeNull();
	});
});

describe('tabSlideDirection', () => {
	it('reads the direction from the order of the bar', () => {
		expect(tabSlideDirection('/', '/log')).toBe('forward');
		expect(tabSlideDirection('/', '/progress')).toBe('forward');
		expect(tabSlideDirection('/progress', '/log')).toBe('back');
		expect(tabSlideDirection('/log', '/')).toBe('back');
	});

	it('does not slide when either end is not a tab', () => {
		expect(tabSlideDirection('/', '/drills')).toBeNull();
		expect(tabSlideDirection('/train/aerobic-base', '/train')).toBeNull();
		expect(tabSlideDirection('/profile', '/profile/drills/new')).toBeNull();
	});

	it('does not slide on a navigation to the same tab', () => {
		expect(tabSlideDirection('/log', '/log')).toBeNull();
	});

	it('does not slide on the first load, where there is no previous page', () => {
		expect(tabSlideDirection(undefined, '/log')).toBeNull();
		expect(tabSlideDirection('/log', undefined)).toBeNull();
	});
});
