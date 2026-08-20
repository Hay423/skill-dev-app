# Plan — Player profile & position-driven training

Status: **Phase 1 (profile foundation) done. Drill library admin done, ahead
of the phasing below.** Supersedes nothing; slots in ahead of "Guided
sessions" in [ROADMAP.md](ROADMAP.md).

## Progress

- **Phase 1 — Profile foundation. Done.**
  - Types (`Position`, `AgeGroup`, `ExperienceLevel`, `EquipmentAccess`,
    `BodyRegion`, `InjuryFlag`, `PlayerProfile`, `ProgramEnrolment`, plus the
    Phase 2/4 content types so the Dexie bump only happens once) in
    `src/lib/types.ts`.
  - Dexie v2 schema (`src/lib/data/db.ts`) with a migration test proving v1
    `sessions`/`rep_logs` survive the upgrade
    (`src/lib/data/migration.test.ts`, using `fake-indexeddb`, now a
    devDependency).
  - `Repo` extension in `src/lib/data/repo.ts` / `local-repo.ts`:
    `getProfile`/`saveProfile` are the real Phase 1 surface; `listPositions`,
    `listExercises`, `listPrograms`, `getProgramPlan`, `activeEnrolment`,
    `enrol`, `advanceWeek` are implemented against tables that are
    legitimately empty until Phase 2 content lands.
  - Onboarding wizard at `/onboarding` (`src/routes/onboarding/+page.svelte`)
    — four steps, each defaulted so nothing blocks completion, single
    `saveProfile` call at the end.
  - `/profile` view/edit page (`src/routes/profile/+page.svelte`) — every
    field editable, injuries add/remove, save-with-confirmation.
  - First-run redirect (`src/routes/+layout.svelte`: no profile → `/onboarding`)
    and a Profile tab in `BottomNav.svelte`.
  - Verified with a real browser (Playwright against `npm run dev`): fresh
    load → onboarding → finish → redirected home → Profile tab present →
    edit → save → reload → persisted. Caught and fixed a real bug in the
    process: Svelte 5 `$state` proxies aren't structured-cloneable, so
    IndexedDB `put()` threw `DataCloneError` on save until the array fields
    were wrapped in `$state.snapshot(...)` at both call sites.
  - _Not done, out of scope for Phase 1 per the plan: drill/program
    recommendations, `/train`, export/delete._

- **Drill library admin. Done, ahead of schedule.** Not part of the original
  phasing below — pulled forward because drills were the one piece of content
  you wanted to edit yourself before the Phase 2 content pipeline exists.
  - `Drill` gained `active` (`0 | 1`, soft-hide — a hidden drill drops out of
    the library, the log picker and recommendations, but the row stays so any
    rep log referencing its id never orphans) and `source` (`'seed' |
    'custom'`) in `src/lib/types.ts`.
  - Dexie **v3** (`src/lib/data/db.ts`) adds the `active` index and backfills
    existing rows to `active: 1, source: 'seed'` on upgrade, with a migration
    test alongside the existing v1→v2 one.
  - `seedDrills()` (`src/lib/data/index.ts`) changed from "overwrite every
    boot" to **insert-only** — it only adds seed drills whose id isn't already
    present. This is a deliberate behaviour change from Phase 1: it's what
    lets admin edits and hidden state survive across boots instead of being
    clobbered by the bundled seed data on the next launch.
  - `Repo`/`LocalRepo` gained `createDrill`, `updateDrill`, `setDrillActive`
    (soft-hide/show, never a hard delete) and `importDrills` (bulk add/update
    by slug) in `src/lib/data/repo.ts` / `local-repo.ts`.
  - Admin UI at `/profile/drills` (list with Active/Hidden sections, hide/
    unhide, CSV/JSON bulk upload) plus `/profile/drills/new` and
    `/profile/drills/[id]/edit`, sharing `src/lib/components/DrillForm.svelte`.
    Linked from `/profile` as "Manage drill library".
  - Bulk upload parsing lives in `src/lib/domain/drill-import.ts` — pure,
    unit-tested, validates each row independently so one bad row doesn't
    block the rest of the file.
  - Verified with a real browser (Playwright against `npm run dev`): onboard →
    hide a seed drill → confirm it disappears from `/drills` → unhide → add a
    custom drill → edit it → CSV upload with one good and one bad row →
    confirm the bad row is reported and the good one imports. Caught and fixed
    the same class of bug as Phase 1: the bulk-import path handed a live
    Svelte 5 `$state` array straight to Dexie, which threw `DataCloneError`
    until wrapped in `$state.snapshot(...)`.
  - Shipped on branch `drill-library-admin`, not yet merged to `main`.
  - _Out of scope here: this only covers `Drill`. Positions, exercises and
    programs still have no editing surface — that's what Phase 2 below is for._

- **Phases 2–6** have not started — they need the open questions below
  answered, and Phase 2 specifically needs your content files. Note for
  whoever picks up Phase 2: the `positions`/`exercises`/`programs`/
  `program_weeks`/`program_sessions`/`program_items` tables already exist
  (added empty in v2, carried unchanged into the drill-library admin's v3 —
  see "Storage & repo" below), so Phase 2 likely needs **no new Dexie
  version**, just a seeder that populates them. Follow the pattern
  `seedDrills()` now uses: insert-only by id, so re-running the importer never
  clobbers anything a later phase (enrolment, adaptation) has written on top.

## Goal

Capture who the player is and where they play, then use that to drive three
kinds of recommendation:

1. **Drills** — weighted toward the skills their position actually demands
2. **Strength programs** — periodised, age-appropriate, equipment-aware
3. **Running / conditioning blocks** — matched to the running demands of the role

The profile is the input; everything else is a pure function of it plus content.
That framing is what keeps this extensible: new features consume the profile
without changing it.

## Decisions taken

| Question       | Decision                                                            |
| -------------- | ------------------------------------------------------------------- |
| Position model | Primary + secondary; recommendations blend both                     |
| Profile scope  | Age group, experience, availability, equipment access, injury flags |
| S&C depth      | Full periodised programs (phases, progression, deloads)             |
| Content source | Files you supply (CSV/JSON), ingested by a validated importer       |

## Duty of care — read this before building phase 4

We are prescribing loaded resistance training to someone who may be a
14-year-old, and asking about injuries. That earns some deliberate constraints.
None of these are hard to build; all of them are hard to retrofit.

**Age gating is a data rule, not a UI suggestion.** Every exercise and program
carries `min_age_group`. The recommendation layer filters on it and cannot be
overridden by the UI:

| Age group | Resistance training exposure                                                         |
| --------- | ------------------------------------------------------------------------------------ |
| U12–U14   | Bodyweight, landing mechanics, technique only. No external load prescribed.          |
| U16       | Light external load, technique-led, higher reps. No 1RM testing, no maximal singles. |
| U18+      | Full programs, `%1RM` and RPE prescription available.                                |

**Injury flags exclude, they do not treat.** A flagged region removes
contraindicated exercises from recommendations and surfaces a regression where
one exists. The app must never imply it is rehabilitating anything, and must not
ask for or store clinical detail — a body region and a coarse status is enough.

**Framing.** Programs are general training guidance, not individualised
prescription. Loaded lifting content should carry a persistent, non-dismissable
note recommending qualified supervision for technique. One clear statement at
the point of use, not a modal wall on first run.

**Storage.** Injury flags and date of birth are the most sensitive data in the
app. They stay device-local; when Supabase sync lands they need RLS on
`user_id` from day one, and should be part of the export/delete flow.

## Position taxonomy

Nine positions across five groups. Modern role-based rather than the traditional
eighteen, because the traditional names no longer describe how anyone trains.

| Position             | Group    |
| -------------------- | -------- |
| `key_defender`       | defence  |
| `general_defender`   | defence  |
| `inside_midfielder`  | midfield |
| `outside_midfielder` | midfield |
| `ruck`               | ruck     |
| `key_forward`        | forward  |
| `medium_forward`     | forward  |
| `small_forward`      | forward  |
| `utility`            | utility  |

Each position carries a `PositionProfile` — the weightings that drive every
recommendation:

```ts
export interface PositionProfile {
	position: Position;
	group: PositionGroup;
	label: string;
	summary: string;
	/** SkillCategory → 0..1 emphasis. Drives drill scoring. */
	skill_weights: Partial<Record<SkillCategory, number>>;
	/** PhysicalQuality → 0..1 emphasis. Drives program and conditioning selection. */
	physical_weights: Partial<Record<PhysicalQuality, number>>;
}
```

Illustrative, to be replaced by your content: an inside midfielder weights
`ground_ball`, `handball`, `tackling` high on skills and `repeat_sprint`,
`aerobic_capacity`, `max_strength` high on physical. A small forward weights
`goalkicking`, `evasion`, `tackling` and `acceleration`, `agility`.

`PhysicalQuality` is a new enum: `max_strength`, `power`, `speed`,
`acceleration`, `agility`, `repeat_sprint`, `aerobic_capacity`,
`aerobic_power`, `mobility`, `robustness`.

**Blending primary and secondary.** Effective weight is
`primary * 1.0 + secondary * 0.5`, normalised. One tunable constant, easy to
reason about, easy to test.

## Domain model

New user-owned records extend the existing `Owned` and `SyncMeta` so they sync
on the same terms as everything else. New reference records do not.

### User-owned

```ts
export interface PlayerProfile extends Owned, SyncMeta {
	id: Uuid; // singleton row; constant key 'me' until auth lands
	display_name: string | null;
	primary_position: Position;
	secondary_position: Position | null;
	/** Stored rather than DOB where the player prefers; DOB is optional. */
	age_group: AgeGroup; // 'u12'|'u14'|'u16'|'u18'|'senior'|'masters'
	date_of_birth: IsoDate | null;
	experience: ExperienceLevel; // 'first_year'|'developing'|'experienced'
	sessions_per_week: number;
	available_days: Weekday[];
	equipment_access: EquipmentAccess[];
	injuries: InjuryFlag[];
	/** Bumped when the profile shape changes, so migrations can adapt old rows. */
	schema_version: number;
}

export interface InjuryFlag {
	region: BodyRegion; // ankle|knee|hamstring|quad|groin|hip|back|shoulder|other
	status: 'current' | 'recent' | 'historical';
	note: string | null;
	since: IsoDate | null;
}

/** Which program the player is currently working through. */
export interface ProgramEnrolment extends Owned, SyncMeta {
	id: Uuid;
	program_id: Uuid;
	started_at: IsoDateTime;
	current_week: number;
	completed_at: IsoDateTime | null;
}
```

`EquipmentAccess`: `full_gym`, `home_weights`, `bands`, `oval`, `goals`,
`park`, `backyard`, `wall`. Note this supersedes the free-text `equipment:
string[]` currently on `Drill` — see migration below.

### Reference content

```ts
export interface Exercise {
	id: Uuid;
	slug: string;
	name: string;
	movement_pattern: MovementPattern; // squat|hinge|push|pull|lunge|carry|core|plyometric|olympic
	primary_qualities: PhysicalQuality[];
	equipment_required: EquipmentAccess[];
	min_age_group: AgeGroup;
	contraindicated_regions: BodyRegion[];
	coaching_points: string[];
	regression_slug: string | null; // shown when an injury flag excludes this
	progression_slug: string | null;
}

export interface TrainingProgram {
	id: Uuid;
	slug: string;
	name: string;
	discipline: 'strength' | 'conditioning';
	phase: 'off_season' | 'pre_season' | 'in_season' | 'finals' | 'return_to_play';
	target_positions: Position[]; // empty = applies to all
	target_qualities: PhysicalQuality[];
	min_age_group: AgeGroup;
	experience: ExperienceLevel[];
	weeks: number;
	sessions_per_week: number;
	equipment_required: EquipmentAccess[];
	summary: string;
}

export interface ProgramWeek {
	program_id: Uuid;
	week_number: number;
	focus: string;
	intensity_modifier: number;
	is_deload: boolean;
}

export interface ProgramSession {
	id: Uuid;
	program_id: Uuid;
	week_number: number;
	day_index: number;
	name: string;
	type: 'strength' | 'running' | 'skills' | 'recovery';
	duration_minutes: number;
}

export interface ProgramItem {
	id: Uuid;
	session_id: Uuid;
	order: number;
	exercise_id: Uuid | null;
	/** Strength prescription */
	sets: number | null;
	reps: string | null; // "8" or "6-8" or "AMRAP"
	rpe: number | null;
	load_pct_1rm: number | null;
	rest_seconds: number | null;
	/** Running prescription */
	distance_m: number | null;
	work_seconds: number | null;
	reps_count: number | null;
	recovery_seconds: number | null;
	notes: string | null;
}
```

**Running blocks reuse this hierarchy** rather than getting a parallel one — a
conditioning block is a `TrainingProgram` with `discipline: 'conditioning'`
whose sessions are `type: 'running'` and whose items carry distance/time instead
of sets/reps. One import path, one renderer, one set of tests.

### Drill changes

Add two optional fields to the existing `Drill`:

- `position_tags: Position[]` — for drills that are strongly position-specific
  (ruck taps, spoiling technique, set-shot routines). Empty for general drills.
- `equipment_required: EquipmentAccess[]` — structured, replacing the display-only
  `equipment: string[]`, which stays for rendering.

Baseline drill relevance comes from `PositionProfile.skill_weights` via
`drill.category`. `position_tags` is a targeted override on top. Cheap default,
precise where it matters.

## Content pipeline

You supply files; a script validates them and emits typed seed modules. The
generated output is committed so the app builds without the content step and so
content changes show up as reviewable diffs.

```
content/                        # source files you supply, git-tracked
  positions.csv
  exercises.csv
  programs.csv
  program_weeks.csv
  program_sessions.csv
  program_items.csv
  drill_positions.csv
scripts/import-content.ts       # the importer
src/lib/data/seed/generated/    # emitted — never hand-edit
  positions.ts  exercises.ts  programs.ts  ...
```

Run with `npm run import:content`.

**Validation.** Add `zod` as a devDependency, used only by the importer. Content
errors need to say "row 47 of exercises.csv: min_age_group 'u10' is not a valid
age group", not fail at runtime in the app. The importer exits non-zero on any
error and writes nothing on failure — partial content is worse than none.

Beyond field validation it must check referential integrity: every
`program_items.exercise_slug` resolves, every `program_sessions.program_id`
resolves, every `week_number` falls within the program's `weeks`, and no program
references equipment its sessions don't require.

**Stable ids.** Content ids are UUIDv5 derived from a fixed namespace UUID plus
the record's slug. Re-importing produces identical ids, so upserts are idempotent
and user data referencing them never breaks. This extends the existing rule in
CLAUDE.md that drill ids are permanent — slugs become the thing you must not
recycle.

**Bundling.** Start by emitting TypeScript modules bundled with the app, matching
the current `SEED_DRILLS` pattern. If generated content exceeds roughly 150 kB
gzipped, move programs and exercises to versioned JSON in `static/` — the service
worker already precaches everything there, so offline still holds — and hydrate
into IndexedDB on first use. Don't pre-emptively build the second option.

### What I need from you

Send the files in whatever shape they already exist and I'll write the mapping —
you should not reshape your data by hand to suit the importer. What I need to
know per file is which column carries the stable identifier, and the vocabulary
used for positions, phases, and equipment so I can map it to the enums above.

If you'd rather start from a template, I'll generate empty CSVs with the exact
headers and one worked example row each.

Two things worth deciding early, because they're expensive later: whether your
programs are position-specific or quality-specific (they may map to
`target_qualities` more naturally than `target_positions`), and whether your
running blocks are prescribed by distance, time, or percentage of a tested
maximum such as MAS or a time trial.

## Storage & repo

Dexie moves to **version 2**. Dexie applies versions in order, so v1 users
upgrade cleanly as long as v1's `stores` definition stays in the file untouched.

```ts
this.version(2).stores({
	// unchanged tables must still be listed
	drills: 'id, &slug, category, difficulty',
	sessions: 'id, local_date, started_at, completed_at, _dirty',
	rep_logs: 'id, local_date, category, session_id, drill_id, recorded_at, _dirty',
	// new
	player_profile: 'id, _dirty',
	positions: '&position, group',
	exercises: 'id, &slug, movement_pattern',
	programs: 'id, &slug, discipline, phase',
	program_weeks: '[program_id+week_number], program_id',
	program_sessions: 'id, program_id, week_number',
	program_items: 'id, session_id',
	program_enrolments: 'id, program_id, completed_at, _dirty'
});
```

Extend `Repo` — nothing above `src/lib/data/` may touch Dexie, per CLAUDE.md:

```ts
getProfile(): Promise<PlayerProfile | undefined>;
saveProfile(input: ProfileInput): Promise<PlayerProfile>;
listPositions(): Promise<PositionProfile[]>;
listExercises(filter?): Promise<Exercise[]>;
listPrograms(filter?): Promise<TrainingProgram[]>;
getProgramPlan(program_id: Uuid): Promise<ProgramPlan | undefined>;  // program + weeks + sessions + items
activeEnrolment(): Promise<ProgramEnrolment | undefined>;
enrol(program_id: Uuid): Promise<ProgramEnrolment>;
advanceWeek(enrolment_id: Uuid): Promise<ProgramEnrolment | undefined>;
```

`ProgramPlan` is assembled in the repo so the UI never issues four queries and
stitches them itself.

## Recommendation engine

Pure functions in `src/lib/domain/recommend.ts`, no storage imports, fully
tested — the same discipline as `stats.ts`.

```ts
export interface RecommendationContext {
	profile: PlayerProfile;
	positions: PositionProfile[];
	today: IsoDate;
}

export function positionWeights(ctx): {
	skills: Record<SkillCategory, number>;
	physical: Record<PhysicalQuality, number>;
};

export function recommendDrills(drills: Drill[], ctx, limit?): ScoredDrill[];
export function recommendPrograms(programs: TrainingProgram[], ctx): TrainingProgram[];
export function isEligible(item, ctx): { eligible: boolean; reason?: ExclusionReason };
```

Eligibility runs as a hard filter before scoring: age group, equipment access,
injury contraindication. Scoring then ranks what survives. Keeping them separate
is what lets the UI explain itself — "hidden because you don't have gym access"
is a far better experience than a silently short list.

**The extensibility hook.** Scoring is a list of weighted scorers, not a formula:

```ts
type Scorer = (drill: Drill, ctx: RecommendationContext) => number; // 0..1
const SCORERS: Array<{ scorer: Scorer; weight: number }> = [
	{ scorer: positionFit, weight: 0.6 },
	{ scorer: positionTagBonus, weight: 0.2 },
	{ scorer: difficultyFit, weight: 0.2 }
];
```

Future signals drop in without touching existing ones. The obvious next one:
a `weakestSkill` scorer reading `totalsByCategory` from `stats.ts`, so the app
recommends what the player is actually worst at. Deliberately out of scope here,
but the seam exists for it.

## UI

**Onboarding** — first run, four short steps, each skippable with a default:
position → age group and experience → availability and equipment → injuries
(explicitly optional, with a plain statement of why it's asked). Anything skipped
degrades recommendations rather than blocking them. A player who only picks a
position gets useful output.

**`/profile`** — view and edit everything, plus export/delete once that lands.

**Today** — gains a "Recommended for you" block above the existing summary, and
the current program session if enrolled.

**`/train`** — program browser, program detail with the week-by-week plan,
session view with the exercise list, and enrolment state.

Exclusions are shown, not hidden: a collapsed "3 not shown — needs gym access"
row that expands to explain. Prevents the library looking empty and tells the
player what unlocks more.

## Testing

- **Importer**: fixture CSVs in `scripts/__fixtures__` → snapshot of emitted
  modules; one test per validation failure class; a referential-integrity failure
  case; and an idempotency test asserting two runs produce byte-identical output.
- **Recommendation**: one test per position asserting the top-ranked category
  matches the position's dominant skill; age gating (a U14 profile never receives
  a loaded lift); injury exclusion plus regression substitution; equipment
  filtering; primary/secondary blending.
- **Migration**: seed a v1 database, open at v2, assert existing `rep_logs` and
  `sessions` survive intact. Needs `fake-indexeddb`, which the roadmap already
  flags as missing.

## Phasing

Each phase is independently shippable and useful on its own.

**1 — Profile foundation. ✅ Done.** Types, Dexie v2, repo methods, onboarding,
`/profile`. No recommendations yet. _Done when: a profile persists across
reload and survives the v1→v2 migration with existing rep logs intact._ —
verified: migration test passes, and a browser-driven run confirmed the
profile persists across a page reload.

**2 — Content pipeline.** Importer, validation, generated seeds, position
profiles loaded. _Done when: `npm run import:content` turns your files into
committed seed modules and fails loudly on bad input._

**3 — Drill recommendations.** Scoring, eligibility, "Recommended for you".
Smallest change with visible payoff — worth reaching quickly. _Done when: two
profiles differing only by position get demonstrably different drill orders._

**4 — Strength programs.** Program browser, detail, enrolment, session view, age
gating enforced. _Done when: a U14 profile cannot surface a loaded lift by any
route through the UI._

**5 — Conditioning blocks.** Running sessions through the same hierarchy;
distance/time rendering.

**6 — Adaptation.** Feed logged performance back into scoring; suggest the next
program on completion.

## Risks

**Content volume is the real cost.** The schema here is a few days; a genuinely
periodised multi-position program library is much more. Phase 2 should start with
one position and one phase end-to-end before scaling content — it will surface
schema gaps far cheaper than authoring everything first.

**Schema churn from real data.** The model above is inferred from your answers,
not from your files. Expect it to move once I see them. Phase 1 deliberately
ships the profile before the content model hardens, so that churn is contained.

**False confidence around injuries.** A player may read exclusions as clearance.
Copy needs care, and the app should never present an injury flag as resolved.

**Equipment vocabulary drift.** `EquipmentAccess` is referenced by drills,
exercises, and programs. If your files use a different vocabulary, map it in the
importer — do not let two vocabularies coexist in the domain.

## Open questions

1. Can you send the content files, or would you like the template CSVs first?
2. Are programs organised by position, or by physical quality?
3. Running prescription: distance, time, or percentage of a tested max?
4. Is the first user an adult, or do we need the junior path working immediately?
5. Should the profile support multiple players on one device (a parent tracking
   two kids)? Cheap now — the profile becomes a table rather than a singleton —
   and expensive later.
