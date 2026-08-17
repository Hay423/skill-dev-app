# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A mobile-first web app for developing Australian rules football skills. The user
is an **individual player training themselves** — not a coach running a squad.
Every design decision follows from that: one thumb, outdoors, often with no
signal, usually mid-session with a ball in the other hand.

Two core loops:

1. **Drill library + guided sessions** — browse drills by skill, follow one.
2. **Rep logging + progress** — tally hits/misses, watch accuracy and streaks.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`)
- **TypeScript**, strict
- **Tailwind v4** — CSS-first config in `src/app.css`, no `tailwind.config.js`
- **Dexie** over IndexedDB for local-first storage
- **adapter-static** in SPA mode (`fallback: index.html`) — deploys to any static host
- **Vitest** for unit tests

## Commands

```sh
npm run dev       # dev server
npm run build     # production build to build/
npm run preview   # serve the production build
npm run check     # svelte-check + tsc
npm test          # vitest, single run
npm run format    # prettier --write
```

## Architecture

```
src/lib/types.ts          Domain model — the source of truth for shapes
src/lib/data/repo.ts      Repo interface: the storage seam
src/lib/data/local-repo.ts  Dexie implementation
src/lib/data/db.ts        Dexie schema + indexes
src/lib/data/index.ts     Exports the live `repo` singleton + drill seeding
src/lib/data/seed/        Bundled drill library (reference data)
src/lib/domain/           Pure functions — stats, streaks. Fully unit tested.
src/lib/util/time.ts      Local-calendar date helpers
src/lib/components/       Shared UI
src/routes/               Pages
```

### Rules that matter

**Never import `dexie` or `db` outside `src/lib/data/`.** All reads and writes go
through the `Repo` interface. The whole point is that swapping in a
Supabase-backed repo later touches one line in `src/lib/data/index.ts`.

**Keep logic out of components.** Anything computable — accuracy, streaks,
rollups — belongs in `src/lib/domain/` as a pure function with a test. Components
render; they don't calculate.

**Domain fields are `snake_case`.** These records map 1:1 onto Postgres columns
so the eventual Supabase sync needs no translation layer. This is deliberate and
inconsistent with normal TS style — don't "fix" it.

## Supabase-readiness

The app is local-only today, but the schema is already shaped for sync:

- Ids are client-generated UUIDs, so offline-created rows keep their identity.
- Every user-owned row carries `user_id`, `created_at`, `updated_at`,
  `synced_at`, `_dirty`, `_deleted`.
- `_dirty`/`_deleted` are `0 | 1`, not booleans — IndexedDB cannot index booleans.
- Deletes are **soft**, so they can be replayed to the server.
- `user_id` is null while anonymous; sign-in stamps the real auth uid.

When adding a user-owned table: extend `Owned` and `SyncMeta`, index `_dirty`,
and add the methods to `Repo` before implementing them.

## Conventions

- **Dates**: `local_date` is `YYYY-MM-DD` in the user's **local** timezone, not
  UTC. An 8pm Tuesday session in Melbourne is Tuesday's training — slicing on UTC
  would break streaks. Timestamps (`recorded_at` etc.) are ISO-8601 UTC.
- **Drill ids are permanent.** Rep logs reference them. Edit a drill's copy
  freely; never change or recycle its `id`. `slug` is the natural key for upserts.
- **Mobile first.** Interactive elements get `tap-target` (44px minimum). Assume
  one thumb and bright sunlight. Test at 390px wide.
- **Offline is the default, not a fallback.** Nothing may block on the network.
- **Australian English** in user-facing copy, and correct football terminology
  (drop punt, handball, mark, snap, spoil, lead — not soccer or gridiron terms).

## Testing

Pure logic in `src/lib/domain/` and `src/lib/util/` must have tests. Storage and
components are not unit tested yet — see `plans/ROADMAP.md`.

## Not yet built

Sessions exist in the model and the `Repo` interface but have no UI. See
`plans/ROADMAP.md` before starting anything substantial.
