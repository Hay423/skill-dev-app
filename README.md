# Skill Dev — AFL

A mobile-first, offline-capable web app for developing Australian rules football
skills. Browse a drill library, tally your reps on the ground, and watch accuracy
and streaks build over time.

Built for an individual player training themselves, not for a coach running a
squad.

## Requirements

- Node.js 20 or newer (with npm)

## Getting started

```sh
npm install
npm run dev
```

Then open the printed URL. To try it as it is actually used, open DevTools,
switch to a phone viewport (390px wide), and throttle to offline after the first
load — everything should keep working.

## Scripts

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Dev server with HMR                |
| `npm run build`   | Production build into `build/`     |
| `npm run preview` | Serve the production build locally |
| `npm run check`   | Type-check Svelte and TypeScript   |
| `npm test`        | Run the unit tests                 |
| `npm run format`  | Format with Prettier               |

## How it stores data

Everything lives in IndexedDB on the device via Dexie. There is no backend, no
account, and no network dependency — the app works on a suburban oval with no
signal.

The data model is nonetheless shaped for a future Supabase sync: client-generated
UUIDs, `snake_case` fields that map straight onto Postgres columns, and per-row
sync bookkeeping (`_dirty`, `_deleted`, `synced_at`). All storage access goes
through the `Repo` interface in `src/lib/data/repo.ts`, so adding sync means
swapping one implementation rather than rewriting the app.

Because data is device-local, clearing browser storage deletes your history.
Export/import is on the roadmap.

## Deploying

`npm run build` produces a static SPA in `build/`, deployable to Netlify, Vercel,
Cloudflare Pages, GitHub Pages, or any static host. Configure the host to serve
`index.html` for unmatched routes.

## Project layout

See [CLAUDE.md](CLAUDE.md) for architecture and conventions, and
[plans/ROADMAP.md](plans/ROADMAP.md) for what's next.
