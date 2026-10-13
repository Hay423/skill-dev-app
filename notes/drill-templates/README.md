# Drill input templates

`drills-template.csv` and `drills-template.json` are blank-slate formats for drafting new
drills. Fill one in and upload it through the admin library at `/profile/drills`, which
parses both formats (`src/lib/domain/drill-import.ts`) and upserts by `slug`.

An uploaded drill is stored locally with a generated `id` and `source: 'custom'`, so it
only exists in the IndexedDB of the origin it was uploaded from — the HTTPS site is a
different origin and will not have it. To make a drill part of the bundled library for
every device, hand the file back to be merged into `src/lib/data/seed/drills.ts` with a
permanent `id`.

## Fields

| Field                | Required   | Notes                                                                                                                                                                                                                            |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`               | yes        | kebab-case, unique, permanent. Natural key used to upsert on reseed.                                                                                                                                                             |
| `name`               | yes        | Display name.                                                                                                                                                                                                                    |
| `category`           | yes        | One of: `kicking`, `goalkicking`, `handball`, `marking`, `ground_ball`, `tackling`, `evasion`, `ruckwork`                                                                                                                        |
| `summary`            | yes        | One line, shown in the drill list.                                                                                                                                                                                               |
| `setup`              | yes        | How to set it up.                                                                                                                                                                                                                |
| `coaching_points`    | yes        | List of cues. CSV: separate with `;`. JSON: array of strings.                                                                                                                                                                    |
| `equipment`          | yes        | Display list, e.g. "Football". CSV: separate with `;`. JSON: array.                                                                                                                                                              |
| `min_players`        | yes        | Integer, 1+.                                                                                                                                                                                                                     |
| `duration_minutes`   | yes        | Integer.                                                                                                                                                                                                                         |
| `difficulty`         | yes        | `1` (foundation), `2` (developing), or `3` (advanced).                                                                                                                                                                           |
| `tracks_reps`        | yes        | `true`/`false` — does the drill log attempt/success counts?                                                                                                                                                                      |
| `target_reps`        | if tracked | Suggested reps per set. Leave blank/`null` if `tracks_reps` is `false`.                                                                                                                                                          |
| `position_tags`      | optional   | Position-specific override. One or more of: `key_defender`, `general_defender`, `inside_midfielder`, `outside_midfielder`, `ruck`, `key_forward`, `medium_forward`, `small_forward`, `utility`. Leave empty for a general drill. |
| `equipment_required` | optional   | Structured equipment for eligibility filtering (distinct from the display `equipment` list). One or more of: `full_gym`, `home_weights`, `bands`, `oval`, `goals`, `park`, `backyard`, `wall`.                                   |

## CSV conventions

- Multi-value fields (`coaching_points`, `equipment`, `position_tags`, `equipment_required`)
  use `;` to separate items within a single cell, since `,` is already the column delimiter.
- Quote any field that itself contains a comma.
- Leave a cell empty for optional/not-applicable fields — don't write "null" or "N/A".

## Not included

`id` is deliberately left out. Ids are client-generated UUIDs and, once a drill ships, must
never change or be recycled (rep logs reference them by id). They get generated when a drill
is actually added to `src/lib/data/seed/drills.ts`.
