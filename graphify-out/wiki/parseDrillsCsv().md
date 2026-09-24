# parseDrillsCsv()

> God node · 4 connections · [C:\Users\matth\Code\skill-dev-app\src\lib\domain\drill-import.ts](file:///C:/Users/matth/Code/skill-dev-app/src/lib/domain/drill-import.ts#L68)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as parseDrillsCsv()
    participant P1 as splitCsvLine()
    participant P2 as toDrillInput()
    participant P3 as splitList()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P0->>+ P2: calls
    P2-->>- P0: return
    P2->>+ P0: calls
    P0-->>- P2: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P3->>+ P0: calls
    P0-->>- P3: return
```

## Connections by Relation

### calls

- [[splitCsvLine()]] `EXTRACTED`
- [[toDrillInput()]] `EXTRACTED`
- [[splitList()]] `EXTRACTED`

### contains

- [[drill-import.ts]] `EXTRACTED`

---

_Part of the graphify knowledge wiki. See [[index]] to navigate._
