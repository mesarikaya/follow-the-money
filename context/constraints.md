---
last-updated: 2026-05-15
---

# Constraints — Follow the Money

Hard non-negotiables. These do not change without explicit discussion.

---

## Hard constraints

| Constraint | Detail |
|-----------|--------|
| **Local-only** | All data processing and storage on user's machine. No portfolio data leaves. |
| **No backend auth** | API bound to `127.0.0.1` only (D-004). Network exposure requires revisiting D-004 first. |
| **Free data sources only (MVP)** | Yahoo Finance REST API + FRED API. No paid APIs until after M4 validation. |
| **Single user** | No multi-tenant model, no user accounts, no shared state. |
| **OS: Windows 11** | Primary dev and runtime target. |
| **Java 21 (LTS)** | Required by Spring Boot 4 / Spring Framework 7. |
| **No external AI calls for financial data** | Spring AI for explanations only — never sends raw portfolio data to an AI provider without explicit user consent. |

---

## Stack (from decisions — do not re-decide here)

| Layer | Choice | Decision |
|-------|--------|----------|
| Primary store | PostgreSQL 16 | D-001 |
| Internal pipeline events | Spring ApplicationEventPublisher + @Async | D-002 |
| Flow data source | AUM delta estimation | D-003 |
| API security | None (loopback only) | D-004 |
| Signal caching | Caffeine (in-process) | D-005 |
| AI features | Spring AI (opt-in) | D-006 |
| Services | Single `ftm-app` monolith + `ftm-frontend` | D-007 |

---

## Services and ports

| Service | Port | Notes |
|---------|------|-------|
| `ftm-app` | 8080 | Spring Boot 4 monolith; REST API + scheduler + signals + alerts |
| `ftm-frontend` | 3000 | Next.js 15; calls `ftm-app` only |

## Local infrastructure (Docker Compose)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | `postgres:16` | 5432 | Primary store |

**Startup order:** `docker compose up -d` → `ftm-app` (Flyway runs) → `ftm-frontend`

---

## Performance SLAs

| Operation | Target |
|-----------|--------|
| Full signal recompute (19 categories) | < 30 seconds |
| Dashboard initial load (Caffeine warm) | < 1 second |
| Dashboard initial load (Caffeine cold) | < 3 seconds |
| Full ingestion pipeline | < 5 minutes after market close |
| Backtest — 5-year period | < 60 seconds |
| PostgreSQL DB size — 7 years × 19 categories daily | < 500 MB |

---

## Testing standards (non-negotiable)

| Level | Tool | Scope | Run command |
|-------|------|-------|-------------|
| Unit / slice | JUnit 5 + Mockito + Testcontainers | `ftm-app` all layers | `./mvnw test` |
| Frontend unit | Jest + Testing Library | `ftm-frontend` components | `pnpm test` |
| **E2E integration** | **Playwright** | **Browser → Next.js → mock backend** | **`pnpm test:e2e`** |

**E2E test requirement:** Every milestone merge to `develop` (and `main`) **must** have all Playwright E2E tests passing. The mock backend (`e2e/mock-backend.mjs`) runs on port 9999 and replaces Spring Boot during CI; `BACKEND_URL=http://127.0.0.1:9999` ensures both RSC server fetches and browser-side rewrites hit the mock. New features require new E2E tests before the PR is merged.

---

## Data quality

| Rule | Detail |
|------|--------|
| Minimum history for signals | 120 trading days (RS_120 lookback) |
| Stale data threshold | > 2 trading days without update = flagged in UI |
| Price column for calculations | Always `adj_close` — never raw `close` |
| Timezone | Store UTC; display in user's local timezone only at UI layer |
| Date domain | US market trading days only in `raw_prices` and `signals` |

---

## Upgrade paths (deferred, not forbidden)

| Future need | How architecture accommodates it |
|------------|----------------------------------|
| Paid flow data | Swap `IngestionService` flow fetch; FLOW signal formula unchanged |
| Multi-weight profiles | Add `profileId` column to composite calculation; default unchanged |
| Network exposure + auth | Add Spring Security; bind to `0.0.0.0`; must update D-004 |
| Intraday data | Add separate `raw_prices_intraday` table; daily tables unchanged |
| Spring AI model swap | Change `spring.ai.model` in `application.yml`; no code change |
| RabbitMQ or Kafka | Extract `ingestion`/`signals` packages; swap `ApplicationEventPublisher` for broker; event class names stay the same |
