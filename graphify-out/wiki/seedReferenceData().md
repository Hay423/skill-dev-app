# seedReferenceData()

> God node · 3 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\data\index.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/data/index.ts#L52)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as seedReferenceData()
    participant P1 as seedDrills()
    participant P2 as seedPositions()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P0->>+ P2: calls
    P2-->>- P0: return
    P2->>+ P0: calls
    P0-->>- P2: return
```

## Connections by Relation

### calls

- [[seedDrills()]] `EXTRACTED`
- [[seedPositions()]] `EXTRACTED`

### contains

- [[index.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
