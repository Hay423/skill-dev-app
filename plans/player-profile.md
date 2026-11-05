# Plan — Player profile & position-driven training

Status: **Phases 1 (profile foundation), 3 (drill recommendations) and 4
(strength programs) done. Drill library admin done, ahead of the phasing
below. Phase 2 (the CSV content pipeline) is still open and remains the main
gap — Phase 4 worked around it the same way Phase 3 did, with hand-authored
bundled seeds. Injury flags have been forked out of the app entirely — see
"Injuries: forked out" below.**
Supersedes nothing; slots in ahead of "Guided sessions" in
[ROADMAP.md](ROADMAP.md).

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

- **Phase 3 — Drill recommendations. Done.** Taken before Phase 2 because the
  CSV pipeline is blocked on content files that do not exist yet, and the
  scoring layer only ever needed the position weights.
  - **Position weights ship as a bundled seed, not as importer output.**
    `src/lib/data/seed/positions.ts` holds all nine `PositionProfile` records
    with `skill_weights` and `physical_weights`, seeded insert-only by
    `seedPositions()` in `src/lib/data/index.ts`. **No new Dexie version** —
    the `positions` table has existed and been empty since v2, exactly as the
    note below anticipated. This is deliberately the shape the Phase 2
    importer will emit, so that phase replaces this one file and changes
    nothing else.
  - `src/lib/domain/recommend.ts` — pure, no storage imports:
    `positionWeights` (primary + secondary × `SECONDARY_POSITION_WEIGHT`,
    normalised so the top emphasis is 1), `isEligible` as a hard filter ahead
    of scoring, `recommendDrills`, `describeExclusion` and
    `priorityCategories`. Scoring is the weighted-scorer list the plan called
    for — `positionFit` 0.6, `positionTagFit` 0.2, `difficultyFit` 0.2 — so
    the "weakest skill" scorer drops in later without touching the others.
  - **`isEligible` is structural, not `Drill`-shaped**, so Phase 4's
    `Exercise` runs through the same filter: it already implements age gating
    on `min_age_group` and injury contraindication on
    `contraindicated_regions`, neither of which `Drill` carries. Phase 4
    inherits the duty-of-care filter rather than re-implementing it.
  - **Deviation from the plan's signature**: `recommendDrills` returns
    `{ recommended, excluded }` rather than a bare `ScoredDrill[]`. The plan
    also requires exclusions to be shown rather than hidden, and computing
    eligibility twice to satisfy both was worse than widening the return.
  - **A skipped profile question means "unknown", not "has nothing".** An
    empty `equipment_access` excludes nothing, so a player who skipped that
    step still gets a full list. Tested.
  - `RecommendedDrills.svelte` renders the block on Today: the ranked drills
    with a "why this one" line each, the position and its focus skills, and a
    collapsed "1 drill not shown — needs full gym" disclosure.
  - 36 unit tests in `src/lib/domain/recommend.test.ts`, including one per
    position asserting the top-ranked drill matches that position's dominant
    skill, plus a seeder test proving `seedPositions()` is insert-only and
    keyed by position.
  - Verified with a real browser (Playwright against `npm run dev`, 390px):
    three positions onboarded from scratch gave three different orders — small
    forward led with set shots, key defender with chest marking, ruck with
    marking — then adding a ruck-tagged drill through the admin library put it
    straight to the top with "Specific to ruck", and a gym-only drill appeared
    in the exclusions row as "needs full gym". No console errors.
  - _Known content gap, not a bug: the seed library has no `ruckwork` drill,
    so a ruck's top-weighted skill has nothing to offer and the list falls
    through to marking. Scoring is behaving correctly; the library is thin._
  - _Out of scope here, per the plan: drills only. No program or conditioning
    recommendation, and `physical_weights` is populated but not yet read by
    anything — Phase 4 is its first consumer._

- **Phase 4 — Strength programs. Done.** Taken before Phase 2 for the same
  reason Phase 3 was: the CSV pipeline is blocked on content files that do not
  exist yet, and the program layer only ever needed content in the shape the
  importer will eventually emit.
  - **Age bands renamed and one added.** `AGE_GROUPS` is now
    `u11|u13|u15|u17|senior|masters` (was `u12|u14|u16|u18|senior|masters`),
    labelled Under 11/13/15/17, Seniors, Masters. **Dexie v5** rewrites stored
    profiles — `u12→u13`, `u14→u15`, `u16→u17`, `u18→senior`, anything
    unrecognised to `u11` — and `PLAYER_PROFILE_SCHEMA_VERSION` is now `3`. The
    value is rewritten rather than mapped at read time because the array's
    _order_ is what every age gate compares against: a row left carrying `u14`
    ranks as -1 and gates wrongly.
  - **U11–U15 get no strength programs at all.** `STRENGTH_MIN_AGE_GROUP` in
    `domain/recommend.ts` is `u17`, and `isEligible` rejects anything with
    `discipline: 'strength'` below it, ahead of the `min_age_group` check so
    the player is told the real reason. Conditioning is untouched — the whole
    point is that a junior is left with plenty to do.
  - **The gate is applied at three layers, not one**: the recommendation list,
    the program detail page (so a typed URL cannot get around it) and the
    session view (which additionally drops any individual exercise the player
    is too young for). The Phase 4 acceptance criterion is a test, not a
    manual check — see `domain/recommend-programs.test.ts`.
  - **Content ships as bundled seeds**, following Phase 3's pattern exactly:
    `data/seed/exercises.ts` (28 exercises) and `data/seed/programs.ts` (three
    strength blocks, three conditioning blocks), seeded insert-only by
    `seedExercises()` / `seedPrograms()`. **No new Dexie version was needed for
    the content tables** — they have existed and been empty since v2, exactly
    as this plan anticipated.
  - **Sessions are authored once per program and repeated across weeks**, with
    progression carried by `ProgramWeek.intensity_modifier` and applied at
    render time by `scaledLoad`/`scaledRpe`. An eight-week block stays readable
    in one screen and a deload is a one-line change. Session and item ids are
    derived from the program id rather than hand-typed; a test asserts they are
    unique across the library.
  - Seed content is held to its own invariants by tests: no strength program
    below `u17`, no `%1RM` below senior, no exercise whose own age floor exceeds
    its program's, no equipment a program does not declare, and no week whose
    intensity scales a prescription past 90% 1RM.
  - `domain/program-plan.ts` holds the pure rendering logic — week slicing,
    prescription formatting, load scaling — with `program-plan.test.ts`
    alongside it. Components render; they do not calculate.
  - UI: `/train` (browser, split strength/conditioning, with the withheld-strength
    explanation for juniors), `/train/[slug]` (detail, week-by-week, enrol /
    advance / leave) and `/train/[slug]/[session]` (session view). A Train tab
    in `BottomNav`, and a "This week" block on Today via `CurrentProgram.svelte`.
    `SupervisionNote.svelte` is the persistent, non-dismissable note on loaded
    content.
  - **Deviation**: `recommendPrograms` returns `{ recommended, excluded }`
    rather than a bare `TrainingProgram[]`, matching what `recommendDrills`
    already does and for the same reason — exclusions are shown, not hidden.
  - **Two real bugs found and fixed in the process.** `activeEnrolment()` has
    sorted on `program_enrolments.started_at` since Phase 1, which was never
    indexed — Dexie throws `SchemaError` on an unindexed `orderBy`, so the call
    has always been broken and nothing had reached it until enrolment got a UI.
    v5 adds the index. Separately, `isEligible` treated equipment as a flat set,
    so a player who ticked "Full gym" but not "Home weights" was excluded from
    dumbbell programs; `expandEquipmentAccess` now expands `full_gym` to include
    `home_weights` and `bands`. That fix applies to drills too.
  - Verified with a real browser (Playwright against `npm run dev`, 390px): a
    U15 profile saw the withheld-strength note and three running programs with
    no strength program anywhere; a typed `/train/preseason-max-strength` URL
    was refused; switching to Seniors brought the strength blocks back; enrol →
    advance to week 2 → open a session showed loads scaled to that week (80%
    → 75%); Today showed the week's three sessions; then switching back to U15
    killed a bookmarked session URL. No console errors.
  - _Out of scope, deliberately: per-session completion tracking (the week is
    advanced by hand), and any editing surface for exercises or programs — that
    is still Phase 2._

- **Phase 4b — Ticking and the training calendar. Done.** An extension of
  Phase 4 rather than a phase of its own: the programs existed but nothing
  said _when_ to do them, and nothing recorded that they had been.
  - **Two enrolments, one per discipline.** `enrol` now replaces only the block
    of the same discipline, so a strength block and a running block run side by
    side — which is what lets the calendar say "lift Tuesday, run Thursday".
    `activeEnrolments()` replaces the single-row `activeEnrolment()`, which
    survives as a per-discipline lookup.
  - **A program week is a calendar week.** `ProgramEnrolment.current_week` is
    gone, replaced by `started_on` (the local day of enrolment); `programWeekOn`
    derives the week from the date. A stored counter would have been a second
    source of truth that disagreed with the calendar the first time a week was
    missed. Missing a week now costs that week rather than stalling the block,
    and `advanceWeek` is gone from `Repo` — there is nothing left to advance.
  - **Time also ends a program.** `activeEnrolments()` stamps `completed_at` on
    any block whose final calendar week has passed. That write happens on read,
    deliberately: something has to notice the date, and recording it once beats
    every caller recomputing it as a maybe.
  - **Dexie v6** adds `program_session_logs` (one row per session per enrolment,
    holding the ticked exercise ids and whether the session is finished) and
    migrates enrolments from `current_week` to `started_on`. Ticked items are an
    array on the row rather than a table of their own — an item tick has no life
    outside its session, and the array maps onto a Postgres `uuid[]`.
  - `src/lib/domain/schedule.ts` is the new pure core: `planWeek` places each
    enrolled program's sessions on the days the player actually trains. Spread
    evenly; strength and running on separate days where there is room; doubling
    up, never dropping, when there are more sessions than days — with the UI
    saying plainly that a day is carrying two. Running goes before lifting on a
    doubled day.
  - **Rest days suggest skills work**, rotated through the existing drill
    recommendations, on training days no program landed on. **A rep log is the
    tick for a skills day** — the app already records that the work happened, so
    a second record would only give it two answers to the same question.
  - **A ticked session counts towards the streak.** `currentStreak` takes an
    `alsoTrainedOn` list. A player who does exactly what the app prescribed and
    watches their streak break learns to ignore the calendar.
  - **Backfill is allowed inside the current week only** (`isTickable`).
    Training gets logged late; a closed week that could still be edited would
    make the history, and the streak built on it, writable after the fact.
  - A session is done exactly when its exercises are: ticking the last one
    finishes it, unticking any one reopens it, and "mark whole session done"
    ticks them all. The two states cannot disagree.
  - UI: `WeekPlan.svelte` (Mon–Sun strip plus the selected day) on `/train`,
    `TodayPlan.svelte` on Today, per-exercise ticks in the session view.
    `src/lib/plan.ts` is the one place that assembles a week from storage.
  - **Three bugs found in the browser.** A Svelte 5 `$state` proxy array reached
    Dexie again (`DataCloneError`) — the fourth time in this project, so the fix
    went in at the repo seam this time rather than at the call site. The
    "already includes this week's adjustment" note appeared on running sessions
    where nothing was scaled. And underneath that: conditioning programs'
    `intensity_modifier` did nothing at all, since only `%1RM` and RPE were ever
    scaled — `scaledRepsCount` and `scaledWorkSeconds` now scale running volume,
    which is where a running block actually progresses.
  - Verified with a real browser (Playwright, 390px): three strength and three
    running sessions across three available days doubled up on all three and
    said so; six available days with one block put strength on Monday and
    Saturday and rotated goalkicking, evasion and tackling through the days
    between; ticking a session moved the week counter and lifted the streak to
    1; ticking every exercise in a session auto-completed it. No console errors.
  - _Out of scope: browsing past weeks (the strip shows the current week only,
    and `planWeek` already takes an `anchor` for when that changes), and any
    notion of a missed session beyond it simply not being ticked._

- **Phase 4c — U17 blocks, masters load policy, week browsing. Done.**
  - **Two U17 strength blocks**, `u17-preseason-strength` (8 weeks, 3 a week)
    and `u17-in-season-maintenance` (6 weeks, 2 a week), mirroring the senior
    blocks they lead into: same shape, same session names, dumbbells instead of
    a loaded barbell, and prescribed by RPE and rep range because a percentage
    implies a tested one-rep max and no junior should be testing one. A U17
    finishing the pre-season block steps into the senior version the following
    year and recognises every session.
  - **An age-fit scorer, found by building the above.** `min_age_group` is a
    floor, not an audience: it stops a fifteen year old reaching a barbell and
    does nothing to stop a forty year old being led to a block called "Under
    17" — which is exactly what happened the first time a masters profile was
    scored. Content two or more bands below the player now ranks down. A gap of
    one band is untouched, because a first-year senior belongs in the same
    foundations block as a U17.
  - **`domain/load-policy.ts` holds the masters policy in one place.** Loads,
    running volume and RPE all scale by `MASTERS_LOAD_MODIFIER` (0.85) on top of
    the week's own intensity — two multipliers rather than one, so a masters
    deload is still lighter than a masters baseline. Lighter blocks rank first
    via a `recoveryFit` scorer, heavier ones carry a caution chip saying what
    they are, drills drop to two, and the calendar fills at most two days with
    optional skills work.
  - **Nothing is withheld from masters.** Ranking and scaling, never filtering:
    a masters player who wants the pre-season block can still have it. The
    reasoning is in "Duty of care" above, and it is the opposite of the junior
    rule on purpose.
  - **Masters drills are fewer and shorter, not easier.** A `brevityFit` scorer
    ranks short drills up for masters only; difficulty is left alone. What a
    masters player is short of is twenty spare minutes, not ability, and
    dropping the most experienced person at the club to foundation drills would
    solve the wrong problem.
  - **Week browsing**, bounded by the blocks actually running
    (`browsableRange`): arrows step a week, a button returns to this one, and
    both ends disable rather than disappear. Past weeks stay read-only, so the
    bound is not a safety measure — it is that a calendar you can page through
    forever stops being a plan.
  - Verified with a real browser (Playwright, 390px): a U17 profile saw both new
    blocks and no senior ones; a masters profile led with in-season maintenance,
    showed "3 sessions a week — more than most masters players need" on the
    pre-season block, and rendered its week-1 back squat at 60% rather than 80%
    with the copy naming both reductions; browsing stepped from week 1 to week 8
    of an eight-week block and stopped at each end. No console errors.

- **Phase 4d — Affirmations, position-driven exercises. Done.**
  - **Affirmations** (`domain/affirmations.ts`) fire after a rep log is saved
    and after a program session is ticked done — both count towards the
    streak, so both are acknowledged. Contextual by design: the line is built
    from the streak, the accuracy, and which session of which week, with
    milestones (first ever record, a streak length in
    `STREAK_MILESTONES`, every session of a week, the last week of a block, a
    sharp set) taking priority over the routine line. Deterministic, not
    random — seeded from the day and the work so the line does not reshuffle
    on a re-render and tests can assert on it. Every line is written to read
    correctly with no display name set.
  - Shown inline via `AffirmationCard.svelte`, where the work happened, not as
    a toast: on the Log page (which now stays put after saving instead of
    redirecting home, with "Log another set" and "Done"), and on whichever of
    `WeekPlan`, `TodayPlan` or the session page the player ticked a session
    done from. `src/lib/affirm.ts` composes the streak and "is this the very
    first thing ever" check from the repo, the same seam pattern as
    `plan.ts`.
  - **Position-driven exercises** (`domain/exercise-fit.ts`) is the missing
    link Phase 4 left: `PositionProfile.physical_weights` ranked whole
    programs since Phase 3, and `Exercise.primary_qualities` was authored since
    Phase 4 and read by nothing. `exerciseFit` joins them, and `tailorSession`
    applies it to one session two ways:
    - **Extras**: up to `maxExtrasFor` (2, or 1 for masters) position-specific
      exercises appended as clearly optional, one per movement pattern the
      session does _not_ already train (never olympic — a skill lift is never
      an optional add-on). Ranking the whole library by fit alone would bolt
      another heavy lift onto a session that just finished five sets of squats;
      restricting to untrained patterns is what makes an extra actually
      additive.
    - **Substitutions**: an accessory (never the opening lift) swapped for a
      same-movement-pattern exercise that fits the position markedly better
      (`SUBSTITUTION_MARGIN`, 0.15), shown with a tag naming what it replaced.
      High enough that most sessions see none at all — a program that
      silently rearranges itself every time is one nobody can reason about.
    - Both run through `isEligible` and a program's own declared equipment
      (`withinProgramEquipment`), so the age gate and gear rules that already
      constrain the authored session apply identically to anything added to it.
  - Six new exercises added to reach positions the existing library under-
    served — lateral bound, single-leg hop and stick, Copenhagen adductor hold,
    farmer's carry, dumbbell overhead press — plus an optional
    `Exercise.accessory_dose` field for the handful where the per-movement-
    pattern default reads wrong (a plank is not "3 × 10").
  - Verified with a real browser (Playwright, 390px): the very first rep log
    ever produced "First one's in the book, Matt"; a 20-from-20 set produced
    the sharp-set milestone; ticking a session produced its line on Today; a
    ruck's pre-season session showed bench press and chin-up as extras (the
    session's squat/hinge/plyometric work left push and pull untrained); and a
    small forward's maintenance session substituted "Single-leg balance" for
    the authored "Dead bug" with the tag explaining why, without being asked
    to — the margin rule found a real case in the seed content on its own. No
    console errors in any run.

- **Phase 4e — Drill filters. Done.** The recommendation layer knew who the
  player _is_; it knew nothing about who is standing next to them. A ranked
  list that leads with a three-person marking contest is wrong for a player
  alone in a park, however well it suits their position.
  - **`domain/drill-filter.ts`** is the new pure core: `DrillFilter`
    (`players`, `max_minutes`, `equipment`), `matchesFilter`, `filterDrills`,
    the copy helpers, and the option rows. `null`/`[]` mean unset, never "has
    nothing" — the same rule the profile already follows, so an untouched
    filter excludes nothing.
  - **Deliberately not on `PlayerProfile`.** The profile answers "what can you
    generally get to?" and syncs; the filter answers "who is with you, this
    morning, in this park?" and changes every session. It lives in
    `localStorage` via `src/lib/filters.svelte.ts` — a seam in the same shape as
    `plan.ts` — which also avoided a Dexie version and a `schema_version` bump
    for the most volatile value in the app. Read synchronously so the first
    render is already filtered; validated field by field on read, because a
    value that outlives its code should degrade to unset rather than hide the
    library.
  - **The filter is part of `RecommendationContext`, not a second argument.**
    It is an input to the recommendation exactly as the profile is, and a caller
    that forgets to thread it through is a caller that hands a solo player a
    three-person drill. It runs _after_ `isEligible`, so a drill the profile
    rules out reports the profile's reason: telling someone a gym drill "needs
    3 players" sends them looking for a partner they never needed.
  - **`equipment_required` on a drill means space, not gear.** The field has
    existed since Phase 3 and no seed drill ever set it, so it did nothing. All
    twelve now declare the smallest place the drill works in, and
    `domain/equipment.ts` — where `expandEquipmentAccess` moved to — expands an
    oval to include a park and a park a backyard. `oval → goals` is still
    refused: posts are a fixture, not a size. Requirements are AND-ed, so a
    drill that works against a wall _or_ with a partner declares neither and
    leaves it to the headcount row.
  - **Dexie v9** backfills that field onto already-seeded drills. A migration
    rather than a change to `seedDrills`, because that seeder is insert-only on
    purpose — making it overwrite would undo admin edits for the sake of one
    field. It only fills a gap, and leaves custom drills alone.
  - **Option rows are derived from the library**, the way the category chips
    already are: no "5 people" chip for a library whose biggest drill needs
    three.
  - **The time row is a ladder of caps topped by an open end** — `10 min or
less`, `15 min or less`, `15+ min`. The longest drill never gets a cap of
    its own, because a cap that keeps everything cannot be told apart from no
    cap; it sets the open chip's label instead. `TimeBudget` is therefore
    `number | 'open' | null`, and `'open'` is deliberately not `null`: it rules
    nothing out, but "I have plenty of time" is an answer and "I have not said"
    is not, and the summary line says which.
  - **The place row is single-select** — you are in one place at a time. That
    only works because the places nest, which forced a real fix in
    `domain/equipment.ts`: **goals now imply an oval, a park and a backyard**,
    and a wall implies a backyard. The asymmetry with `oval → goals` (still
    refused — posts are a fixture, not a size) is the point; there is nowhere
    to put posts except a ground. Without it, naming the goals would have cost
    the player every drill written for the grass around them.
    `placeOptions` orders the row by size rather than by taxonomy, so each chip
    to the right opens everything the last one did and more: over the bundled
    twelve that is backyard 3 → wall 4 → park 9 → goals 11, asserted in
    `seed.test.ts` so a content change that narrows the ladder fails the build.
    The wall drill is reachable only from "Wall", correctly — a wall is the one
    thing open grass does not imply.
  - The stored key is `…:drill-filter:v2`. The v1 shape had a multi-select place
    and no open budget, and reading it under the new rules would silently mean
    something else, so the old key is abandoned rather than migrated — one tap
    to set again.
  - Exclusions reuse the established pattern rather than a new one:
    `describeDrillExclusion` folds the profile's reasons and the filter's into
    one union, and `ExcludedDrills.svelte` renders the "n drills not shown" row
    for both the library and Today. The grouping moved out of the component into
    `groupExcludedDrills` — components render, they don't calculate.
  - The CSV importer now reads `position_tags` and `equipment_required` (JSON
    already did) and **validates both against the enums** instead of casting. A
    typo'd requirement used to be inert; it now hides a drill from everybody.
  - Scope, as agreed: `/drills` and the Today recommendations. `plan.ts`'s
    rest-day skills suggestions are deliberately untouched.
  - _Not verified in a browser — this session had no browser automation
    available, unlike Phases 1–4d. `npm run check`, 327 unit tests and
    `npm run build` all pass, but the filter panel, the chip rows and the
    v8→v9 upgrade on a real IndexedDB have not been driven by hand._

- **Phases 2, 5–6** have not started — they need the open questions below
  answered, and Phase 2 specifically needs your content files. Note for
  whoever picks up Phase 2: the `exercises`/`programs`/`program_weeks`/
  `program_sessions`/`program_items` tables already exist (added empty in v2,
  carried unchanged into the drill-library admin's v3 — see "Storage & repo"
  below), so Phase 2 likely needs **no new Dexie version**, just a seeder that
  populates them, as Phase 3 has now done for `positions`. Follow the pattern
  `seedDrills()` and `seedPositions()` use: insert-only by key, so re-running
  the importer never clobbers anything a later phase (enrolment, adaptation)
  has written on top.

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

## Injuries: forked out

**The app no longer collects, stores or reads injury data.** Storing a body
region and an injury status — even coarse, even device-local — is storing health
data, and health data is what drives most of the privacy policy work this app
would otherwise have to complete before shipping. Removing collection removes
the obligation. This was a decision about compliance cost, not about whether the
feature is worth having.

What happened:

- The types (`InjuryFlag`, `InjuryStatus`), the contraindication filter and its
  tests moved to `src/lib/injuries/` — **dormant, imported by nothing**, kept
  whole so re-enabling is a wiring job rather than a rewrite. That directory's
  README is the re-enabling guide.
- `PlayerProfile.injuries` and `ProfileInput.injuries` are gone;
  `PLAYER_PROFILE_SCHEMA_VERSION` is now `2`.
- **Dexie v4** strips the `injuries` key from stored profile rows on upgrade.
  Existing data is deleted, not merely left unread — otherwise the exposure
  would persist on any device whose owner never saved their profile again. That
  migration stays even if injuries come back.
- Onboarding dropped from four steps to three; the `/profile` injury editor is
  gone.
- `isEligible` no longer has an injury branch and `ExclusionReason` no longer
  has an `injury` variant.

What deliberately stayed: `BodyRegion` and `Exercise.contraindicated_regions`.
Those describe **reference content** — which regions an exercise is unsuitable
for — and say nothing about any particular player, so they carry no privacy
weight. Phase 4 content can still author them; eligibility simply does not
consult them while the fork is dormant.

**Before re-enabling, write the privacy policy.** That is the cost this fork
defers, and it comes due the moment the first flag is stored again.

## Duty of care — read this before building phase 4

The injury half of this section is **currently dormant** (see above), but the
reasoning is unchanged and must be re-read before switching it back on.

We are prescribing loaded resistance training to someone who may be a
14-year-old, and asking about injuries. That earns some deliberate constraints.
None of these are hard to build; all of them are hard to retrofit.

**Age gating is a data rule, not a UI suggestion.** Every exercise and program
carries `min_age_group`. The recommendation layer filters on it and cannot be
overridden by the UI:

| Age group | Resistance training exposure                                                               |
| --------- | ------------------------------------------------------------------------------------------ |
| U11–U15   | **No strength programs at all.** Running, skills and games only.                           |
| U17       | Light external load, technique-led, higher reps. RPE only — no `%1RM`, no maximal singles. |
| Seniors   | Full programs, `%1RM` and RPE prescription available.                                      |
| Masters   | Full programs, everything scaled to 85%. Shorter blocks lead; nothing is withheld.         |

**Masters is a reduction, not a restriction, and the difference is the point.**
Resistance training is the main defence against the muscle loss and tendon
stiffness behind the soft-tissue injuries that actually cost masters players
seasons, so withholding it would work against the reason for reducing the load.
The junior rule removes strength work because a growing body does not need it
yet; the masters rule keeps it and makes it lighter. Both live in the
recommendation layer, and they are deliberately not the same mechanism — see
`domain/load-policy.ts`.

The U11–U15 row is stricter than this plan originally proposed (bodyweight and
landing mechanics were going to be allowed) and the decision was deliberate:
the marginal benefit of app-prescribed resistance work at that age does not
justify the injury risk of doing it unsupervised. Withholding it entirely is
also far easier to reason about than a bodyweight-only carve-out, which would
have needed its own rules about what counts as load.

The band names changed at the same time — U12/U14/U16/U18 became
U13/U15/U17/Seniors, with U11 added below — to match how community football
actually grades juniors. Dexie v5 rewrites stored profiles; see the migration
comment in `src/lib/data/db.ts` for why the value has to be rewritten rather
than mapped at read time.

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
	age_group: AgeGroup; // 'u11'|'u13'|'u15'|'u17'|'senior'|'masters'
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
position → age group and experience → availability and equipment. (A fourth
injuries step was built and has since been removed — see "Injuries: forked out".)
Anything skipped
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
committed seed modules and fails loudly on bad input._ Still open, and now the
main gap: Phase 3 shipped hand-authored position weights as a bundled seed to
get around it, but exercises and programs cannot be faked the same way at the
volume Phase 4 needs.

**3 — Drill recommendations. ✅ Done.** Scoring, eligibility, "Recommended for
you". Taken ahead of Phase 2. _Done when: two profiles differing only by
position get demonstrably different drill orders._ — verified in a browser:
small forward, key defender and ruck each produced a different order from the
same library.

**4 — Strength programs. ✅ Done.** Program browser, detail, enrolment, session
view, age gating enforced. Taken ahead of Phase 2, on hand-authored seeds.
_Done when: a U15 profile cannot surface a loaded lift by any route through the
UI._ — verified in a browser and locked in by tests covering all three layers
the gate is applied at.

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
