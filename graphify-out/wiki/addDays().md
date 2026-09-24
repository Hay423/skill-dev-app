# addDays()

> God node · 5 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/util/time.ts#L18)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as addDays()
    participant P1 as localDate()
    participant P2 as .logReps()
    participant P3 as nowIso()
    participant P4 as newId()
    participant P5 as freshMeta()
    participant P6 as save()
    participant P7 as .startSession()
    participant P8 as currentStreak()
    participant P9 as daysBetween()
    participant P10 as accuracyTrend()
    participant P11 as dailySeries()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P3: calls
    P3-->>- P7: return
    P7->>+ P4: calls
    P4-->>- P7: return
    P7->>+ P5: calls
    P5-->>- P7: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P0->>+ P8: calls
    P8-->>- P0: return
    P8->>+ P0: calls
    P0-->>- P8: return
    P8->>+ P9: calls
    P9-->>- P8: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
```

## Connections by Relation

### calls

- [[localDate()]] `EXTRACTED`
- [[currentStreak()]] `INFERRED`
- [[accuracyTrend()]] `INFERRED`
- [[dailySeries()]] `INFERRED`

### contains

- [[time.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
