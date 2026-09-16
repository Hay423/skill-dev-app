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
