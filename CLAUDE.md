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
- **Skeleton** (`@skeletonlabs/skeleton` + `@skeletonlabs/skeleton-svelte`) for theming and
  component presets, layered on Tailwind. Theme is `mint` (green primary, closest built-in
  match to the sport), forced dark-only via `class="dark" data-theme="mint"` on `<html>`
  in `src/app.html`. Use Skeleton's color-pairing tokens (`surface-100-900`,
  `text-surface-600-400`, etc. — light shade first, dark shade second, resolved via CSS
  `light-dark()`) instead of raw `slate-*` Tailwind colors, and preset utility classes
  (`preset-filled-primary-500`, `preset-outlined-surface-200-800`, `preset-tonal-*`) instead
  of hand-assembled `bg-*`/`border-*`/`text-*` combinations for buttons and chips. Don't
  reintroduce the old `pitch-*` custom theme tokens — `primary-*` replaces them.
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

### Finishing a change

**Every change ends with `npm run build`.** Not as a final check that the code
compiles — `npm run check` already did that — but because the build output _is_
what the phone loads.

The app is served over Tailscale on this machine's MagicDNS name over HTTPS
(`tailscale serve status` will show it), which `tailscale serve` proxies to
`127.0.0.1:4173`. Port 4173 is `npm run preview`, and preview serves the
compiled output from `.svelte-kit/output` exactly as it found it — it does not
compile, watch or reload. So a change that has not been built is invisible there
no matter how correct it is, and the site keeps serving the previous build with
no sign that anything is out of date. That is a worse failure than a build
error, because it looks like the change did not work rather than like it was
never delivered.

**A build and a running preview server do not coexist.** Two things follow, both
learned the hard way:

- A build replaces the content-hashed assets underneath a running preview, and
  the server dies with an unhandled `ENOENT` the moment anything requests a hash
  that no longer exists. Preview reads from disk per request, so it does serve
  the new build — right until an old asset is asked for and it crashes. **Always
  restart preview after building.**
- A _failed_ build is worse than no build. It empties `.svelte-kit/output`
  before it fails, so a running preview dies and a fresh one refuses to start
  (`Server files not found`). The site is down until the build is fixed — it
  does not fall back to the last good one. (`build/` survives, because the
  adapter never ran, but that is not what preview reads.)

`npm run dev` on 5173 is the other server, with hot reload, and it reads source
directly. It is the right thing to use while working and it is _not_ what the
HTTPS site reads — the two are easy to confuse precisely because both are
"running the app".

So the full sequence at the end of a change:

```sh
npm run format    # then check, test, build — in that order
npm run check
npm test
npm run build     # the step that actually ships it
```

A `Stop` hook does all of this automatically — see `.claude/hooks/build.sh`. It
skips the build when nothing was edited, and restarts preview afterwards so the
build never leaves the server holding files that are no longer there. The hook
is wired up in `.claude/settings.local.json`, which is gitignored because the
port, the path and the Tailscale proxy belong to one machine; the script itself
is committed. Run `npm run build` by hand on a machine without the hook.

## Architecture

```
src/lib/types.ts          Domain model — the source of truth for shapes
src/lib/config.ts         Env-driven config: which backend, which credentials
src/lib/data/repo.ts      Repo interface: the storage seam
src/lib/data/local-repo.ts  Dexie implementation
src/lib/data/db.ts        Dexie schema + indexes
src/lib/data/index.ts     Picks the backend from config, exports `repo` + seeding
src/lib/data/user.ts      Who owns the rows being written (`currentUserId()`)
src/lib/data/seed/        Bundled drill library (reference data)
src/lib/domain/           Pure functions — stats, streaks. Fully unit tested.
src/lib/util/time.ts      Local-calendar date helpers
src/lib/actions/          Svelte actions — DOM behaviour (swipe gestures)
src/lib/components/       Shared UI
src/routes/               Pages
```

### Rules that matter

**Never import `dexie` or `db` outside `src/lib/data/`.** All reads and writes go
through the `Repo` interface. The whole point is that swapping in a
Supabase-backed repo later adds one case to `createRepo()` in
`src/lib/data/index.ts` and changes nothing above the data layer.

**Which backend runs is configuration, not code.** `PUBLIC_DATA_BACKEND` selects
it; `createRepo()` reads it from `src/lib/config.ts`. Never hardcode a backend
choice, a URL or a key at a call site. An unimplemented or misconfigured backend
throws at boot rather than falling back to local storage — a build that thinks
it is syncing and is not looks healthy right up until the data is gone.

**No secrets in this repo, and none in the bundle.** This is a static SPA with no
server: every `PUBLIC_*` variable is compiled into the JavaScript and is readable
by anyone who loads the page. A Supabase **anon key** belongs there (row-level
security on `user_id` is what protects the data). A **service-role key**,
database password, or any credential that bypasses RLS must never enter this
repo, its `.env`, or its build — it belongs to a server the app calls. `.env` is
gitignored; `.env.example` documents the variables with no real values.

**Every user-owned row gets an owner at write time.** Writes stamp
`currentUserId()` from `src/lib/data/user.ts`, never a literal and never null.
See Supabase-readiness below.

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
- `user_id` is **always populated, never null**. While anonymous it carries
  `LOCAL_USER_ID` (a fixed UUID in `src/lib/types.ts`); `setCurrentUserId()`
  points later writes at the real auth uid, and the sync layer rewrites the
  stored placeholder rows once at first sign-in.

`user_id` is non-null for a concrete reason, not tidiness: **IndexedDB rejects
`null` as a key**, so a nullable owner is unindexable — rows carrying it are
simply absent from the index. A real value makes "this user's rows" an indexed
lookup today, makes the Postgres column `uuid not null`, makes the RLS policy a
one-liner, and turns the sign-in backfill into a rewrite of one known value
instead of a full-table hunt for missing ones.

When adding a user-owned table: extend `Owned` and `SyncMeta`, index `_dirty`
**and `user_id`**, add the table to `OWNED_TABLES` in `db.ts` and to
`SyncableTable` in `types.ts`, stamp `currentUserId()` on insert, and add the
methods to `Repo` before implementing them.

Reference content (drills, positions, exercises, programs) is deliberately
**not** owned: it ships with the app, is identical for everyone, and is never
pushed. Giving it a `user_id` would imply a per-user copy that does not exist.

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
