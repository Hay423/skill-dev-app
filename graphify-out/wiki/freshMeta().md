# freshMeta()

> God node · 4 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\data\local-repo.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/data/local-repo.ts#L30)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as freshMeta()
    participant P1 as .logReps()
    participant P2 as nowIso()
    participant P3 as .startSession()
    participant P4 as .enrol()
    participant P5 as .saveProfile()
    participant P6 as .completeSession()
    participant P7 as .deleteRepLog()
    participant P8 as .advanceWeek()
    participant P9 as newId()
    participant P10 as .createDrill()
    participant P11 as localDate()
    participant P12 as save()
    P0->>+ P1: calls
    P1-->>- P0: return
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
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P2->>+ P8: calls
    P8-->>- P2: return
    P1->>+ P9: calls
    P9-->>- P1: return
    P9->>+ P1: calls
    P1-->>- P9: return
    P9->>+ P10: calls
    P10-->>- P9: return
    P9->>+ P3: calls
    P3-->>- P9: return
    P9->>+ P4: calls
    P4-->>- P9: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P11: calls
    P11-->>- P1: return
    P1->>+ P12: calls
    P12-->>- P1: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P0->>+ P4: calls
    P4-->>- P0: return
```

## Connections by Relation

### calls
- [[.logReps()]] `EXTRACTED`
- [[.startSession()]] `EXTRACTED`
- [[.enrol()]] `EXTRACTED`

### contains
- [[local-repo.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*