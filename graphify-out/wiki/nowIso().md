# nowIso()

> God node · 8 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\util\time.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/util/time.ts#L33)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as nowIso()
    participant P1 as .logReps()
    participant P2 as newId()
    participant P3 as .createDrill()
    participant P4 as .startSession()
    participant P5 as .enrol()
    participant P6 as freshMeta()
    participant P7 as localDate()
    participant P8 as addDays()
    participant P9 as save()
    participant P10 as .saveProfile()
    participant P11 as .completeSession()
    participant P12 as .deleteRepLog()
    participant P13 as .advanceWeek()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P6->>+ P1: calls
    P1-->>- P6: return
    P6->>+ P4: calls
    P4-->>- P6: return
    P6->>+ P5: calls
    P5-->>- P6: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P7->>+ P8: calls
    P8-->>- P7: return
    P7->>+ P4: calls
    P4-->>- P7: return
    P1->>+ P9: calls
    P9-->>- P1: return
    P0->>+ P4: calls
    P4-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P12: calls
    P12-->>- P0: return
    P0->>+ P13: calls
    P13-->>- P0: return
```

## Connections by Relation

### calls

- [[.logReps()]] `INFERRED`
- [[.startSession()]] `INFERRED`
- [[.enrol()]] `INFERRED`
- [[.saveProfile()]] `INFERRED`
- [[.completeSession()]] `INFERRED`
- [[.deleteRepLog()]] `INFERRED`
- [[.advanceWeek()]] `INFERRED`

### contains

- [[time.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
