import {
	PHYSICAL_QUALITY_LABELS,
	type Exercise,
	type ProgramItem,
	type ProgramPlan,
	type ProgramSession,
	type ProgramWeek,
	type TrainingProgram,
	type Uuid
} from '$lib/types';

/**
 * Pure helpers for reading a `ProgramPlan`: slicing it by week, and turning a
 * prescription into the line a player reads mid-session.
 *
 * Programs are authored with their sessions written once and repeated across
 * weeks, with progression carried by each week's `intensity_modifier` (see
 * `data/seed/programs.ts`). Applying that modifier is therefore a rendering
 * concern for every consumer, which is exactly why it lives here with tests
 * rather than inline in a component.
 */

export const PHASE_LABELS: Record<TrainingProgram['phase'], string> = {
	off_season: 'Off-season',
	pre_season: 'Pre-season',
	in_season: 'In-season',
	finals: 'Finals',
	return_to_play: 'Return to play'
};

export const SESSION_TYPE_LABELS: Record<ProgramSession['type'], string> = {
	strength: 'Strength',
	running: 'Running',
	skills: 'Skills',
	recovery: 'Recovery',
	plyometric: 'Plyometrics'
};

export const DISCIPLINE_LABELS: Record<TrainingProgram['discipline'], string> = {
	strength: 'Strength',
	conditioning: 'Running & conditioning',
	plyometrics: 'Plyometrics'
};

/**
 * The order two or three disciplines are done in when they land on the same
 * day: jump, then run, then lift.
 *
 * Explicit rather than alphabetical. The order is a training decision — the
 * fast, neural work comes first because it is the work that is ruined by tired
 * legs, and lifting last because it is the least affected by being third. Sorted
 * alphabetically, 'conditioning' would have come before 'plyometrics' and the
 * running would have been done on legs that had just finished jumping.
 */
export const DISCIPLINE_SESSION_ORDER: Record<TrainingProgram['discipline'], number> = {
	plyometrics: 0,
	conditioning: 1,
	strength: 2
};

/** The sessions of one week, in the order they are meant to be done. */
export function sessionsForWeek(plan: ProgramPlan, week_number: number): ProgramSession[] {
	return plan.sessions
		.filter((s) => s.week_number === week_number)
		.sort((a, b) => a.day_index - b.day_index);
}

export function weekOf(plan: ProgramPlan, week_number: number): ProgramWeek | undefined {
	return plan.weeks.find((w) => w.week_number === week_number);
}

/** One session's items, in prescribed order. */
export function itemsForSession(plan: ProgramPlan, session_id: Uuid): ProgramItem[] {
	return plan.items.filter((i) => i.session_id === session_id).sort((a, b) => a.order - b.order);
}

/**
 * Everything prescribed is scaled by the week's own intensity and then by
 * `adjust` — the player-level modifier from `load-policy.ts`, which is 1 for
 * everybody but masters.
 *
 * Two multipliers rather than one because they answer different questions: the
 * week says where you are in the block, `adjust` says how much this player
 * should be doing at all. Folding them together would mean a masters player's
 * deload and their baseline were the same number.
 */
function modifier(week: ProgramWeek | undefined, adjust: number): number {
	return (week?.intensity_modifier ?? 1) * adjust;
}

/**
 * The item's load for a given week, rounded to the nearest 2.5% — a number a
 * player can act on against a loaded bar, rather than 78.4%.
 *
 * Returns null when the item carries no `%1RM` at all, which is every item in
 * an under-age or conditioning program by design.
 */
export function scaledLoad(
	item: ProgramItem,
	week: ProgramWeek | undefined,
	adjust = 1
): number | null {
	if (item.load_pct_1rm === null) return null;
	return Math.round((item.load_pct_1rm * modifier(week, adjust)) / 2.5) * 2.5;
}

/**
 * Running volume moves with the week: six 400s in a 1.15 week, five in a 0.85
 * one.
 *
 * Volume is where a running block progresses — the distance of a rep is the
 * prescription itself and never changes, so scaling reps is the only honest
 * place to put the week's intensity. Never rounds below one rep: a week is
 * lighter, not cancelled.
 */
export function scaledRepsCount(
	item: ProgramItem,
	week: ProgramWeek | undefined,
	adjust = 1
): number | null {
	if (item.reps_count === null) return null;
	return Math.max(1, Math.round(item.reps_count * modifier(week, adjust)));
}

/**
 * A continuous run's duration scales the same way, to the nearest half minute.
 *
 * Only when it stands alone: a `work_seconds` sitting alongside `reps_count` is
 * the length of one effort, which is the prescription rather than the volume,
 * and scaling it would change what the session is.
 */
export function scaledWorkSeconds(
	item: ProgramItem,
	week: ProgramWeek | undefined,
	adjust = 1
): number | null {
	if (item.work_seconds === null) return null;
	if (item.reps_count !== null) return item.work_seconds;
	return Math.round((item.work_seconds * modifier(week, adjust)) / 30) * 30;
}

/** RPE moves with the week too, clamped to the usable 5–10 part of the scale. */
export function scaledRpe(
	item: ProgramItem,
	week: ProgramWeek | undefined,
	adjust = 1
): number | null {
	if (item.rpe === null) return null;
	return Math.min(10, Math.max(5, Math.round(item.rpe * modifier(week, adjust) * 2) / 2));
}

/**
 * The prescription as one line: "4 × 5 · 80% 1RM · 3 min rest" for a lift,
 * "6 × 40 m · 2 min recovery" for a run.
 *
 * An item carries either a strength prescription or a running one, never both,
 * so the two branches never collide — but both are assembled the same way, from
 * whichever parts are present.
 */
export function describePrescription(item: ProgramItem, week?: ProgramWeek, adjust = 1): string {
	const parts: string[] = [];

	if (item.distance_m !== null || item.work_seconds !== null) {
		const work = scaledWorkSeconds(item, week, adjust);
		const effort = item.distance_m !== null ? `${item.distance_m} m` : formatSeconds(work!);
		const count = scaledRepsCount(item, week, adjust);
		const reps = count !== null ? `${count} × ${effort}` : effort;
		parts.push(item.sets !== null && item.sets > 1 ? `${item.sets} sets of ${reps}` : reps);
		if (item.recovery_seconds !== null)
			parts.push(`${formatSeconds(item.recovery_seconds)} recovery`);
		if (item.rest_seconds !== null) parts.push(`${formatSeconds(item.rest_seconds)} between sets`);
		return parts.join(' · ');
	}

	if (item.sets !== null && item.reps !== null) parts.push(`${item.sets} × ${item.reps}`);
	else if (item.reps !== null) parts.push(item.reps);
	else if (item.sets !== null) parts.push(`${item.sets} sets`);

	const load = scaledLoad(item, week, adjust);
	if (load !== null) parts.push(`${load}% 1RM`);

	const rpe = scaledRpe(item, week, adjust);
	if (rpe !== null) parts.push(`RPE ${rpe}`);

	if (item.rest_seconds !== null) parts.push(`${formatSeconds(item.rest_seconds)} rest`);

	return parts.join(' · ');
}

/** Whole minutes read faster than 180 seconds when you are standing over a bar. */
function formatSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds} s`;
	const minutes = seconds / 60;
	return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

/**
 * Whether anything in these items actually moves with the week's intensity.
 *
 * The UI says "loads already include this week's reduction" underneath a
 * session, and that line must not appear over a session where nothing was
 * scaled — a warm-up-and-holds session would be claiming an adjustment it
 * never made.
 */
export function hasScaledPrescription(items: ProgramItem[]): boolean {
	return items.some(
		(item) =>
			item.load_pct_1rm !== null ||
			item.rpe !== null ||
			item.reps_count !== null ||
			item.work_seconds !== null ||
			item.hr_pct_min !== null
	);
}

/** The one-line summary of a program's shape: "8 weeks · 3 a week · Pre-season". */
export function describeProgramShape(program: TrainingProgram): string {
	return [
		`${program.weeks} weeks`,
		`${program.sessions_per_week} a week`,
		PHASE_LABELS[program.phase]
	].join(' · ');
}

/** The qualities a program targets, as readable copy. */
export function describeQualities(program: TrainingProgram): string {
	return program.target_qualities.map((q) => PHYSICAL_QUALITY_LABELS[q].toLowerCase()).join(', ');
}

/**
 * Items paired with the exercise they prescribe, dropping any whose exercise is
 * missing from the library.
 *
 * Belt and braces against content drift: an item pointing at an exercise that
 * no longer exists renders as a blank row otherwise, which is the worst
 * possible outcome in the middle of a session.
 */
export function resolveItems(
	items: ProgramItem[],
	exercises: Exercise[]
): Array<{ item: ProgramItem; exercise: Exercise | null }> {
	const byId = new Map(exercises.map((e) => [e.id, e]));
	return items
		.map((item) => ({
			item,
			exercise: item.exercise_id ? (byId.get(item.exercise_id) ?? null) : null
		}))
		.filter(({ item, exercise }) => exercise !== null || item.exercise_id === null);
}

/** True when a session prescribes loaded resistance work, so the UI shows the supervision note. */
export function isLoadedSession(
	session: ProgramSession,
	items: ProgramItem[],
	exercises: Exercise[]
): boolean {
	if (session.type !== 'strength') return false;
	const byId = new Map(exercises.map((e) => [e.id, e]));
	return items.some((item) => {
		const exercise = item.exercise_id ? byId.get(item.exercise_id) : undefined;
		if (!exercise) return false;
		return exercise.equipment_required.some((eq) => eq === 'full_gym' || eq === 'home_weights');
	});
}
