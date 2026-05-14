# Mermaid Diagram Conventions

**User preference (strict):** Mermaid is the only diagram format used in this project. ASCII art, PlantUML, and image embeds are not used. Every diagram must render correctly on GitHub, VS Code Mermaid preview, and the Mermaid Live Editor (https://mermaid.live).

This file is mandatory reading before adding or editing any diagram.

---

## The 7 rules

### 1. Line breaks in labels: use `<br/>`, never `\n`

`\n` is rendered literally on GitHub and breaks older parsers. `<br/>` is universally supported.

```
GOOD: node["Line one<br/>Line two"]
BAD:  node["Line one\nLine two"]
```

### 2. ASCII only inside labels

No `·`, `→`, `—`, `⭐`, box-drawing characters, em-dashes, or other Unicode. They break parsers and look wrong in plain-text fallback. Use ASCII substitutes:

| Don't use | Use instead |
|-----------|-------------|
| `·` middle dot | `|` or `-` or just a space |
| `→` arrow | `-->` (in edge syntax) or `to` (in text) |
| `—` em-dash | `--` or `-` |
| `─────` box drawing | `----` |
| `⭐` emoji | `*` or `[BUY]` text marker |
| `✓ ✗` check marks | `OK` / `FAIL` |

### 3. Quote every label, always

Even simple labels. Mixed quoted/unquoted syntax causes confusing parser errors.

```
GOOD: A["Database"] --> B["API"]
BAD:  A[Database] --> B[API]
```

### 4. Node IDs: alphanumeric and underscore only

No dots, dashes, colons, or spaces in the **ID** (the bit before `[`). Labels are free-form, IDs are not.

```
GOOD: ftm_api["ftm-api · :8080"]
BAD:  ftm-api["ftm-api"]      ← dash in ID breaks
BAD:  ftm.api["ftm-api"]      ← dot in ID breaks
```

### 5. No `&` parallel-edge shorthand

`A & B --> C` is Mermaid v8.8+ only and renders inconsistently. Always write edges explicitly.

```
GOOD:
A --> C
B --> C

BAD:
A & B --> C
```

### 6. `stateDiagram-v2` transition labels: single line only

`<br/>` and `\n` do not render in `stateDiagram-v2` transition text. Keep transitions short and put detail in separate `note` blocks.

```
GOOD:
Improving --> Leading : "BUY signal"
note right of Leading
  RS-Ratio > 100<br/>RS-Mom > 100<br/>Outperforming SPY
end note

BAD:
Improving --> Leading : "BUY signal<br/>RS-Ratio crosses 100"
```

### 7. `erDiagram` attribute types must be valid SQL-ish keywords

Use: `int`, `bigint`, `varchar`, `date`, `timestamp`, `boolean`, `numeric`, `json`, `text`, `uuid`. Don't use custom types like `TIMESTAMPTZ` or `JSONB` directly — Mermaid's ER parser rejects them. Use `timestamp` and `json`; mention the actual PostgreSQL type in the spec body, not the diagram.

---

## Validation protocol

Before committing any diagram:

1. **Paste it into https://mermaid.live** and confirm it renders without errors.
2. If the live editor shows red error text, fix it before committing.
3. **Preview in VS Code** with the Mermaid extension (or Markdown Preview Enhanced) as a second check.

A diagram that "looks right in the source" but fails to render is worse than no diagram.

---

## Diagram type cheat sheet (tested, working syntax)

### Flowchart

```
flowchart TB
    a["Producer"] -->|"event"| b["Queue"]
    b --> c["Consumer"]
    subgraph svc1["Service 1"]
        c
    end
```

### Sequence diagram

```
sequenceDiagram
    participant A as "Service A"
    participant B as "Service B"
    A->>B: "request"
    B-->>A: "response"
    Note over A,B: "synchronous call"
```

### State diagram (v2)

```
stateDiagram-v2
    [*] --> StateA
    StateA --> StateB : "trigger"
    StateB --> [*]
    note right of StateA
      Multi-line note<br/>goes here
    end note
```

### ER diagram

```
erDiagram
    customer {
        int id PK
        varchar name
        timestamp created_at
    }
    order {
        int id PK
        int customer_id FK
        numeric total
    }
    customer ||--o{ order : "places"
```

---

## What to do when a diagram fails

1. Strip it down to a 2-node graph and confirm that renders
2. Add nodes back one at a time until it breaks
3. The last addition is the bug — usually a special char or unquoted label
4. Fix it; do not commit a broken diagram with a comment "fix later"

A broken diagram in a spec is spec drift — the source of truth is wrong.
