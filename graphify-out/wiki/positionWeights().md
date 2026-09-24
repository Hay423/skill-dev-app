# positionWeights()

> God node · 6 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\domain\recommend.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/domain/recommend.ts#L73)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as positionWeights()
    participant P1 as recommendDrills()
    participant P2 as isEligible()
    participant P3 as ageRank()
    participant P4 as explain()
    participant P5 as difficultyFit()
    participant P6 as order()
    participant P7 as ctx()
    participant P8 as zeroSkills()
    participant P9 as zeroPhysical()
    participant P10 as normalise()
    participant P11 as priorityCategories()
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
    P1->>+ P4: calls
    P4-->>- P1: return
    P4->>+ P1: calls
    P1-->>- P4: return
    P4->>+ P5: calls
    P5-->>- P4: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P6->>+ P1: calls
    P1-->>- P6: return
    P6->>+ P7: calls
    P7-->>- P6: return
    P0->>+ P8: calls
    P8-->>- P0: return
    P8->>+ P0: calls
    P0-->>- P8: return
    P0->>+ P9: calls
    P9-->>- P0: return
    P9->>+ P0: calls
    P0-->>- P9: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
```

## Connections by Relation

### calls

- [[recommendDrills()]] `EXTRACTED`
- [[zeroSkills()]] `EXTRACTED`
- [[zeroPhysical()]] `EXTRACTED`
- [[normalise()]] `EXTRACTED`
- [[priorityCategories()]] `EXTRACTED`

### contains

- [[recommend.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
