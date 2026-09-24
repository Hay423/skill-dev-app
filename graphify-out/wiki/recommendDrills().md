# recommendDrills()

> God node · 5 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\domain\recommend.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/domain/recommend.ts#L262)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as recommendDrills()
    participant P1 as positionWeights()
    participant P2 as zeroSkills()
    participant P3 as zeroPhysical()
    participant P4 as normalise()
    participant P5 as priorityCategories()
    participant P6 as isEligible()
    participant P7 as ageRank()
    participant P8 as explain()
    participant P9 as order()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P1->>+ P3: calls
    P3-->>- P1: return
    P3->>+ P1: calls
    P1-->>- P3: return
    P1->>+ P4: calls
    P4-->>- P1: return
    P4->>+ P1: calls
    P1-->>- P4: return
    P1->>+ P5: calls
    P5-->>- P1: return
    P5->>+ P1: calls
    P1-->>- P5: return
    P0->>+ P6: calls
    P6-->>- P0: return
    P6->>+ P0: calls
    P0-->>- P6: return
    P6->>+ P7: calls
    P7-->>- P6: return
    P7->>+ P6: calls
    P6-->>- P7: return
    P0->>+ P8: calls
    P8-->>- P0: return
    P0->>+ P9: calls
    P9-->>- P0: return
```

## Connections by Relation

### calls

- [[positionWeights()]] `EXTRACTED`
- [[isEligible()]] `EXTRACTED`
- [[explain()]] `EXTRACTED`
- [[order()]] `INFERRED`

### contains

- [[recommend.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
