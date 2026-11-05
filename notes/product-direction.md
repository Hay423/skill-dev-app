# Product direction

> **Personal reference, not a build doc.** This file lives outside `plans/` on
> purpose and nothing in the codebase points to it — `ROADMAP.md` and
> `player-profile.md` don't reference it, and it isn't picked up automatically.
> It won't be read at the start of a session the way `CLAUDE.md` is.
>
> **To use it:** in a future conversation, ask Claude Code to read
> `notes/product-direction.md` (or paste its contents in) before starting
> product-direction work, so the decisions below are in context. Nothing here
> takes effect in the app until it's deliberately carried into `plans/` —
> e.g. "read notes/product-direction.md, then update ROADMAP.md/
> player-profile.md to reflect it."

Status: **Direction agreed over five interview rounds, 2026-09-25.** Where
this disagrees with [plans/ROADMAP.md](../plans/ROADMAP.md) (what's next) or
[plans/player-profile.md](../plans/player-profile.md) (how the profile and
programs work) on priority, treat this as the more recent intent — but it's
the source to reconcile from, not a doc those two automatically defer to.

## The one-line version

A public, local-first training app that tells any Australian rules player —
junior, senior, women's, masters — **exactly what to train today**, and proves
it is working by **measuring their skills against themselves, their age group
and other players**. Australia first.

## Interview answers

### Round 1 — direction

| Question                       | Answer                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Audience                       | **Public product**, not a personal tool                                                 |
| Player level                   | **Mixed** — juniors through adults                                                      |
| Player base                    | Juniors of both sexes, **women's / AFLW**, **masters / veterans**                       |
| What "working" means           | Training habit, measurable skill gains, knows what to do, game-ready fitness — all four |
| First to ship well             | **Measurable skill gains**                                                              |
| Current usage                  | Not in real use yet                                                                     |
| Juniors                        | **Parent-managed** — a parent sets up and oversees, possibly several kids               |
| Monetisation                   | **Undecided** — narrowed in round 4, see "Money"                                        |
| What to measure beyond tallies | **Standard skill tests** and **fitness tests**, retaken periodically                    |
| Benchmark context              | **All three layers** — own history → age/level norms → community                        |
| Match day                      | **Light reflection** — what went well / what to work on, feeding suggestions            |
| Video / wearables / GPS        | **All wanted** — video self-review, wearable/HR import, GPS running                     |
| Accounts & sync                | **Before public launch**, local-first stays                                             |
| Season                         | **Season-aware** — pre-, in- and off-season change content and load                     |
| Content source                 | **Curated + experts** — reviewed contributions from coaches / S&C professionals         |
| Daily plan                     | **Fully planned** — "today is X, Y, Z", one tap to start                                |
| Platform                       | **Native eventually** if it takes off                                                   |
| Retention                      | Streaks & goals, reminders, **social / friends**                                        |
| Duty of care                   | **Very high** — qualified review, conservative defaults, clear disclaimers pre-launch   |

### Round 2 — refinement

| Question              | Answer                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Norms source          | **Published research** (sports science literature, talent-pathway testing data)                             |
| Test protocol         | **Solo, cones + ball** — anyone can do it alone; the player scores themselves                               |
| Coach mode scope      | **Full**: view progress, assign focus, squad benchmarks, set strength, conditioning and plyometric programs |
| Coach mode timing     | **Post-launch**, full scope — players launch first                                                          |
| Coach vs planner      | **Coach wins** — the coach's program replaces the planner's; the planner fills the gaps                     |
| Availability          | **Weekly template** — set once: training days, session length, club nights, game day                        |
| Club training & games | **Known as days only** — the planner backs off; no club load tracked                                        |
| Social means          | **All four**: mates' activity feed, head-to-head tests, shared challenges, training together                |
| S&C reviewer          | **Someone already known** — an accredited professional is lined up                                          |
| Launch bar            | **Tests + progress, daily planner, accounts + sync.** App stores are _not_ required for launch              |
| Market                | **Australia first** — local terminology, age groups and a southern-hemisphere season                        |

### Round 3 — deep dive

| Question                    | Answer                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Launch skill tests          | **Kicking accuracy, goalkicking set shots, handball accuracy**                                    |
| No published norm           | **Own history only**, with an honest "no published benchmark for your group yet"                  |
| Running prescription        | **Time + effort** — "6 × 3 min hard, 90 s walk"; no GPS or testing needed                         |
| Program organisation        | **By physical quality** (speed, strength, power, aerobic), position weights the recommendation    |
| Position tailoring          | **Kept** — sessions still get small position swaps; "by quality" is how the library is organised  |
| Coach safety for juniors    | Reviewed exercises + age gates **+ weekly volume caps by age group**                              |
| Train together              | **Invite to a session** — each player logs their own reps; shows as shared on both feeds          |
| Retest cadence              | **Player's choice**, default **every 4 weeks**                                                    |
| Junior with their own phone | **Linked child login** — the parent's account creates it and keeps oversight                      |
| Goals                       | **Suggested from test results** — "left foot 5/10 → 7/10 by round 1"                              |
| Measuring the product       | **Outcomes only** — aggregate test improvement and retention, from synced data; no usage tracking |

### Round 4 — closing open questions

| Question               | Answer                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Money models kept open | **Player subscription, club / coach tier, free forever** — grants/sponsorship not pursued |
| Always free            | **Logging + tests + own history, daily planner, junior safety, sync**                     |
| Effort scale           | **Words + RPE** — "Hard (RPE 7–8)"; words lead, the number is there for those who know it |
| Child login minimum    | **13+** — younger players are held on the parent's account and device                     |
| Volume caps            | **Adopt a published youth S&C standard** outright and cite it                             |
| Kicking test           | **20, 30, 40 m × 5 per foot** = 30 kicks into a coned target zone, **hit / miss**         |
| Set-shot test          | **5 spots, scored goal 6 / behind 1 / miss 0** — reads like a real score                  |
| Handball test          | **Both**: 5, 10, 15 m × 5 per hand at a target (hit / miss), plus a timed wall test       |
| "Retained"             | **Active weekly** — a logged session in each of the last 4 weeks                          |
| "Improved"             | **Beat baseline by 10%+** — relative to the player's first result on that test            |

### Round 5 — kicking distances and "10% better"

| Question                 | Answer                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kicking test by age      | **Two tiers** — a shorter-range junior test and the 20/30/40 m senior test, not one scaled formula                                                          |
| Junior→senior transition | **Convert with a formula** — estimate an equivalent senior-test baseline from the junior result, so the trend line stays continuous, flagged as an estimate |
| Baseline for "improved"  | **Rolling** — re-anchors to a new personal best once it's beaten the old baseline by a wide margin, rather than staying pinned to the first-ever result     |
| Product outcome metric   | **% gain with a floor** — keeps the 10%-relative-gain metric, but only once the baseline clears a minimum score                                             |

These settle every open question in player-profile.md:

- **Q2 (programs by position or quality?)** — by quality, position tailoring
  kept inside sessions.
- **Q3 (running prescription?)** — time + effort.
- **Q4 (adult first or junior path?)** — the junior path is needed, and it is
  parent-managed.
- **Q5 (multiple players per device?)** — yes, and more: juniors can also have
  their own linked login. See "Schema consequences"; this is the most urgent
  structural change the direction implies.

## Pillars

Four outcomes, ordered by what ships first. Each pillar lists what already
exists so the gap is honest.

### 1. Measurable skill gains — _first_

The thing that makes every other pillar credible. If a player can't see that
they're improving, the plan, the streaks and the programs are all faith.

- **Three skill tests at launch**, each a fixed protocol doable **alone with a
  ball and cones**:
  1. _Kicking accuracy_ — drop punts, 5 per foot at each of three distances
     (30 kicks total) into a coned target zone, scored **hit / miss**, reported
     per distance and per foot so weak-foot and range gaps show up separately.
     **Two tiers**, not one scaled formula: a **senior test at 20/30/40 m**
     (u15 and above) and a **shorter junior test** (u11/u13) at roughly half
     those distances — proposed 15/20/25 m, pending the reviewer, chosen so its
     longest distance (25 m) still overlaps meaningfully with the senior
     test's shortest (20 m). See "Ageing between test tiers" below.
  2. _Goalkicking set shots_ — **5 marked spots** (in front, both 45° angles,
     a pocket), scored like a real game: **goal 6, behind 1, miss 0**.
  3. _Handball_ — two parts. **Accuracy**: 5, 10 and 15 m, 5 per hand at each
     distance, at a target (wall square or bin), hit / miss. **Speed**: hits on
     a wall target in a timed window, alternating hands.

  A test is not a drill: it's a protocol with fixed rules so results are
  comparable across time and across players. Ground ball / agility is a
  candidate for later. Target zone sizes, exact spots and the timed window are
  protocol detail to fix when the tests are built — but once published, a
  protocol never changes, or old results stop being comparable (the same rule
  as permanent drill ids).

#### Ageing between test tiers

The kicking test alone has a junior and a senior tier, because a fixed
20/30/40 m protocol leaves a young junior scoring near zero at 40 m — a test
that's mostly misses can't show progress — while a protocol that scales
smoothly by age group makes every age's results incomparable with every other
age's, forever, which breaks the age/level norms the whole benchmark layer is
built on. Two fixed tiers keep both properties where they matter: comparable
within a tier, and not pretending to be comparable across the boundary.

The cost lands on one event: a player's test moves from the junior tier to the
senior tier (`age_group` crossing from `u13` to `u15`), and their history is in
distances the new test doesn't use. Rather than showing a gap in the trend
line, or marking the old results as a different, disconnected test, the
player's last junior-tier result is **converted into an estimated senior-tier
baseline** by a single domain function and shown as the seed point the new
trend line continues from — labelled as estimated, and replaced by a real
result the first time the player actually sits the senior test. The
conversion is deliberately simple (their junior-tier hit rate applied as the
seed accuracy on the senior test) rather than a fitted model — it only has to
hold the trend line together for one transition, not predict performance.

- **Self-scored.** Solo means the player marks their own result. That's fine
  for their own history, and it's the price of anyone being able to test. It
  limits how far results can be trusted when compared with other people — see
  "Trusting self-scored results" below.
- **Retests** every 4 weeks by default, changeable on the profile. The planner
  schedules them.
- **Fitness tests.** Yo-yo, 2 km time trial, 20 m sprint, vertical jump, and
  the like — the same "protocol + result" shape, with the same solo constraint
  (phone timer, tape measure). They measure progress; they don't drive running
  prescription, which is time + effort.
- **Three-layer benchmarks.**
  1. _Own history_ — personal bests, trend lines, weak foot vs strong foot
     (`foot` is already recorded). Already in ROADMAP "Better progress".
  2. _Age/level norms_ — from **published research**, per age group, sex and
     level. Every norm carries its source. Where research has no norm for the
     player's group — likely for junior girls, women and masters — the player
     sees **own history only**, with an honest note, never a borrowed norm
     from another group.
  3. _Community_ — anonymous percentiles from other users. Needs sync and
     enough users; post-launch. Also the long-term way to fill the gaps
     research leaves.
- **Post-game reflection.** A short note after a game — what went well, what to
  work on — tagged to skills, feeding the recommendation weights. No stat
  entry.

Exists today: hit/miss logging, accuracy, streaks, per-category breakdown.
Missing: tests as a concept, personal bests, per-drill history, any norms.

#### Trusting self-scored results

Head-to-head tests and community percentiles both compare self-scored numbers.
Among friends that's a social contract and is fine. For community percentiles:

- Label every comparison as self-reported.
- Exclude outliers beyond what the published norms make plausible, rather than
  letting one inflated score skew a percentile.
- A future coach-verified result (a coach watched it) could carry more weight —
  a natural fit once coach mode exists.

### 2. Knows what to do — the daily plan

Fully prescriptive: open the app, see today's session, tap start. **Part of the
launch bar.**

- **Guided sessions** (ROADMAP #1) are the prerequisite — the run view with a
  timer and inline tallies is how a planned session actually gets done.
- **Weekly template.** Set once in the profile: which days the player trains
  on their own and for how long, which nights are club training, and game day.
  The planner fills the template; it doesn't ask each day.
- **Club days as days.** The planner knows club nights and game day and backs
  off around them — no heavy legs the day before a game, no hard running on a
  club night. It does not track club session load or effort.
- **Planner.** Combines skills (weighted to position and to weaknesses from
  pillar 1), strength, running and plyometrics into the template's slots,
  respecting equipment from the profile and the **weekly volume caps** for the
  player's age group (see Safety).
- **Season-aware.** Season dates on the profile (southern hemisphere by
  default). The planner shifts emphasis by phase — off-season build,
  pre-season volume, in-season maintenance — and tapers around game day.
- **Test days.** The planner schedules the pillar 1 retests at the player's
  interval, so measurement happens without the player remembering to do it.
- **Coach override** (post-launch). When a coach has assigned a program, it
  replaces the planner's program in that discipline; the planner schedules
  around it rather than competing with it.

Exists today: position-weighted drill recommendations, periodised strength and
plyometric programs, heart rate bands, warm-ups/cool-downs. Missing: guided
sessions, the weekly template, the planner, season model, volume caps,
conditioning blocks (player-profile Phase 5).

### 3. Training habit

- **Streaks** exist.
- **Goals, suggested from tests.** After a test, the app proposes a realistic
  target and date — "left foot 5/10 → 7/10 by round 1". What counts as
  realistic is a pure function in `src/lib/domain/` (from the player's own
  trend, and norms where they exist), with tests.
- **Reminders** — push for today's planned session. Web push on iOS only works
  for an installed PWA, and launch is a PWA; native removes that caveat.
- **Social** (post-launch, all four, in rough order of cost):
  1. _Mates' activity_ — a feed of what friends trained, streaks, PBs.
  2. _Head-to-head tests_ — compare test results with friends.
  3. _Shared challenges_ — join a challenge together ("500 kicks this week").
  4. _Train together_ — plan a session and invite a mate. **Each player logs
     their own reps** in their own rows; the session shows as shared on both
     feeds. No row ever has two owners — a small invitation/link table is
     enough.

  All of it needs accounts, and all of it is constrained for juniors — see
  Safety.

### 4. Game-ready fitness

Mostly the existing S&C direction in player-profile.md, carried through:
conditioning blocks, then adaptation from logged performance. Decided in the
interviews:

- **Programs are organised by physical quality** — speed, strength, power,
  aerobic fitness. Position decides which qualities are recommended, and the
  existing position tailoring inside sessions stays.
- **Running is time + effort.** "6 × 3 min hard (RPE 7–8), 90 s walk." No
  GPS, track or tested maximum needed, which keeps it doable anywhere.
  **Effort is words + RPE**: a small fixed scale of words (easy / steady / hard
  / flat out, each with a one-line talk-test description) leads, with the RPE
  range beside it for players who know it. The word ↔ RPE ↔ `%HRmax` mapping
  lives in one domain function, so a player with a heart rate monitor sees the
  existing band for the same effort.
- **Female-specific S&C** — ACL-injury-prevention emphasis for women's and girls'
  football, reviewed by a qualified professional.
- **Masters content** — `masters` already exists in `AGE_GROUPS`; what's
  missing is content and load defaults that actually differ for it.
- **Wearables and GPS** — HR import and GPS running, feeding real numbers into
  conditioning instead of estimates (see the measured max HR gap in ROADMAP).
  Native-wrapper territory, post-launch.

## Families

Juniors are parent-managed, in two shapes that must both work:

- **On the parent's device** — the parent's account holds one or more player
  profiles, and the parent switches between them. **The only option under 13.**
- **Linked child login, 13+** — the parent's account creates a login for the
  junior, who trains on their own phone. The parent keeps oversight: sees
  progress, approves friend and coach links. A parent-held profile can be
  upgraded to a linked login when the player turns 13, keeping their history.

Either way the parent's account is the guardian, and every consent a junior
needs (friends, coaches, community percentiles) routes through it.

## Coach mode

Post-launch, but full scope rather than light-touch. Players launch first.

- **View progress** — with the player's consent (the parent's, for a junior),
  a coach sees tests, accuracy and consistency.
- **Assign focus** — "work on your left foot this week", which feeds the
  planner's skill weighting.
- **Set programs** — a coach assigns strength, conditioning and plyometric
  programs — all three disciplines the app has — and the coach's program wins
  over the planner's in that discipline.
- **Squad benchmarks** — a coach compares test results across the players
  linked to them.

Structural implications, worth knowing now even though it's later:

- **Coach-authored programs are owned content.** Programs are currently
  reference content — bundled, identical for everyone, never pushed. A coach's
  program belongs to the coach and is shared with specific players, which is a
  new category: owned, shared, and read by people other than its owner. RLS
  gets a sharing policy, not just `user_id = auth.uid()`.
- **The coach–player link** is a new owned relation with consent state, and for
  juniors the parent account grants it.
- **Duty of care holds** in three layers. The app can't review what a coach
  writes, so for juniors:
  1. Coach programs are built only from the **reviewed exercise library**.
  2. **Age gates** still apply — no loaded lift for a U15, no reactive
     plyometrics below U17.
  3. **Weekly volume caps** by age group bound total sets, jump contacts and
     running minutes, so a coach can't overload a junior even with allowed
     exercises.

  The same caps bind the planner. They are one pure function applied to
  whatever produced the week.

## Schema consequences

These are structural and cheaper the earlier they land. Worth deciding before
anything else changes the Dexie schema.

1. **Account ≠ player.** Today `user_id` doubles as "who owns the row" and
   "whose training this is", and the profile is a singleton. Families need
   both shapes above: several players under one account, _and_ a junior with
   their own login whose parent can still read their data. So:
   - every player-scoped row (rep logs, sessions, enrolments, test results,
     goals) gets a `player_id`, indexed, with `PlayerProfile` becoming a table
     keyed by it;
   - `user_id` stays the RLS owner;
   - a **guardian link** (parent account → player) grants read and consent
     rights across accounts.

   Doing this before sync ships means the Postgres schema is right first time;
   after, it's a data migration on every user's rows. Coach links and
   guardian links are the same shape — a consented relation granting access
   to someone else's player — so design them once.

2. **Tests and results.** New reference content (`test_protocols` — the
   kicking test has two rows, one per tier, related as junior/senior — and
   `test_norms` with a source citation per row, neither owned) and a new owned
   table (`test_results`), following the "adding a user-owned table" checklist
   in CLAUDE.md. `test_results` carries a `baseline_result_id` (the rolling
   baseline it's compared against) and, for a tier-transition seed point, an
   `estimated: 0 | 1` flag and the junior result it was converted from.
3. **Weekly template, season, retest interval.** Training days, session lengths,
   club nights, game day, season dates and retest interval on the player
   profile — or a small owned `seasons` table if history across seasons
   matters (it will, for year-on-year benchmarks).
4. **Sex.** Norms and female-specific programs need a sex field on the profile —
   optional, with a clear reason given in the UI.
5. **Goals.** A small owned table: skill or test, target, date, and the result
   it was suggested from.
6. **Volume caps.** Reference content: per age group, weekly limits on sets,
   jump contacts and running minutes, adopted from a published youth S&C
   standard, with the citation carried on the data.
7. **Reflections.** A small owned table: date, free text, skill tags.
8. **Shared sessions** (post-launch). An invitation/link between two players'
   sessions. Each player's reps stay in their own rows.
9. **Test results keep their parts.** A kicking result is 30 hit/miss outcomes
   by distance and foot, not one number; a set-shot result is 5 spots of
   goals/behinds. Store the parts and derive totals in the domain layer, so
   per-foot, per-distance and "10% over baseline" can all be computed from the
   same row.

## Launch

### The bar

A public launch needs all three, and nothing else:

1. **Tests + progress** — the three skill tests end to end, with published
   norms where they exist.
2. **Daily planner** — pillar 2, including guided sessions and volume caps.
3. **Accounts + sync** — data safe across devices; parent accounts and linked
   child logins.

Plus the non-negotiables from Safety: reviewed S&C content, disclaimers,
privacy policy and parental consent.

Launch is a **PWA**, not an app store listing. Australia only.

### Sequencing

Each step is shippable alone. Steps 1–7 are the launch; everything after is
post-launch.

1. **Player-vs-account split.** Schema only — `player_id`, profile table,
   multi-profile switcher, guardian link shape. Unblocks parents, and must
   precede sync.
2. **Measurement.** The three skill tests, fitness tests, test results,
   published norms, personal bests, per-drill history, weak-foot comparison,
   suggested goals.
3. **Data safety.** Export/import, `navigator.storage.persist()` (ROADMAP #2).
   Earlier than it looks — test history is the data players will be most upset
   to lose.
4. **Guided sessions.** ROADMAP #1.
5. **Weekly template + season-aware daily planner.** With time + effort
   conditioning blocks (player-profile Phase 5), volume caps, scheduled
   retests and post-game reflection.
6. **Accounts & sync.** Supabase, optional sign-in, parent accounts, linked
   child logins.
7. **Pre-launch gate.** S&C review and volume caps signed off, disclaimers,
   privacy policy, parental consent. **Launch.**
8. **Habit and social.** Reminders, mates' feed, head-to-head, shared
   challenges, community percentiles, train-together invitations.
9. **Coach mode.** Consent links, view progress, assign focus, coach programs,
   squad benchmarks.
10. **Native wrapper.** Capacitor around the SvelteKit app for background GPS,
    HealthKit/Health Connect, reliable push, app store presence. A full native
    rebuild only if the product justifies it.
11. **Wearables, GPS running, video self-review.** Adaptation (player-profile
    Phase 6) alongside, once there are real numbers to adapt to.

## Measuring the product

**Outcomes only** — no usage analytics, no third-party tracking. The two
numbers that matter:

- **Improved** — a player's latest result on a test beats their **baseline**
  on that test by **10% or more** (relative). Measured per test, so a player
  can be improved at kicking and not yet at handball. The headline is the
  share of players with at least two qualifying results who are improved.

  The baseline is **rolling, not fixed at the first result**: it starts as the
  first result that clears the floor below, and re-anchors to a new result
  whenever that result beats the current baseline by the same 10% margin — so
  one comparison rule does both jobs, "is this improved?" and "what's the new
  baseline?", rather than needing a second, separately-invented notion of a
  "wide margin". Practically: cross 10% once, get counted as improved and get
  a new, higher baseline; the next improvement has to clear 10% again from
  there. A rolling baseline never resets downward — a bad day doesn't erase a
  personal best.
  - **Floor.** A baseline below a minimum score doesn't count for the metric
    yet, because percentage gain is meaningless near zero (1/30 → 2/30 is
    +100%). Below the floor the player still sees their own raw progress; the
    outcome metric waits until a result clears it. The exact floor (proposed:
    around 20% of the test's maximum) is still open — see Open questions.

- **Retained** — **active weekly**: at least one logged session in each of the
  last 4 calendar weeks (local weeks, as with `local_date`).

Both come from synced data, computed server-side in aggregate, and both are
pure domain functions first so the definitions are tested and identical on
device and server, and so the rolling-baseline state (current baseline,
current tier for kicking) is a value the function threads through rather than
something re-derived ad hoc in two places. Consequences:

- Players who never sign in are invisible to these numbers.
- The privacy policy has to say plainly that synced results are used this way,
  with extra care for juniors' data.

## Money

Still undecided, but narrowed. Three models stay open and the architecture
must not rule any of them out: a **player subscription**, a **club / coach
tier**, or **free forever**, self-funded. Grants and sponsorship aren't being
pursued.

**Always free, whatever is chosen:**

- Rep logging, skill tests and own-history progress
- The daily planner
- Sync — data safety is never paywalled
- Everything that keeps juniors safe: parent oversight, consent, age gates,
  volume caps

That leaves the paid candidates as roughly: community benchmarks and
head-to-head, the wider program library beyond what the planner uses, coach
mode, and the post-launch extras (wearables, video). The drill library wasn't
marked always-free, so it's a candidate too, though the planner needs drills to
plan with.

What this means for the build now:

- **Entitlements are data, checked offline.** A paid feature is gated by a
  cached entitlement the app can read with no signal, never by a network call
  at the moment of use. The gate is one domain function.
- **Nothing always-free sits behind an account-only path** except sync itself.
- Hosting cost arrives with sync, which is free. Whatever model is chosen has
  to carry the sync cost of free users.

## Safety and duty of care

Weighted **very high**. A public app with junior users prescribing load is a
different thing from a personal tool.

- **Qualified review before launch** of every strength, plyometric and
  conditioning program — female-specific and masters content especially. The
  reviewer is someone already known to the project; record who reviewed what,
  and when, against the content itself.
- **Weekly volume caps by age group**, adopted from a published youth S&C
  standard and cited, applied to the planner and to coach programs alike. The
  reviewer checks the programs against the caps; the caps themselves come from
  the standard, not from us.
- **Conservative defaults.** When the profile is incomplete, assume the younger
  age group, the lower experience level and less equipment.
- **Disclaimers** that read as guidance, not clearance. The existing
  duty-of-care section in player-profile.md applies to all of this.
- **Juniors and social.** No public profiles, discoverability or open messaging
  for under-18s. Friend connections, coach links and train-together invitations
  for a junior are approved by the guardian account. Community percentiles are
  anonymous and aggregate only.
- **Coaches don't bypass gates.** See Coach mode.
- **Privacy.** Children's data, health data (HR) and location (GPS) all raise
  obligations under the Australian Privacy Act. A privacy policy and
  parental-consent flow are launch blockers, not polish.

## Principles that don't change

The CLAUDE.md principles hold for the public product too, and several get
_more_ important:

- One thumb, outdoors, no signal. Offline is the default — sync is additive.
- Components render; `src/lib/domain/` calculates, with tests. Goal
  suggestions, volume caps and the planner are all domain functions.
- Reference content is not owned. Test protocols, norms, volume caps and
  curated programs ship with the app; test _results_, goals and coach programs
  are owned.
- Australian English and correct footy terminology.

## Open questions

1. **Which model, and when.** Money is narrowed to three models; the choice is
   needed before sync (step 6) so it's known who carries the hosting cost.
2. **Junior kicking-test distances.** Proposed 15/20/25 m against the senior
   test's 20/30/40 m, chosen to overlap at 20 m — needs the reviewer's sign-off
   on whether that's realistic for U11 and whether the tier boundary
   (u11/u13 vs u15+) is right.
3. **Which published standard** for volume caps (e.g. ASCA or NSCA youth
   resistance-training positions), and whether it covers jump contacts and
   running minutes or only resistance work.
4. **Protocol detail.** Target zone size, the five set-shot spots, the handball
   speed window. Also which fitness tests launch alongside the skill tests.
5. **Improvement floor.** Proposed around 20% of a test's maximum score, below
   which a baseline doesn't count toward the "improved" outcome metric — needs
   a final number per test.
