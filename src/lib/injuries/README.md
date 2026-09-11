# Injury flags — forked out, not running

This directory is **dormant**. Nothing in `src/` imports it, no UI collects it,
and no injury data is stored on-device. It is kept whole so the feature can be
switched back on deliberately rather than rebuilt from scratch.

## Why it was removed

Injury flags and date of birth were the most sensitive data in the app. Storing
a body region and an injury status — even coarse, even device-local — is health
data, and health data is what drives the bulk of the privacy policy obligations
this app would otherwise have to meet. Removing collection removes the
obligation. That was the whole reason: cost of compliance, not a change of mind
about the feature's value.

The duty-of-care reasoning in `plans/player-profile.md` still stands and should
be re-read before re-enabling. In particular: **injury flags exclude, they do
not treat.** A flagged region removes contraindicated content and surfaces a
regression where one exists. The app must never imply it is rehabilitating
anything, must not ask for or store clinical detail, and must never present a
flag as resolved.

## What was removed from the live app

| Removed                                                  | Where it was                                            |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `InjuryFlag`, `InjuryStatus`, `INJURY_STATUSES`, labels  | `src/lib/types.ts` → `./types.ts` here                  |
| `PlayerProfile.injuries`                                 | `src/lib/types.ts`                                      |
| `ProfileInput.injuries`                                  | `src/lib/data/repo.ts`                                  |
| Injury contraindication in `isEligible`                  | `src/lib/domain/recommend.ts` → `./eligibility.ts` here |
| `{ kind: 'injury' }` as an `ExclusionReason`             | `src/lib/domain/recommend.ts`                           |
| Onboarding step 4 (wizard went from four steps to three) | `src/routes/onboarding/+page.svelte`                    |
| Injury add/remove editor                                 | `src/routes/profile/+page.svelte`                       |

Existing on-device data is purged by the **Dexie v4** upgrade in
`src/lib/data/db.ts`, which strips the `injuries` key from the stored profile
row. That migration must stay in place even if this feature returns — a v4 user
has already had the key removed, and re-adding it is a fresh write, not a
restore.

## What deliberately stayed behind

`BodyRegion` / `BODY_REGIONS` / `BODY_REGION_LABELS` are still in
`src/lib/types.ts`, and `Exercise.contraindicated_regions` still exists. Those
describe **reference content** — an exercise declaring which regions it is
unsuitable for — and say nothing about any particular player, so they carry no
privacy weight. They are simply not consulted by eligibility while this fork is
dormant.

## Re-enabling

1. Re-export `InjuryFlag` and friends from `./types.ts` (or fold them back into
   `src/lib/types.ts`).
2. Add `injuries: InjuryFlag[]` back to `PlayerProfile` and `ProfileInput`, and
   write it in `LocalRepo.saveProfile`. Bump `PLAYER_PROFILE_SCHEMA_VERSION`.
3. Call `injuryExclusion()` from `./eligibility.ts` inside `isEligible` in
   `src/lib/domain/recommend.ts`, and restore `{ kind: 'injury' }` to
   `ExclusionReason` plus its `describeExclusion` case.
4. Restore the onboarding step and the profile editor.
5. **Write the privacy policy first.** That is the cost this fork was created to
   defer, and it comes due the moment the first flag is stored again.
