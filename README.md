# Follow the Money

Institutional sector rotation dashboard — local-only, single-user, daily ingestion.

Tracks 19 categories (equity sectors, fixed income, commodities, currencies) using free data from Yahoo Finance and FRED. Displays composite rotation signals, macro regime, portfolio alignment, and historical strategy backtests.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 25 | Required by Spring Boot 4 |
| Maven wrapper | included | `./mvnw` in `ftm-app/` |
| Docker Desktop | any | Runs PostgreSQL |
| Node.js | 20+ | For Next.js frontend |
| pnpm | 9+ | `npm install -g pnpm` |
| FRED API key | free | https://fred.stlouisfed.org/docs/api/api_key.html |

---

## Environment setup

Create `ftm-app/src/main/resources/application-local.yml` (gitignored):

```yaml
ftm:
  fred:
    api-key: YOUR_FRED_API_KEY_HERE
```

Or set the environment variable: `FRED_API_KEY=your_key`

---

## Running the full stack

### 1. Start PostgreSQL

```bash
docker compose up -d
```

PostgreSQL runs on port 5432. Flyway applies all 4 schema migrations automatically when `ftm-app` starts.

### 2. Start the backend

```bash
cd ftm-app
./mvnw spring-boot:run
```

Backend starts on `http://127.0.0.1:8080`. First run takes ~30s to apply Flyway migrations and seed 19 categories + 9 alert rules.

Verify:
```bash
curl http://127.0.0.1:8080/api/v1/categories
curl http://127.0.0.1:8080/api/v1/macro
curl http://127.0.0.1:8080/api/v1/rotation
```

### 3. Trigger initial data ingestion

```bash
curl -X POST http://127.0.0.1:8080/api/v1/ingest/trigger
```

Or click **Refresh Data** in the dashboard. Ingestion fetches 5+ years of daily prices for all 19 categories + 7 FRED macro series. After prices are ingested, signals (RS, RRG, Composite) are computed automatically. Allow 2–3 minutes on first run.

### 4. Start the frontend

```bash
cd ftm-frontend
pnpm install   # first time only
pnpm dev
```

Dashboard available at **http://localhost:3000**

---

## Current milestone: M6 — Complete

All 6 milestones are delivered.

| Milestone | Epics | Status |
|-----------|-------|--------|
| M1 — Data Foundation | EP-000, EP-001, EP-002 | ✓ Complete |
| M2 — Basic Dashboard | EP-003, EP-004 | ✓ Complete |
| M3 — Full Signal Engine | EP-005, EP-006, EP-007 | ✓ Complete |
| M4 — Rotation Detection | EP-008 | ✓ Complete |
| M5 — Portfolio Intelligence | EP-009, EP-010 | ✓ Complete |
| M6 — Backtester | EP-011 | ✓ Complete |

### What each milestone delivers

**M1 — Data Foundation**
- PostgreSQL schema with Flyway migrations
- Yahoo Finance ingestion (19 ETFs + SPY/AGG benchmarks, OHLCV + adj_close)
- FRED ingestion (VIX, T10Y2Y, T10YIE, DXY, FEDFUNDS, DGS2, DGS10)
- Idempotent `INSERT … ON CONFLICT DO NOTHING`
- `ingest_log` captures every run with status and row count

**M2 — Basic Dashboard**
- Spring Boot REST API (`/categories`, `/macro`, `/ingest/trigger`)
- Next.js 15 dashboard: sidebar, category table, macro panel, timeframe selector, refresh button
- Stale data banner

**M3 — Full Signal Engine**
- RS_20, RS_60, RS_120 (Relative Strength vs SPY benchmark)
- MOM (momentum: RS_60 delta over 10 days)
- RRG_RATIO, RRG_MOM, RRG_QUADRANT (Relative Rotation Graph signals)
- MACRO_REGIME classification (STAGFLATION / RISK_OFF / RISK_ON_DEFENSIVE / RISK_ON_GROWTH)
- MACRO_FIT (historical win-rate per category under current regime)
- COMPOSITE score (weighted: 35% RS_60 + 25% FLOW + 20% MOM + 10% MACRO_FIT + 10% RRG)
- RRG scatter chart with 42-day trails and hover tooltip

**M4 — Rotation Detection**
- `rotation_events` table populated after each signal run
- ENTERING_IMPROVING, ENTERING_LEADING, COMPOSITE_BREAKOUT events
- `/api/v1/rotation` — top-3 leaders, bottom-3 laggards, recent 90-day events
- Composite score heatmap (19 category cards, colour-coded)

**M5 — Portfolio Intelligence**
- `/api/v1/portfolio` (GET/PUT) — full-portfolio replace with Σ=100% validation
- Spearman rank alignment score: 0 (fully misaligned) → 1 (perfectly aligned)
- Composite-proportional optimal allocation + top-5 rebalance suggestions
- Alert system: rule engine fires on RRG transitions, composite breakouts, macro regime shifts
- `/api/v1/alerts` + acknowledge endpoint
- Live portfolio editor and alert center in dashboard

**M6 — Backtester**
- `/api/v1/backtest/run` — POST to simulate top-N equal-weight rotation strategy
- Configurable: start/end date, WEEKLY/MONTHLY rebalance, topN (1-19), composite threshold
- Outputs: total return%, annualized return%, max drawdown%, Sharpe ratio vs SPY buy-and-hold
- Results persisted to `backtest_results` table; retrievable by run ID
- Equity curve chart comparing strategy vs SPY

---

## Running tests

### Backend unit + integration tests

```bash
cd ftm-app
./mvnw test
```

Requires Docker (Testcontainers spins up PostgreSQL for integration tests). ~90 seconds. 135 tests.

### Frontend type check + build

```bash
cd ftm-frontend
pnpm next build
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/categories?timeframe=MONTH` | All 19 categories with latest prices and signals |
| `GET` | `/api/v1/macro` | Current macro regime + 7 FRED indicators |
| `GET` | `/api/v1/rrg` | RRG trail data for all categories (last 42 trading days) |
| `GET` | `/api/v1/rotation` | Top-3 leaders, bottom-3 laggards, recent rotation events |
| `GET` | `/api/v1/portfolio` | Current portfolio allocations with alignment score |
| `PUT` | `/api/v1/portfolio` | Save portfolio allocations (body: `[{categoryId, allocationPct}]`) |
| `GET` | `/api/v1/alerts` | Active and recent alerts (last 100) |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Acknowledge an active alert |
| `POST` | `/api/v1/backtest/run` | Run a backtest simulation |
| `GET` | `/api/v1/backtest/{runId}` | Retrieve backtest result by ID |
| `GET` | `/api/v1/backtest/recent` | Last 10 backtest runs |
| `POST` | `/api/v1/ingest/trigger` | Trigger price + macro ingestion |
| `GET` | `/api/v1/ingest/status/latest` | Latest ingestion run per source |
| `GET` | `/swagger-ui.html` | Interactive API docs |

All responses use camelCase JSON. Errors follow RFC 7807 `ProblemDetail`.

---

## Project structure

```
follow-the-money/
  ftm-app/              Spring Boot 4 monolith (Java 25)
    src/main/java/com/ftm/app/
      api/              REST controllers, DTOs, services, repositories
      ingestion/        YahooFinanceClient, FredClient, IngestionService
      signals/          RS, MOM, RRG, MacroRegime, Composite, RotationEventDetector
      portfolio/        AlignmentService, PortfolioService, PortfolioRepository
      alerts/           AlertRulesEngine, AlertRepository, AlertRulesRepository
      backtest/         BacktestEngine, BacktestRepository
      domain/           Domain records (Category, Alert, Signal, ...)
      config/           Caffeine cache (6 caches, 1h TTL), async executor
    src/main/resources/db/migration/
      V1__initial_schema.sql     All tables + indexes
      V2__seed_categories.sql    19 categories (ETF tickers, display order)
      V3__seed_alert_rules.sql   9 alert rules (Balanced profile defaults)
      V4__backtest_schema.sql    backtest_results table
  ftm-frontend/         Next.js 15 (TypeScript, Tailwind CSS, App Router)
    src/app/            Pages: /, /rrg, /flows, /macro, /portfolio, /alerts, /backtest
    src/components/     CategoryTable, MacroPanel, RRGSection, RotationHeatmap, RotationPanel, ...
    src/lib/api.ts      Typed fetch client (no React Query — pure RSC + client components)
  context/              Spec, decisions, roadmap (session context for AI)
  docker-compose.yml    PostgreSQL 16 only
  .env.example          FRED_API_KEY, SPRING_AI_ANTHROPIC_API_KEY
```

---

## Architecture decisions

- **Single monolith** (`ftm-app`) — no microservices, no message broker for MVP
- **Spring events** (`ApplicationEventPublisher` + `@Async`) for internal pipeline decoupling
- **Caffeine** in-process cache — no Redis; 6 named caches with 1h TTL; evicted on signal update
- **jOOQ** for all data access — no JPA/Hibernate
- **PostgreSQL 16** as the only infrastructure dependency
- All API requests bound to `127.0.0.1` — no external network exposure
