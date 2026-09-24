# Graph Report - C:\Users\matth\Code\skill-dev-app (2026-09-16)

## Corpus Check

- 40 files · ~24,903 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 239 nodes · 250 edges · 39 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)

1. `LocalRepo` - 27 edges
2. `nowIso()` - 8 edges
3. `positionWeights()` - 6 edges
4. `recommendDrills()` - 5 edges
5. `addDays()` - 5 edges
6. `newId()` - 5 edges
7. `freshMeta()` - 4 edges
8. `parseDrillsCsv()` - 4 edges
9. `localDate()` - 4 edges
10. `seedReferenceData()` - 3 edges

## Toxic Hotspots (high risk + high activity)

1. `LocalRepo` - Risk Score: 80% (CLASS)

## Surprising Connections (you probably didn't know these)

- `order()` --calls--> `recommendDrills()` [INFERRED]
  C:\Users\matth\Code\skill-dev-app\src\lib\domain\recommend.test.ts → C:\Users\matth\Code\skill-dev-app\src\lib\domain\recommend.ts
- `dailySeries()` --calls--> `addDays()` [INFERRED]
  C:\Users\matth\Code\skill-dev-app\src\lib\domain\stats.ts → C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts
- `currentStreak()` --calls--> `daysBetween()` [INFERRED]
  C:\Users\matth\Code\skill-dev-app\src\lib\domain\stats.ts → C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts
- `currentStreak()` --calls--> `addDays()` [INFERRED]
  C:\Users\matth\Code\skill-dev-app\src\lib\domain\stats.ts → C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts
- `accuracyTrend()` --calls--> `addDays()` [INFERRED]
  C:\Users\matth\Code\skill-dev-app\src\lib\domain\stats.ts → C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts

## Communities

### Community 0 - "Community 0"

Cohesion: 0.08
Nodes (25): blended, ctx(), defender, drills, empty, EXPECTED_TOP, experienced, forward (+17 more)

### Community 1 - "Community 1"

Cohesion: 0.11
Nodes (3): LocalRepo, slugify(), first

### Community 2 - "Community 2"

Cohesion: 0.09
Nodes (21): AGE_GROUP_LABELS, AGE_GROUPS, BODY_REGION_LABELS, BODY_REGIONS, EQUIPMENT_ACCESS, EQUIPMENT_ACCESS_LABELS, EXPERIENCE_LEVEL_LABELS, EXPERIENCE_LEVELS (+13 more)

### Community 3 - "Community 3"

Cohesion: 0.15
Nodes (17): ageRank(), describeExclusion(), difficultyFit(), explain(), formatList(), isEligible(), normalise(), positionWeights() (+9 more)

### Community 4 - "Community 4"

Cohesion: 0.16
Nodes (10): freshMeta(), accuracyTrend(), currentStreak(), dailySeries(), totals(), addDays(), daysBetween(), localDate() (+2 more)

### Community 5 - "Community 5"

Cohesion: 0.11
Nodes (12): age_group, available_days, equipment_access, error, experience, finish(), primary_position, saving (+4 more)

### Community 6 - "Community 6"

Cohesion: 0.12
Nodes (12): drill, profile, repLog, session, { SkillDevDb }, v1, V1Db, v2 (+4 more)

### Community 7 - "Community 7"

Cohesion: 0.18
Nodes (5): accuracy, match, save(), slug, target

### Community 8 - "Community 8"

Cohesion: 0.25
Nodes (7): CACHE, cached, PRECACHE, response, shell, sw, url

### Community 9 - "Community 9"

Cohesion: 0.43
Nodes (5): parseDrillsCsv(), REQUIRED_CSV_COLUMNS, splitCsvLine(), splitList(), toDrillInput()

### Community 10 - "Community 10"

Cohesion: 0.33
Nodes (4): logs, result, seq, series

### Community 11 - "Community 11"

Cohesion: 0.6
Nodes (4): repo, seedDrills(), seedPositions(), seedReferenceData()

### Community 12 - "Community 12"

Cohesion: 0.4
Nodes (4): csv, { drills, errors }, { errors }, json

### Community 13 - "Community 13"

Cohesion: 0.5
Nodes (2): db, SkillDevDb

### Community 14 - "Community 14"

Cohesion: 0.5
Nodes (3): byCategory, streak, todayTotals

### Community 15 - "Community 15"

Cohesion: 0.67
Nodes (2): { db }, { seedPositions }

### Community 16 - "Community 16"

_Unable to determine domain due to missing code entities._
Cohesion: 0.67
Nodes (0):

### Community 17 - "Community 17"

Cohesion: 0.67
Nodes (2): INJURY_STATUS_LABELS, INJURY_STATUSES

### Community 18 - "Community 18"

Cohesion: 0.67
Nodes (2): prerender, ssr

### Community 19 - "Community 19"

Cohesion: 0.67
Nodes (2): available, DIFFICULTY_LABELS

### Community 20 - "Community 20"

_Handles application settings, deployment parameters, and environment-specific configurations._
Cohesion: 1.0
Nodes (1): config

### Community 21 - "Community 21"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 22 - "Community 22"

Cohesion: 1.0
Nodes (1): SEED_DRILLS

### Community 23 - "Community 23"

Cohesion: 1.0
Nodes (1): SEED_POSITIONS

### Community 24 - "Community 24"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 25 - "Community 25"

Cohesion: 1.0
Nodes (1): evening

### Community 26 - "Community 26"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 27 - "Community 27"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 28 - "Community 28"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 29 - "Community 29"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 30 - "Community 30"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 31 - "Community 31"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 32 - "Community 32"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 33 - "Community 33"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 34 - "Community 34"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 35 - "Community 35"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 36 - "Community 36"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 37 - "Community 37"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

### Community 38 - "Community 38"

_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0):

## Knowledge Gaps

- **105 isolated node(s):** `config`, `sw`, `CACHE`, `PRECACHE`, `url` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 20`** (2 nodes): `svelte.config.js`, `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `RecommendedDrills.svelte`, `text`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `drills.ts`, `SEED_DRILLS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `positions.ts`, `SEED_POSITIONS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `eligibility.test.ts`, `flag()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `time.test.ts`, `evening`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `+layout.svelte`, `children()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `app.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `BottomNav.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `DrillForm.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `StatCard.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `repo.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `+page.svelte`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
