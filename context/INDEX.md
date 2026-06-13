---
last-updated: 2026-06-13 (session 27)
---

# Follow the Money — AI Context

> "Follow the money." Capital does not disappear; it rotates. This app detects sector rotation early.

**How to hand this to any AI:** Share the `context/` folder. Start with this file.

---

## What this project is

A local-first investment dashboard that tracks capital flows across 19 investable categories (11 GICS sectors, 3 precious metals, 4 fixed income, cash) and signals when institutional money is rotating — before the mainstream narrative catches up.

**Stack:** Spring Boot 4 (Java 25) · PostgreSQL · Next.js (React/TypeScript)  
**Single monolith `ftm-app`** + `ftm-frontend`. No RabbitMQ. No Redis. No microservices (see DECISIONS.md).

---

## Current phase

**All 12 milestones delivered.** 534 backend tests + 74 E2E tests pass.

| Area | Status |
|------|--------|
| M1 — Data Foundation | ✅ Complete (EP-000, 001, 002) |
| M2 — Basic Dashboard | ✅ Complete (EP-003, 004) |
| M3 — Full Signal Engine | ✅ Complete (EP-005, 006, 007) |
| M4 — Rotation Detection | ✅ Complete (EP-008) |
| M5 — Portfolio Intelligence | ✅ Complete (EP-009, 010) |
| M6 — Backtester | ✅ Complete (EP-011) |
| M7 — Investment Holdings Upload | ✅ Complete (EP-012) |
| M8 — Advanced Signals + E2E | ✅ Complete (EP-013, 014, 015) |
| M9 — UI Redesign | ✅ Complete (EP-016) |
| M10 — Structural Sub-Sectors | ✅ Complete (EP-017) |
| M11 — Conventions | ✅ Complete (EP-018) |
| M12 — CI/CD Gate | ✅ Complete (EP-019) |

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
| `DECISIONS.md` | 2026-05-17 | RFC-0003 resolved; all decisions locked; no open questions |
| `spec.md` | 2026-05-17 | Java 25, 9 FRED series, parent_id hierarchy, V9 sub-sectors (~70 ETFs), /sub-sectors API |
| `roadmap.md` | 2026-05-17 | M1–M12 all complete; all ACs ticked |
| `constraints.md` | 2026-05-15 | Stable |
| `vision.md` | 2026-05-14 | Stable |

---

## Open RFC decisions needed

All RFCs resolved. No open questions remain.

- RFC-0001 → D-008 (macro regime classification, 2026-05-15)
- RFC-0002 → D-009 (composite signal weights, 2026-05-15)
- RFC-0003 → resolved in EP-010: 9 alert rules, Balanced profile defaults, z=1.5 threshold (2026-05-17)

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
