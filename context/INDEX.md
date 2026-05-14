---
last-updated: 2026-05-15
---

# Follow the Money — AI Context

> "Follow the money." Capital does not disappear; it rotates. This app detects sector rotation early.

**How to hand this to any AI:** Share the `context/` folder. Start with this file.

---

## What this project is

A local-first investment dashboard that tracks capital flows across 19 investable categories (11 GICS sectors, 3 precious metals, 4 fixed income, cash) and signals when institutional money is rotating — before the mainstream narrative catches up.

**Stack:** Spring Boot 4 (Java 21) · PostgreSQL · Next.js (React/TypeScript)  
**Single monolith `ftm-app`** + `ftm-frontend`. No RabbitMQ. No Redis. No microservices (see DECISIONS.md).

---

## Current phase

| Area | Status |
|------|--------|
| Architecture reset (MVP) | ✅ Done 2026-05-15 |
| M1 — Data Foundation | ⬜ Not started |
| M2 — Basic Dashboard | ⬜ Not started |
| M3 — Full Signal Engine | ⬜ Not started |
| M4 — Rotation Detection | ⬜ Not started |
| M5 — Portfolio Intelligence | ⬜ Not started |
| M6 — Backtester | ⬜ Not started |

---

## Reading order

1. This file (done)
2. `DECISIONS.md` — all architectural decisions; check before writing code
3. `spec.md` — stack, data model, signal formulas, API contract
4. `roadmap.md` — milestones, epics, acceptance criteria
5. `vision.md` — why we're building this (rarely needs re-reading)
6. `constraints.md` — hard non-negotiables

---

## Spec health

| File | Last updated | Notes |
|------|-------------|-------|
| `DECISIONS.md` | 2026-05-15 | D-008 (macro regime), D-009 (composite weights) locked |
| `spec.md` | 2026-05-15 | Full rewrite: new stack, no RabbitMQ/Redis/microservices |
| `roadmap.md` | 2026-05-15 | Consolidated from 17 files |
| `constraints.md` | 2026-05-15 | Updated for new stack |
| `vision.md` | 2026-05-14 | Stable |

---

## Open RFC decisions needed

| RFC | Question | Needed before |
|-----|---------|--------------|
| RFC-0003 | Alert rule defaults (thresholds, preset profiles, severity colours) | M5 |

RFC-0001 and RFC-0002 resolved as D-008 and D-009 on 2026-05-15.

---

## Session protocol

**Start:** Read `context/INDEX.md`. Today's focus: [X].

**During:** Check `DECISIONS.md` before any architectural choice. Update `DECISIONS.md` first when a decision changes, then update `spec.md`.

**End:** Update `DECISIONS.md` + `spec.md` + `CHANGELOG.md`. Update "Last updated" dates in this file. Update milestone status above if anything completed.

---

## Development workflow (enforced)

Every epic follows this sequence — no exceptions:

```
feat/EP-XXX branch → tests pass → independent agent review → PR to develop → merge
```

When all epics for a milestone are in `develop` and verified: merge `develop` → `main`.

Full rules in `.ai/conventions.md` § Development workflow.

---

## Anti-divergence rules

1. `DECISIONS.md` is the canonical source for all decisions — no ADR/RFC files
2. When a decision changes: update `DECISIONS.md` → update affected sections in `spec.md`
3. Session-end updates: `DECISIONS.md` + `spec.md` + `CHANGELOG.md` — 3 files max
4. `roadmap.md` is updated only when scope changes (new epic, milestone status change)
