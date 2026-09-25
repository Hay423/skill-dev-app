/**
 * The app's navigation, in one place so the bottom bar and the burger menu
 * can never disagree about a page's label, icon, or active state.
 */
export interface NavLink {
	href: string;
	label: string;
	icon: string;
}

/** Every page in the app, in the order they read in the burger menu. */
export const NAV_LINKS: NavLink[] = [
	{ href: '/', label: 'Today', icon: '◎' },
	{ href: '/drills', label: 'Drills', icon: '▦' },
	{ href: '/log', label: 'Log', icon: '＋' },
	{ href: '/train', label: 'Train', icon: '⚡' },
	{ href: '/progress', label: 'Progress', icon: '📈' },
	{ href: '/profile', label: 'Profile', icon: '☺' }
];

/**
 * The pages that stay one tap away on every screen: the two logging loops
 * (skills, strength/running) plus the two places you check on progress. Drills
 * and Profile move to the burger menu — both are lower-frequency, and both
 * stay reachable from links inside the pages that remain.
 */
export const BOTTOM_NAV_HREFS = ['/', '/log', '/train', '/progress'];

/** A nested route (e.g. `/train/[slug]`) counts as active for its top-level link. */
export function isNavActive(href: string, pathname: string): boolean {
	return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * The tab the bottom bar would move to for a horizontal swipe, or `null` when
 * the gesture should do nothing.
 *
 * Swiping only walks the bottom bar's four tabs, and only from a tab's own
 * page: on a nested page (`/train/[slug]`, a drill) a sideways flick reads as
 * "back", not "next tab", so it is left alone. There is deliberately no wrap —
 * at either end the swipe is a no-op, because silently jumping from Progress
 * to Today hides which way the row runs.
 *
 * `direction` is the finger's travel: 'left' means the content moved left, so
 * the next tab comes in from the right.
 */
export function nextTabHref(pathname: string, direction: 'left' | 'right'): string | null {
	const current = BOTTOM_NAV_HREFS.indexOf(pathname);
	if (current === -1) return null;
	const next = current + (direction === 'left' ? 1 : -1);
	return BOTTOM_NAV_HREFS[next] ?? null;
}

/** Which way a tab change should slide, or `null` when it should not slide. */
export type TabSlide = 'forward' | 'back';

/**
 * The direction a navigation moves along the bottom bar, or `null` when the two
 * pages are not both tabs — going into a drill or out to the burger menu's
 * pages is a change of depth, not a sideways step, so it stays instant.
 *
 * Taps on the bar animate for the same reason swipes do: the row has an order,
 * and showing which way you moved along it is what makes the order legible.
 */
export function tabSlideDirection(
	from: string | undefined,
	to: string | undefined
): TabSlide | null {
	if (from === undefined || to === undefined) return null;
	const a = BOTTOM_NAV_HREFS.indexOf(from);
	const b = BOTTOM_NAV_HREFS.indexOf(to);
	if (a === -1 || b === -1 || a === b) return null;
	return b > a ? 'forward' : 'back';
}
