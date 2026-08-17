# Roadmap

## Shipped in the scaffold

- Drill library (12 seed drills) with category filtering and detail pages
- Rep logging: hit/miss tally, foot selection, undo, save
- Progress: streaks, accuracy, daily volume, per-skill breakdown
- Local-first storage via Dexie, with a Supabase-ready schema
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
- Backfill `user_id` on existing local rows at first sign-in
- Implement `SyncRepo` and change the one line in `src/lib/data/index.ts`

## Later ideas

- Skill benchmarks by age group, so accuracy has context
- Video capture of a kicking action for self-review
- Drill recommendations that target the weakest skill
- Coach/team mode — deliberately deferred; the player loop comes first
