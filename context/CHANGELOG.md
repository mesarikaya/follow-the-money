# Spec Changelog — Follow the Money

This file records all meaningful spec changes. The AI appends to it at the end of each session. Code changes go in git history; this file tracks *why* specs changed and what was propagated.

Format per entry:
```
## YYYY-MM-DD
- [TYPE] file: description
  - ✅ Propagated to: file(s)
  - ⚠️ Still needs propagation: file(s)
```

Types: `NEW` `UPDATED` `ACCEPTED` `RESOLVED` `DEPRECATED`

---

## 2026-05-17 (session 11 — context sync to M8 reality)

- `UPDATED` INDEX.md: all 8 milestones marked complete; Java 21→25; RFC-0003 removed from open questions; spec health dates updated
  - ✅ INDEX.md

- `RESOLVED` RFC-0003 — Multi-timeframe independent alerts (resolved in EP-010 implementation)
  - 9 alert rules seeded (V3__seed_alert_rules.sql), Balanced profile defaults, z=1.5 threshold
  - Single-fire on MACRO_REGIME_SHIFT (no cascade); severity: INFO/WARNING/ACTION → blue/amber/red
  - ✅ DECISIONS.md — RFC-0003 moved from Open to Resolved

- `UPDATED` spec.md — multiple staleness fixes:
  - Java 21 → Java 25 (matches pom.xml and README)
  - 7 FRED series → 9 (added DEXUSEU, DCOILWTICO)
  - `aum_usd` → `assets_under_management_usd` in raw_prices DDL and data integrity rules
  - `categories` table: added `parent_id` column (V7 migration)
  - Repository layout updated: added backtest/, portfolio holdings, e2e/ Playwright tests
  - FLOW signals noted as deferred (AUM not available)
  - COMPOSITE label: removed "(pending RFC-0002 confirmation)"
  - Added `holdings` (V6) and `backtest_results` (V4) table DDL
  - ✅ spec.md

## 2026-05-17 (session 10 — retroactive milestone tags vM1–vM5)

- `NEW` Milestone tags vM1–vM5 created retroactively (vM6/vM7/vM8 already existed)
  - vM1 → `7210a25` (EP-001 cache eviction — data foundation complete)
  - vM2 → `89c0670` (EP-004 end-to-end — basic dashboard complete)
  - vM3 → `00e75fb` (EP-007+frontend — full signal engine complete)
  - vM4 → `0e542e1` (EP-008 — rotation detection complete)
  - vM5 → `8aaa36f` (EP-010 — portfolio intelligence complete)
  - All 8 milestone tags (vM1–vM8) now present in git

---

## 2026-05-17 (session 9 — Playwright E2E suite completed, milestone tags)

- `NEW` EP-004 T-004-6 complete: Playwright E2E tests (24/24 passing)
  - `dashboard.spec.ts`: 7 tests — category table, macro panel, type badges, refresh, null dashes, timeframe selector
  - `pages.spec.ts`: 17 tests — all 8 pages (macro, sub-sectors, factors, RRG, portfolio, alerts, backtest) + sidebar navigation
  - Fix: `getByRole("heading", { name: "...", level: 1 })` for all headings that conflict with sidebar nav spans
  - Fix: `{ exact: true }` on `getByText("VIX")` — regime description also contains "VIX low"
  - Fix: `.first()` on "Risk On — Growth" — appears in badge and body section
  - Fix: port 3001 for E2E Next.js server (isolated from dev server on 3000)
  - Fix: `run-next.cmd` reads `.next/dev/lock` PID and kills existing dev server before starting E2E server with `BACKEND_URL=http://127.0.0.1:9999`
  - Fix: portfolio/alerts/backtest tests check static-only elements (client-side fetch bypasses mock)
  - ✅ `mock-backend.mjs` — all API endpoints: rotation, RRG, sub-sectors (TECH+FTRS), portfolio, holdings, alerts, backtest
  - ✅ `playwright.config.ts` — baseURL + webServer url updated to port 3001
  - ✅ README — `pnpm test:e2e` instructions added to Running Tests section

- `NEW` Milestone tags created: `vM7` (Holdings Upload) and `vM8` (Advanced Signals + E2E)
  - vM7 → `68c7aae` (EP-012 complete, 141 backend tests)
  - vM8 → HEAD (EP-013/014/015 + E2E suite, 141 backend + 24 E2E tests)

---

## 2026-05-15 (session 8 — JPA removal, records, repository tests)

- `UPDATED` D-010 added: jOOQ as exclusive persistence layer; JPA removed
  - `spring-boot-starter-data-jpa` removed from `pom.xml`
  - All 5 JPA repository interfaces converted to concrete jOOQ `@Repository` classes
  - Composite JPA key classes deleted (`BenchmarkPriceId`, `MacroIndicatorId`, `RawPriceId`, `SignalId`)
  - ✅ DECISIONS.md — D-010 added with full rationale
  - ✅ spec.md — ORM/data-access row updated; domain/ comment updated

- `UPDATED` All domain objects converted to Java records (or functional classes)
  - Records: `Category`, `RawPrice`, `BenchmarkPrice`, `MacroIndicator`, `Signal`, `AlertRule`, `Portfolio`, `IngestLog`, `Alert`, `RotationEvent`
  - `IngestLog.finish()` returns new record instance (functional mutation pattern)
  - Bean validation annotations retained on record components where applicable

- `UPDATED` Repository naming: "Jdbc" suffix removed from all repository class names
  - `BenchmarkPriceJdbcRepository` → `BenchmarkPriceRepository`
  - `RawPriceJdbcRepository` → `RawPriceRepository`
  - `MacroIndicatorJdbcRepository` → `MacroIndicatorRepository` (ingestion package)

- `NEW` HikariCP configured explicitly in `application.yml` (pool-name, size 10, min-idle 2, timeouts)

- `NEW` Integration tests for all 6 repositories
  - `BenchmarkPriceRepositoryIT`, `RawPriceRepositoryIT`, `MacroIndicatorRepositoryIT` (ingestion)
  - `IngestLogRepositoryIT`, `CategoryRepositoryIT`, `MacroIndicatorRepositoryIT` (api)
  - All use `@SpringBootTest(NONE)` + `@ActiveProfiles("test")` + `@Transactional`

---

## 2026-05-15 (session 7 — development workflow rules added)

- `NEW` Development workflow convention: branch per epic → tests → independent agent review → PR to develop → milestone gate → merge to main
  - ✅ .ai/conventions.md — full workflow section: branch strategy, epic lifecycle, pre-PR checklist, agent review prompt template, PR format, develop→main gate
  - ✅ INDEX.md — workflow summary box added
  - ✅ CHANGELOG.md commit type table extended

---

## 2026-05-15 (session 6 — EP-000 project scaffolding added)

- `NEW` EP-000 — Project Scaffolding epic added to M1
  - Covers: `docker-compose.yml`, `pom.xml` (all deps), `application.yml`, `application-test.yml`, `FtmApplication.java`, CORS + async config, Testcontainers smoke test, Next.js 15 scaffold, Jest setup, `.env.example`
  - ✅ roadmap.md — EP-000 added before EP-001; M1 acceptance criteria updated; dependency map updated; EP-001 T-001-1 skeleton task removed (now in EP-000), task numbers renumbered T-001-1 through T-001-5

---

## 2026-05-15 (session 5 — RFC-0001 and RFC-0002 resolved)

- `ACCEPTED` D-008 — Macro regime classification (rule-based, Option A)
  - 4 regimes: RISK_ON_GROWTH (default), RISK_ON_DEFENSIVE, RISK_OFF_FLIGHT, STAGFLATION
  - Priority-ordered evaluation; immediate propagation; no TRANSITION regime
  - ✅ DECISIONS.md — added as D-008
  - ✅ roadmap.md — M3 blocker removed; EP-007 prerequisite note updated
  - ✅ INDEX.md — RFC-0001 removed from open questions table

- `ACCEPTED` D-009 — Composite signal weights (35/25/20/10/10, uniform across all 19 categories)
  - ✅ DECISIONS.md — added as D-009 with full weight rationale
  - ✅ roadmap.md — M3 blocker removed
  - ✅ INDEX.md — RFC-0002 removed from open questions table

- M3 is now unblocked (was waiting on RFC-0001 + RFC-0002)

---

## 2026-05-15 (session 4 — MVP architecture reset + spec consolidation)

- `UPDATED` Stack simplified: RabbitMQ → Spring ApplicationEventPublisher + @Async (D-002)
  - ✅ DECISIONS.md — D-002 added (Spring events), original RabbitMQ decision superseded
  - ✅ spec.md — pipeline section rewritten; no RabbitMQ, no Spring AMQP dependency
  - ✅ constraints.md — stack table updated; Docker Compose now PostgreSQL-only

- `UPDATED` Cache simplified: Redis → Caffeine in-process cache (D-005)
  - ✅ DECISIONS.md — D-005 added (Caffeine), original Redis decision superseded
  - ✅ spec.md — caching strategy section rewritten; @Cacheable with Caffeine
  - ✅ constraints.md — stack table updated; Redis removed from Docker Compose

- `UPDATED` Services simplified: 4 microservices → 1 modular monolith `ftm-app` (D-007)
  - ✅ DECISIONS.md — D-007 added (monolith), original microservices decision superseded
  - ✅ spec.md — repository layout rewritten; single ftm-app service
  - ✅ constraints.md — services/ports table simplified; only ftm-app + ftm-frontend

- `UPDATED` Spec restructure: 30+ files → 6 files (anti-divergence)
  - ✅ DECISIONS.md — replaces decisions/adr/ (7 files) + decisions/rfc/ (3 files)
  - ✅ spec.md — replaces spec/architecture.md + spec/system-design.md + spec/data-model.md + spec/api-design.md
  - ✅ roadmap.md — replaces roadmap/roadmap.md + roadmap/milestones/ (6 files) + roadmap/epics/ (11 files)
  - ✅ vision.md, constraints.md — moved to context/ root
  - ✅ INDEX.md — slimmed down; 6-file reading order; anti-divergence rules added
  - ✅ .ai/conventions.md — rewritten to reference new file structure

- ✅ Old directories deleted: decisions/adr/, decisions/rfc/, spec/ (old), roadmap/milestones/, roadmap/epics/
- ⚠️ RFC-0001, RFC-0002, RFC-0003 still open — needed before M3 and M5

---

## 2026-05-14 (session 2 — stack migration + restructure)

- `UPDATED` All context artifacts consolidated under `context/` folder
  - ✅ spec/, decisions/, roadmap/, plans/, diagrams/, .ai/ all moved under context/
  - ✅ CLAUDE.md at root is now a one-liner pointing to context/INDEX.md
  - ✅ context/INDEX.md is the full AI context hub

- `UPDATED` Tech stack migrated from Python → Spring Boot 4 / Java 21
  - ✅ spec/architecture.md — full rewrite: Spring MVC, Spring AMQP, Spring AI, Redis caching, event-driven pipeline
  - ✅ spec/constraints.md — tech choices table updated, docker-compose infrastructure added
  - ✅ spec/system-design.md — system boundaries diagram and subsystem descriptions updated for Spring stack
  - ✅ spec/data-model.md — all DDL rewritten as PostgreSQL (NUMERIC, BIGSERIAL, JSONB, TIMESTAMPTZ, gen_random_uuid, CHECK constraints, indexes)

- `DEPRECATED` ADR-0001 (DuckDB) — removed; superseded by new ADR-0001 (PostgreSQL)
- `DEPRECATED` ADR-0002 (APScheduler) — removed; superseded by new ADR-0002 (RabbitMQ)
- `ACCEPTED` ADR-0001 — PostgreSQL as primary store
  - ✅ Propagated to spec/architecture.md, spec/constraints.md, spec/data-model.md
- `ACCEPTED` ADR-0002 — RabbitMQ for async ingestion pipeline
  - ✅ Propagated to spec/architecture.md, spec/constraints.md, spec/system-design.md
- `ACCEPTED` ADR-0005 — Redis for signal caching
  - ✅ Propagated to spec/architecture.md, spec/constraints.md
- `ACCEPTED` ADR-0006 — Spring AI for natural-language explanations
  - ✅ Propagated to spec/architecture.md, spec/constraints.md
- ⚠️ RFC-0001 and RFC-0002 still pending user decision before M3 work begins
- ⚠️ Epics EP-001 through EP-011 reference implementation details — need review for Java/Spring specifics (language references, not goals)

## 2026-05-14 (session 3 — microservices separation)

- `ACCEPTED` ADR-0007 — four independent services (ftm-ingestion · ftm-signals · ftm-api · ftm-frontend)
  - ✅ spec/architecture.md — service map diagram redrawn, repo layout updated to four service folders
  - ✅ spec/system-design.md — system boundaries diagram updated with service names
  - ✅ spec/constraints.md — services/ports table added, startup order documented
  - ✅ context/INDEX.md — ADR-0007 added to decisions table, ADR count updated to 7

## 2026-05-14 (session 1 — initial scaffold)

- `NEW` Full spec scaffold created: spec/, decisions/, roadmap/, .ai/
  - Vision, system design, architecture, data model, API design, constraints
  - 4 ADRs (initial Python stack): DuckDB, APScheduler, AUM flow estimation, no auth
  - 2 RFCs opened: macro regime classification, composite signal weights
  - 6 milestones defined (M1–M6), 11 epics defined (EP-001–EP-011)
