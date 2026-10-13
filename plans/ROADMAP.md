# Roadmap

## Shipped in the scaffold

- Drill library (12 seed drills) with category filtering and detail pages
- Rep logging: hit/miss tally, foot selection, undo, save
- Progress: streaks, accuracy, daily volume, per-skill breakdown
- Local-first storage via Dexie, with a Supabase-ready schema
- Env-driven backend selection (`PUBLIC_DATA_BACKEND`) and an owner (`user_id`)
  stamped and indexed on every user-owned row from day one
- PWA shell: manifest, service worker, offline caching

## Measurement: the baseline testing phase

**Shipped.** Every player goes through a testing phase: fixed protocols, sat
once as a baseline and again every four weeks by default. This is step 2 of the
launch sequence in [notes/product-direction.md](../notes/product-direction.md)
(step 1, the player-vs-account split, was deliberately deferred — see below).

- **Three tests, four protocols** in `src/lib/data/seed/tests.ts`. Kicking
  accuracy has a **junior tier** (15/20/25 m, U11–U13) and a **senior tier**
  (20/30/40 m, U15+), 30 drop punts into a 5 m square, five per foot per rung.
  Goalkicking is 15 set shots from five marked spots, scored goal 6 / behind 1 /
  miss 0. Handball is two parts: 30 handballs at 5/10/15 m, five per hand, plus
  a 30-second timed wall test. Which tier a player sits comes from one rule —
  `age_groups` on the protocol.
- **The parts are stored, never a total.** `TestResult` holds one outcome per
  attempt slot; accuracy, weak-foot versus strong-foot, per-distance,
  per-spot, the rolling baseline and "10% better" are all derived in
  `src/lib/domain/tests.ts`.
- **Rolling baseline.** First result is the baseline; any later result clearing
  it by 10% counts as improved _and_ becomes the new baseline. Never moves
  downward. `baseline_result_id` is stamped at write time from the same
  function the UI reads, so the row records the comparison that was shown —
  which is what the eventual server-side outcome metric needs.
- **Prompts, never blocks.** A 30-kick test needs an oval, so the app stays
  fully usable: a card on Today counts the phase down, and the Progress
  benchmark panel is the one thing gated on it. A test whose equipment the
  profile does not claim is listed with a note and is still startable — and a
  result counts as proof of access regardless of what the profile says.
- **Protocols are frozen once released**, more strictly than drills. See the
  rule in `seed/tests.ts`; the detail chosen there (target size, shots per
  spot, window length) is provisional only until the S&C reviewer signs it off,
  which is the last moment it can change without invalidating stored results.

Two deliberate departures from product-direction.md:

- **The tier-transition seed point is derived, not stored.** It planned a
  written row with an `estimated` flag. Computing it on read (`tierSeedResult`)
  gives the same unbroken trend line with nothing to find and invalidate when a
  real senior result lands — the same second-source-of-truth that `current_week`
  was for the program calendar, and dropped for the same reason. The conversion
  carries the junior outcome slot for slot, which works because the two tiers
  are the same shape.
- **Built on the singleton profile.** The player-vs-account split (`player_id`
  on every player-scoped row) is still step 1 and still has to precede sync;
  `test_results` is simply one more table it will touch, which is cheap while
  the data is local-only.

Still open on measurement:

- **No published norms.** `test_norms` is not built. Players see their own
  history with an honest "no published benchmark for your group yet", which is
  the agreed behaviour where research has no norm — it is now the behaviour
  everywhere, because no cited norm data has been sourced or reviewed yet.
  Needs: norm rows carrying a source per row, and an importer.
- **Fitness tests** (yo-yo, 2 km, 20 m sprint, vertical jump) are not built.
  They reuse the same protocol-and-result shape, so they are seed content plus
  a scoring mode for a measured value rather than a tally.
- **Community percentiles and suggested goals** both wait on sync.
- **The report does not change what the app suggests.** `weakestDimension` names
  the gap ("40 m, 20%") but the recommendation layer never reads it, so a bad
  left foot in round 3 does not weight the drills offered in the weeks after.
  That was considered and deliberately left out of this change — it touches
  `domain/recommend.ts` and wants its own think.

## The monthly retest cycle

**Shipped.** The same tests, sat again every four weeks, as a numbered **round**
— which is what makes month-over-month comparison honest. Lives in
[src/lib/domain/retest.ts](../src/lib/domain/retest.ts), 36 tests.

- **A round, not a pile of due dates.** All of a player's tests fall due
  together and a round is one snapshot, so Round 3 against Round 2 compares like
  with like. Per-test due dates drift apart within weeks and you end up holding
  a kicking test from the 3rd against a handball test from the 19th.
- **Rounds are derived, never stored.** No counter and no `test_rounds` table:
  `testRounds` walks the results oldest-first and buckets them. A round closes
  when it is full, when a test in it is re-sat, or when its window elapses. Same
  rule as `programWeekOn` — a stored counter is a second source of truth that
  disagrees the first time somebody misses a round or deletes a result.
- **Missing a round costs that round.** A part-done round closes incomplete once
  its window passes and the next comes due; the cycle is never held open. A
  straggler cannot reach back and fill a closed round's gap, or two months'
  comparisons would be built on results sat five weeks apart.
- **Scheduled, not just prompted.** `planWeek` places a due round on a day the
  player actually trains, preferring one clear of program sessions — a test on
  tired legs produces the number the next month gets measured against. It takes
  the skills slot, shows in the week strip and on Today, and doubles up rather
  than being dropped when the week is full.
- **The report** is `/tests/rounds`: each round against the one before it and
  against the very first result, per test and then **per dimension** — "left
  foot 8/15 → 11/15, 40 m unchanged" — with a bar per round, the biggest gain
  and the remaining gap. The overall figure is the average of the per-test
  changes, not a ratio of totals, because set shots score out of 90 and kicking
  out of 30 and summing points would let goalkicking decide whether the player
  improved.
- **Across the tier boundary**, a player's first senior round is compared with
  their last junior one via `tierSeedResult`, flagged as estimated, so the trend
  survives turning fifteen.

`baselinePhase` was narrowed in the same change: `done`/`complete` mean _ever
sat_, so the benchmark panel the baseline unlocks does not re-lock itself every
four weeks. Which tests are outstanding **now** is the cycle's question.

## Known gaps

- **App icons are missing.** `static/manifest.webmanifest` references
  `icon-192.png`, `icon-512.png` and `icon-512-maskable.png`, which do not exist
  yet. Install-to-home-screen will not offer a proper icon until they are added.
- **Sessions have no UI.** `Session` and the `Repo` session methods exist and
  work, but nothing calls them. This is the next feature.
- **Storage tests are partial.** Enrolment, ticking, the seeders and test-result
  writes are covered against `fake-indexeddb`; the rest of `LocalRepo` is not.
- **No error boundary.** A Dexie failure surfaces as a bare message in the layout.

## Next up

### 0. Player profile & position-driven training

Planned in detail in [player-profile.md](player-profile.md). Captures position,
age group, experience, equipment access and injury flags, then drives drill
recommendations, periodised strength programs and conditioning blocks from it.
Content arrives as supplied files through a validated importer.

Sequenced ahead of guided sessions: it changes the Dexie schema and the `Drill`
shape, so doing it first avoids reworking session code.

**Phase 1 (profile foundation) is done** — onboarding, `/profile`, Dexie v2.
Phases 2–6 (content pipeline, recommendations, strength/conditioning
programs) are not started; see the open questions in player-profile.md.

Since then the program library has grown a third discipline and a heart rate
prescription:

- **Plyometrics** is `discipline: 'plyometrics'` with `type: 'plyometric'` sessions
  and its own section on `/train` — four blocks, gated at `u13` for landing and
  hopping and `u17` for reactive work, deliberately open below the `u17` floor
  on resistance training.
- **Heart rate** is a `%HRmax` band on `ProgramItem` (`hr_pct_min`/`hr_pct_max`),
  rendered as a zone, a band and an estimated bpm by `domain/heart-rate.ts`. The
  maximum is estimated from age (Tanaka), not measured — a real maximum needs a
  supervised test to exhaustion. Resistance work reads a between-sets recovery
  threshold instead of a work band, and core work reads nothing.

- **Warm-ups and cool-downs** wrap every gym, running and jumping session.
  They are reusable routines in `data/seed/routines.ts`, stamped into each
  session's items as `section: 'warm_up' | 'cool_down'` at seed time and chosen
  from the main work by `routineFocus` in `domain/routines.ts` (gym lower/upper,
  easy/fast running, jumping). They count towards a session being done, but the
  week never scales them and position tailoring never touches them. A session
  spec can name a different routine, or `null` for none.

Open: no way to enter a **measured** maximum heart rate. The estimate is within
roughly ±10 bpm, which is fine for a zone and wrong for a player who has been
tested. An optional `max_hr` on `PlayerProfile` would be a schema bump and a
form field, and `estimateMaxHr` is already the only place the number comes from.

### 1. Guided sessions

The second half of the core loop. Pick drills → run through them one at a time
with a timer → log reps per drill → complete the session.

- Session builder: pick drills, see total duration
- Run view: current drill, coaching points, timer, inline rep tally
- Session summary on completion
- Resume an in-progress session from the Today screen (`repo.activeSession()`)

### 2. Data safety

Local-only data with no export is one cleared cache away from gone.

- Export all data to JSON, import it back
- Warn when storage is near quota
- `navigator.storage.persist()` to reduce eviction risk

### 3. Better progress

- Per-drill history, not just per-category
- Personal bests (best set accuracy, longest streak, most reps in a day)
- Weak-foot vs strong-foot comparison, since `foot` is already recorded

### 4. Supabase sync

Only worth doing once the local app is genuinely useful.

- Postgres schema mirroring `src/lib/types.ts`, row-level security on `user_id`
- Anonymous auth, upgradeable to email
- Push `_dirty` rows, pull by `updated_at`, last-write-wins on conflict
- Implement `SyncRepo` and add the `supabase` case to `createRepo()` in
  `src/lib/data/index.ts`. The env plumbing is already in place: set
  `PUBLIC_DATA_BACKEND=supabase` plus the two `PUBLIC_SUPABASE_*` variables (see
  `.env.example`). Until the case is implemented it throws at boot on purpose.
- Rewrite `LOCAL_USER_ID` to the real auth uid at first sign-in. This is now a
  rewrite of one known value across the five owned tables, each indexed on
  `user_id` — not a hunt for rows that never had an owner. The care needed is in
  the ordering, not the lookup: rows already `_dirty` and mid-push must not be
  re-owned underneath an in-flight request.
- Decide what happens to placeholder-owned rows if a _second_ player ever signs
  in on the same device. Claiming them for whoever signs in first is the only
  answer the local data supports; anything better needs the rows to have been
  distinguishable before sign-in, which they are not.

## Later ideas

- Skill benchmarks by age group, so test results have context beyond the
  player's own history — see "Measurement" above for what this still needs
- Video capture of a kicking action for self-review
- Drill recommendations that target the weakest skill
- Coach/team mode — deliberately deferred; the player loop comes first
