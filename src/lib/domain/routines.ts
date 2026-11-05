import type { ItemSection, MovementPattern, ProgramItem, ProgramSession } from '$lib/types';

/**
 * Warm-ups and cool-downs: which kind a session needs, and how a session's
 * items divide into the three sections a player works through.
 *
 * The routines themselves are content (`data/seed/routines.ts`), written once
 * and stamped into every session that needs them. What lives here is the
 * decision of *which* one — a rule, so it is a pure function with a test rather
 * than something re-decided by hand in every program.
 */

/** What a session's warm-up has to prepare the body for. */
export type RoutineFocus = 'gym_lower' | 'gym_upper' | 'run_easy' | 'run_fast' | 'jump';

/** Patterns that load the legs and hips. Olympic lifts and jumps count: both start from the floor. */
const LOWER_PATTERNS: ReadonlySet<MovementPattern> = new Set([
	'squat',
	'hinge',
	'lunge',
	'plyometric',
	'olympic'
]);
const UPPER_PATTERNS: ReadonlySet<MovementPattern> = new Set(['push', 'pull']);

/**
 * The heart rate, as `%HRmax`, at which running counts as fast enough to need
 * the full warm-up: drills, then build-ups to near top pace. The bottom of Z4's
 * upper half — strides at three-quarter pace sit under it, shuttles and hard
 * 400s sit over it.
 */
export const FAST_RUNNING_HR_PCT = 85;

/** The part of a main-work item the focus is read from. */
export interface FocusInput {
	movement_pattern: MovementPattern | null;
	hr_pct_max: number | null;
}

/**
 * The warm-up a session needs, read from its main work. Null for a session that
 * gets no routine at all — a skills or recovery session is its own warm-up.
 *
 * - A **strength** session is upper-body only when the pushes and pulls
 *   outnumber the leg work. A tie goes to lower: the hamstring is the injury a
 *   skipped warm-up costs a footballer, not the shoulder.
 * - A **running** session is fast when any of its efforts is prescribed at or
 *   above `FAST_RUNNING_HR_PCT`. One fast rep is enough — it is the rep that
 *   finds the cold hamstring.
 */
export function routineFocus(
	session_type: ProgramSession['type'],
	main: FocusInput[]
): RoutineFocus | null {
	switch (session_type) {
		case 'strength': {
			const lower = main.filter(
				(i) => i.movement_pattern && LOWER_PATTERNS.has(i.movement_pattern)
			).length;
			const upper = main.filter(
				(i) => i.movement_pattern && UPPER_PATTERNS.has(i.movement_pattern)
			).length;
			return upper > lower ? 'gym_upper' : 'gym_lower';
		}
		case 'running':
			return main.some((i) => i.hr_pct_max !== null && i.hr_pct_max >= FAST_RUNNING_HR_PCT)
				? 'run_fast'
				: 'run_easy';
		case 'plyometric':
			return 'jump';
		case 'skills':
		case 'recovery':
			return null;
	}
}

export interface SessionSections<T> {
	warm_up: T[];
	main: T[];
	cool_down: T[];
}

/**
 * A session's items split into warm-up, main work and cool-down, each in the
 * order given. Generic over the item wrapper so the session view can split the
 * `{ item, exercise }` pairs it already renders.
 */
export function splitSections<T>(
	entries: T[],
	itemOf: (entry: T) => Pick<ProgramItem, 'section'>
): SessionSections<T> {
	const sections: SessionSections<T> = { warm_up: [], main: [], cool_down: [] };
	for (const entry of entries) sections[itemOf(entry).section].push(entry);
	return sections;
}

export const SECTION_LABELS: Record<ItemSection, string> = {
	warm_up: 'Warm-up',
	main: 'Main work',
	cool_down: 'Cool-down'
};

/** Whether an item is part of the session proper rather than its warm-up or cool-down. */
export function isMainItem(item: Pick<ProgramItem, 'section'>): boolean {
	return item.section === 'main';
}
