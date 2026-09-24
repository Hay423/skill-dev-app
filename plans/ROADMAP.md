# Roadmap

## Shipped in the scaffold

- Drill library (12 seed drills) with category filtering and detail pages
- Rep logging: hit/miss tally, foot selection, undo, save
- Progress: streaks, accuracy, daily volume, per-skill breakdown
- Local-first storage via Dexie, with a Supabase-ready schema
- Env-driven backend selection (`PUBLIC_DATA_BACKEND`) and an owner (`user_id`)
  stamped and indexed on every user-owned row from day one
- PWA shell: manifest, service worker, offline caching

## Known gaps

- **App icons are missing.** `static/manifest.webmanifest` references
  `icon-192.png`, `icon-512.png` and `icon-512-maskable.png`, which do not exist
  yet. Install-to-home-screen will not offer a proper icon until they are added.
- **Sessions have no UI.** `Session` and the `Repo` session methods exist and
  work, but nothing calls them. This is the next feature.
- **No storage tests.** `LocalRepo` is untested; it needs `fake-indexeddb` and a
  test suite.
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

- Skill benchmarks by age group, so accuracy has context
- Video capture of a kicking action for self-review
- Drill recommendations that target the weakest skill
- Coach/team mode — deliberately deferred; the player loop comes first
