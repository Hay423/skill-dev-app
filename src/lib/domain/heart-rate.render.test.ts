import { describe, expect, it } from 'vitest';
import { describeHeartRate } from './heart-rate';
import { describePrescription, itemsForSession, sessionsForWeek, weekOf } from './program-plan';
import { drillTitle } from './drills';
import { SEED_DRILLS } from '$lib/data/seed/drills';
import { SEED_EXERCISES } from '$lib/data/seed/exercises';
import { SEED_PROGRAM_PLANS } from '$lib/data/seed/programs';
import type { ItemSection } from '$lib/types';

/**
 * What a player actually reads, assembled from the real seed content rather
 * than a fixture.
 *
 * These are here because every other test in this module checks a rule in
 * isolation: that a band scales, that a zone is named for its midpoint. None of
 * them would catch the line coming out as "Z4 · 85–90% HRmax · ~166–176 bpm"
 * next to a prescription that was scaled by a different week.
 */

const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

function lines(
	slug: string,
	week_number: number,
	day_index: number,
	section: ItemSection = 'main'
): string[] {
	const plan = SEED_PROGRAM_PLANS.find((p) => p.program.slug === slug);
	if (!plan) throw new Error(`no program ${slug}`);
	const session = sessionsForWeek(plan, week_number).find((s) => s.day_index === day_index);
	if (!session) throw new Error(`no day ${day_index} in week ${week_number} of ${slug}`);
	const week = weekOf(plan, week_number);

	return itemsForSession(plan, session.id)
		.filter((item) => item.section === section)
		.map((item) => {
			const exercise = item.exercise_id ? (byId.get(item.exercise_id) ?? null) : null;
			const hr = describeHeartRate({
				item,
				exercise,
				session_type: session.type,
				week,
				max_hr: 195,
				adjust: 1
			});
			const name = exercise?.name ?? item.notes ?? 'Run';
			return [name, describePrescription(item, week), hr].filter(Boolean).join(' | ');
		});
}

describe('a running session, as it is read', () => {
	it('moves the main work with the week', () => {
		// Week 3 of the repeat-sprint block is a 1.05 week, so the band moves with
		// it: the 400s keep their distance and move their band, and the band's top
		// end is held at the 95% ceiling rather than being scaled to an impossible 97.
		expect(lines('repeat-sprint-builder', 3, 3)).toEqual([
			'Hard but even — the last one should match the first | 6 × 400 m · 2 min recovery | Z5 · 89–95% HRmax · ~174–185 bpm'
		]);
	});

	it('warms up for fast running, and holds the warm-up still whatever the week', () => {
		// The same 1.05 week. Nothing here moves: the jog stays four minutes in
		// an easy band, and the drills carry no heart rate they cannot be held to.
		expect(lines('repeat-sprint-builder', 3, 3, 'warm_up')).toEqual([
			'Easy jog — start slower than feels necessary | 4 min | Z2 · 55–65% HRmax · ~107–127 bpm',
			'Leg swings | 10 each way, each leg',
			'Walking knee hug | 6 each leg',
			'World’s greatest stretch | 3 each side',
			'Ankling | 2 × 20 m · 30 s recovery',
			'A-skip | 2 × 20 m · 30 s recovery',
			'Carioca | 2 × 20 m · 30 s recovery',
			'Build-ups — about 60%, 75%, then 90% of top pace | 3 × 40 m · 45 s recovery | Z3 · 70–85% HRmax · ~137–166 bpm'
		]);
		// A deload week warms up exactly the same way.
		expect(lines('repeat-sprint-builder', 4, 3, 'warm_up')).toEqual(
			lines('repeat-sprint-builder', 3, 3, 'warm_up')
		);
	});

	it('cools down with an easy jog and the stretches, nothing measured but the jog', () => {
		expect(lines('repeat-sprint-builder', 3, 3, 'cool_down')).toEqual([
			'Easy jog, easing down to a walk | 3 min | Z1 · 50–60% HRmax · ~98–117 bpm',
			'Calf stretch | 30 s each leg',
			'Hamstring stretch | 30 s each leg',
			'Quad stretch | 30 s each leg',
			'Kneeling hip flexor stretch | 30 s each side',
			'Butterfly groin stretch | 30 s'
		]);
	});

	it('holds the band at the ceiling in the hardest week rather than inventing a number', () => {
		const sharpen = lines('repeat-sprint-builder', 6, 2);
		expect(sharpen.some((line) => line.includes('95% HRmax'))).toBe(true);
		expect(sharpen.every((line) => !/(9[6-9]|1\d\d)% HRmax/.test(line))).toBe(true);
	});
});

describe('a strength session, as it is read', () => {
	it('gives the lifts a recovery target, the jumps a band, and the plank neither', () => {
		expect(lines('preseason-max-strength', 1, 1)).toEqual([
			'Back squat | 4 × 5 · 70% 1RM · 3 min rest | Recover under 65% HRmax · ~127 bpm',
			'Trap bar deadlift | 3 × 5 · 65% 1RM · 2.5 min rest | Recover under 65% HRmax · ~127 bpm',
			'Walking lunge | 3 × 8 each leg · RPE 6 · 1.5 min rest | Recover under 65% HRmax · ~127 bpm',
			'Assisted nordic curl | 3 × 5 · 1.5 min rest | Recover under 65% HRmax · ~127 bpm',
			'Plank | 3 × 45 s hold · 45 s rest'
		]);
	});

	it('warms a lifter up without a recovery line on the unweighted squat', () => {
		// A squat in a warm-up is not a working set, so it earns no between-sets
		// threshold. Only the cardio carries a band.
		const warmUp = lines('preseason-max-strength', 1, 1, 'warm_up');
		expect(warmUp[0]).toMatch(/^Easy cardio .* \| 4 min \| Z2 · 55–65% HRmax/);
		expect(warmUp).toContain('Bodyweight squat | 10');
		expect(warmUp.at(-1)).toMatch(/^Build-up sets of your first lift .* \| 2–3 lighter sets$/);
	});

	it('reads a jump the same way on a power day as in a plyometric block', () => {
		const powerDay = lines('preseason-max-strength', 3, 3);
		expect(powerDay[0]).toContain('Pogo hops');
		expect(powerDay[0]).toMatch(/Z[123] · \d+–\d+% HRmax/);
	});
});

describe('a plyometric session, as it is read', () => {
	it('prescribes low bands, because a jumping set is not a running set', () => {
		expect(lines('plyo-landing-foundations', 3, 1)).toEqual([
			'Pogo hops | 3 × 10 · 1 min rest | Z2 · 60–72% HRmax · ~117–140 bpm',
			'Drop landing | 3 × 5 · 1.5 min rest | Z2 · 55–68% HRmax · ~107–133 bpm',
			'Single-leg hop and stick | 3 × 4 each leg · 1 min rest | Z2 · 58–70% HRmax · ~113–137 bpm',
			'Single-leg balance | 2 × 30 s each leg · 30 s rest'
		]);
	});

	it('never pushes a jumping band into the hard aerobic zones, even in a peak week', () => {
		for (const plan of SEED_PROGRAM_PLANS) {
			if (plan.program.discipline !== 'plyometrics') continue;
			for (const w of plan.weeks) {
				for (const session of sessionsForWeek(plan, w.week_number)) {
					for (const line of lines(plan.program.slug, w.week_number, session.day_index)) {
						expect(line, `${plan.program.slug} w${w.week_number}`).not.toMatch(/Z[45]/);
					}
				}
			}
		}
	});
});

describe('a drill, as it is read', () => {
	it('names the player requirement in brackets across the library', () => {
		const titles = SEED_DRILLS.map(drillTitle);
		expect(titles).toContain('Wall kick repeaters (solo)');
		expect(titles).toContain('Kick to a leading target (2+ players)');
		expect(titles.every((t) => /\((solo|\d+\+ players)\)$/.test(t))).toBe(true);
	});
});
