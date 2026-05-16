# Follow the Money

Institutional sector rotation dashboard — local-only, single-user, daily ingestion.

Tracks 19 categories (equity sectors, fixed income, commodities, currencies) using free data from Yahoo Finance and FRED. Displays price trends, macro indicators, and (in later milestones) rotation signals.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 21 LTS | Required by Spring Boot 4 |
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

Or set the env var: `FRED_API_KEY=your_key`

---

## Running the full stack

### 1. Start PostgreSQL

```bash
docker compose up -d
```

PostgreSQL runs on port 5432. Schema migrations run automatically when `ftm-app` starts (Flyway).

### 2. Start the backend

```bash
cd ftm-app
./mvnw spring-boot:run
```

Backend starts on `http://127.0.0.1:8080`. First run takes ~30s to apply all Flyway migrations.

Verify:
```bash
curl http://127.0.0.1:8080/categories
curl http://127.0.0.1:8080/macro
```

### 3. Trigger initial data ingestion

```bash
curl -X POST http://127.0.0.1:8080/ingest/trigger
```

Or click **Refresh Data** in the dashboard. Ingestion fetches ~2 years of daily prices for all 19 categories + 7 FRED macro series. Takes 1–2 minutes.

### 4. Start the frontend

```bash
cd ftm-frontend
pnpm install   # first time only
pnpm dev
```

Dashboard available at **http://localhost:3000**

---

## What M2 delivers

- **Category list** — 19 categories with ETF ticker, type badge, latest close price, and price date
- **Macro panel** — 7 FRED indicators (VIX, 10Y yield, 2Y yield, spread, USD index, breakeven inflation, fed funds rate) + regime badge
- **Timeframe selector** — DAY / WEEK / MONTH / QUARTER / YEAR (re-fetches on selection)
- **Refresh button** — triggers ingestion and shows confirmation
- **Stale data banner** — warns when prices are > 2 trading days old or missing

Signal fields (composite score, RS60, flow, RRG) show "—" until M3.

---

## Running tests

### Backend unit + integration tests

```bash
cd ftm-app
./mvnw test
```

Requires Docker (Testcontainers spins up PostgreSQL for integration tests). ~2 minutes.

### Frontend unit tests (Jest)

```bash
cd ftm-frontend
pnpm test
```

No backend or Docker required. ~10 seconds.

### End-to-end tests (Playwright)

```bash
cd ftm-frontend
pnpm test:e2e
```

Playwright automatically starts:
1. A mock backend on port 9999 (no real Spring Boot needed)
2. Next.js dev server on port 3000 pointed at the mock

Tests cover: dashboard load, sidebar, category table, macro panel, timeframe selector, refresh button.

To run with the interactive UI:
```bash
pnpm test:e2e:ui
```

---

## Project structure

```
follow-the-money/
  ftm-app/          Spring Boot 4 monolith (Java 21)
    src/main/
      java/com/ftm/app/
        api/          REST controllers, DTOs, services, repositories
        ingestion/    Data ingestion (Yahoo Finance + FRED)
        domain/       Domain types (Category, CategoryId, ...)
        config/       Caffeine cache, async executor
      resources/
        db/migration/ Flyway SQL migrations
  ftm-frontend/     Next.js 16 (TypeScript, Tailwind, App Router)
    src/
      app/            Pages (RSC by default)
      components/     Sidebar, CategoryTable, MacroPanel, ...
      lib/api.ts      Typed fetch functions
    e2e/              Playwright E2E tests + mock backend
  context/           Project spec, decisions, roadmap
  docker-compose.yml PostgreSQL
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/categories?timeframe=MONTH` | All 19 categories with latest prices |
| `GET` | `/macro` | Current macro regime + 7 FRED indicators |
| `POST` | `/ingest/trigger` | Start price + macro ingestion |
| `GET` | `/ingest/status/{runId}` | Check ingestion run status |
| `GET` | `/ingest/status/latest` | Latest run per source |
| `GET` | `/swagger-ui.html` | Interactive API docs |

All responses use camelCase JSON.

---

## Current milestone: M2 — Basic Dashboard

- [x] PostgreSQL schema (19 categories seeded)
- [x] Yahoo Finance + FRED ingestion
- [x] REST API (`/categories`, `/macro`, `/ingest/trigger`)
- [x] Next.js dashboard (sidebar, category table, macro panel)
- [x] E2E tests (Playwright + mock backend)
- [ ] Merge to `main` as `vM2`

Next: **M3** — RS, MOM, FLOW signal computation; RRG chart
