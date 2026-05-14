---
last-updated: 2026-05-15
---

# Roadmap — Follow the Money

All milestones and epics in one file. Update this file when scope changes.

<!-- affects: DECISIONS, spec -->

---

## Phase overview

```
Phase 1 — Foundation (M1 + M2)
  M1: Data pipeline live, 19 categories in PostgreSQL, prices flowing daily
  M2: ftm-app running, basic dashboard showing category list + macro panel

Phase 2 — Signals (M3 + M4)
  M3: RS, MOM, FLOW signals; RRG chart live; macro regime classification
  M4: Quadrant transitions; flow surge alerts; rotation heatmap

Phase 3 — Intelligence (M5 + M6)
  M5: Portfolio alignment scoring, rebalance suggestions, alert engine
  M6: Backtester (historical validation, Sharpe vs SPY, weight optimization)
```

**Current status:** Phase 1 — nothing built yet. Start with M1.

---

## Milestone status

| ID | Name | Phase | Status |
|----|------|-------|--------|
| M1 | Data Foundation | 1 | Not started |
| M2 | Basic Dashboard | 1 | Not started |
| M3 | Full Signal Engine | 2 | Not started |
| M4 | Rotation Detection | 2 | Not started |
| M5 | Portfolio Intelligence | 3 | Not started |
| M6 | Backtester | 3 | Not started |

---

## M1 — Data Foundation

**Epics:** EP-000, EP-001, EP-002  
**Blocked by:** nothing — this is the start

**Goal:** Raw data for all 19 categories flowing into PostgreSQL daily without manual intervention.

**Acceptance criteria:**
- [ ] `docker compose up -d` brings PostgreSQL up cleanly (EP-000)
- [ ] `mvn test -pl ftm-app` passes context load test with Testcontainers (EP-000)
- [ ] `pnpm --filter ftm-frontend test` passes smoke test (EP-000)
- [ ] PostgreSQL schema applies from scratch via Flyway on first `ftm-app` startup
- [ ] All 19 category ETFs have ≥ 5 years of historical OHLCV + adj_close in `raw_prices`
- [ ] Both benchmarks (SPY, AGG) loaded in `benchmark_prices`
- [ ] All 7 FRED macro series have ≥ 5 years of history in `macro_indicators`
- [ ] Ingestion runs and completes without error for the current trading day
- [ ] Ingestion is idempotent (running twice produces no duplicates)
- [ ] `ingest_log` captures each run with status and row count
- [ ] Stale data (>2 trading days) detectable via `ingest_log` query

**Enables:** M2

---

### EP-000 — Project Scaffolding

**Milestone:** M1  
**Goal:** Empty-repo → both apps compile, tests pass, Docker Compose brings PostgreSQL up, and the dev start sequence works end-to-end. No business logic — just a buildable, runnable skeleton.

**Technical tasks:**

**T-000-1: Repository structure**
```
follow-the-money/
├── .gitignore                   ← Java + Node + IntelliJ + .env
├── .env.example                 ← FRED_API_KEY=, SPRING_AI_ANTHROPIC_API_KEY= (optional)
├── docker-compose.yml           ← PostgreSQL 16 only
├── ftm-app/                     ← Spring Boot 4 monolith
│   └── pom.xml
└── ftm-frontend/                ← Next.js 15
    └── package.json
```

**T-000-2: `docker-compose.yml`**
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ftm
      POSTGRES_USER: ftm
      POSTGRES_PASSWORD: ftm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ftm"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**T-000-3: `ftm-app/pom.xml`**

Spring Boot 4 parent POM with all dependencies declared now (even if not wired yet):

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.0.x</version>
</parent>

<dependencies>
  <!-- Web + REST -->
  <dependency>spring-boot-starter-web</dependency>
  <dependency>springdoc-openapi-starter-webmvc-ui:2.x</dependency>

  <!-- Data -->
  <dependency>spring-boot-starter-data-jpa</dependency>
  <dependency>postgresql (runtime)</dependency>
  <dependency>flyway-core</dependency>
  <dependency>flyway-database-postgresql</dependency>

  <!-- Cache -->
  <dependency>spring-boot-starter-cache</dependency>
  <dependency>com.github.ben-manes.caffeine:caffeine</dependency>

  <!-- HTTP client (Yahoo Finance + FRED) -->
  <dependency>spring-boot-starter-webflux</dependency>

  <!-- Spring AI (optional — declared, configured via env var) -->
  <dependency>spring-ai-anthropic-spring-boot-starter</dependency>

  <!-- Test -->
  <dependency>spring-boot-starter-test (test scope)</dependency>
  <dependency>org.testcontainers:postgresql (test scope)</dependency>
  <dependency>org.testcontainers:junit-jupiter (test scope)</dependency>
</dependencies>
```

**T-000-4: `FtmApplication.java`**
```java
@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableScheduling
public class FtmApplication {
    public static void main(String[] args) {
        SpringApplication.run(FtmApplication.class, args);
    }
}
```

**T-000-5: `application.yml`**
```yaml
server:
  address: 127.0.0.1
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/ftm
    username: ftm
    password: ftm
  jpa:
    hibernate:
      ddl-auto: validate        # Flyway owns DDL; Hibernate only validates
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=500,expireAfterWrite=3600s
  ai:
    anthropic:
      api-key: ${SPRING_AI_ANTHROPIC_API_KEY:}   # empty = AI disabled

ftm:
  fred:
    api-key: ${FRED_API_KEY}

logging:
  level:
    com.ftm: DEBUG
```

**T-000-6: `application-test.yml`** (Testcontainers replaces real Postgres in tests)
```yaml
spring:
  datasource:
    url: jdbc:tc:postgresql:16:///ftm   # Testcontainers JDBC URL
    driver-class-name: org.testcontainers.jdbc.ContainerDatabaseDriver
  flyway:
    enabled: true
```

**T-000-7: CORS + async thread pool configuration**
```java
@Configuration
public class AppConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .allowedMethods("GET", "POST", "PUT", "DELETE");
    }

    @Bean
    public Executor asyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("ftm-async-");
        executor.initialize();
        return executor;
    }
}
```

**T-000-8: Smoke test** (`FtmApplicationTests.java`)
```java
@SpringBootTest
@ActiveProfiles("test")
class FtmApplicationTests {
    @Test
    void contextLoads() {}
}
```
This test must pass with Testcontainers spinning up a real PostgreSQL. It validates: Spring context loads, Flyway runs, JPA validates schema.

**T-000-9: `ftm-frontend/` Next.js 15 scaffold**
```bash
pnpm create next-app ftm-frontend \
  --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"
```

Then install:
```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
pnpm add zustand
pnpm add recharts
pnpm add lightweight-charts
pnpm add -D openapi-typescript   # TypeScript type generation from OpenAPI spec
pnpm add -D @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
```

**T-000-10: `ftm-frontend/next.config.ts`**
```typescript
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8080/api/:path*' }
    ]
  }
}
export default nextConfig
```

**T-000-11: `ftm-frontend/jest.config.ts`**
```typescript
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }
}
export default config
```

`jest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

**T-000-12: Frontend smoke test** (`src/app/page.test.tsx`)
```typescript
import { render, screen } from '@testing-library/react'
import Home from './page'

test('renders without crashing', () => {
  render(<Home />)
})
```

**T-000-13: `.env.example`** (committed to repo)
```
# Required: register free at https://fred.stlouisfed.org/docs/api/
FRED_API_KEY=your_key_here

# Optional: enables /api/v1/ai/* endpoints
# SPRING_AI_ANTHROPIC_API_KEY=your_key_here
```

**Definition of done:**
- [ ] `docker compose up -d` — PostgreSQL starts and passes health check
- [ ] `mvn test -pl ftm-app` — context loads test passes (Testcontainers spins up PostgreSQL, Flyway runs, schema validates)
- [ ] `mvn spring-boot:run -pl ftm-app` — app starts on `127.0.0.1:8080`, `/swagger-ui.html` reachable (even if no endpoints yet)
- [ ] `pnpm --filter ftm-frontend dev` — Next.js starts on `localhost:3000`
- [ ] `pnpm --filter ftm-frontend test` — smoke test passes
- [ ] `.env.example` present; no secrets in any committed file

---

### EP-001 — Data Ingestion Pipeline

**Milestone:** M1  
**Goal:** Build `IngestionService` inside `ftm-app` that consumes `IngestionRequestedEvent`, fetches market data, persists to PostgreSQL, and publishes `IngestionCompleteEvent`.

**Technical tasks:**

**T-001-1: Yahoo Finance client (`ingestion.client.YahooFinanceClient`)**
- Spring `WebClient` calling `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`
- Pull OHLCV + adjClose for all 19 ETFs + SPY + AGG
- AUM via `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=defaultKeyStatistics` → `totalAssets`
- Retry on 429 / 5xx (max 3 retries, exponential backoff 1s/2s/4s)
- Historical backfill: 7 years on first run; incremental thereafter (from `MAX(trade_date)` in `raw_prices`)

**T-001-2: FRED client (`ingestion.client.FredClient`)** _(requires `FRED_API_KEY` env var — set up in EP-000)_
- `WebClient` calling `https://api.stlouisfed.org/fred/series/observations`
- API key from env `FRED_API_KEY` → `application.yml` → `ftm.fred.api-key`
- Pull all 7 series; 7-year historical backfill; incremental afterwards

**T-001-3: Flow estimation (`ingestion.service.FlowEstimationService`)**
- Implements D-003 formula: `rawFlow = AUM(t) - AUM(t-1) - priceReturn(t) × AUM(t-1)`
- Runs after prices are written; UPDATEs `estimated_flow` column
- Skip categories where AUM is NULL

**T-001-4: Ingestion service (`ingestion.service.IngestionService`)**
- `@EventListener @Async` on `IngestionRequestedEvent`
- Write `ingest_log` (status=RUNNING), call Yahoo + FRED + flow estimation in sequence
- On success: update `ingest_log` (status=SUCCESS), publish `IngestionCompleteEvent`
- On partial failure: status=PARTIAL, errors in JSONB, still publish event
- Idempotency: `INSERT … ON CONFLICT (trade_date, category_id) DO NOTHING`

**T-001-5: Scheduler + trigger endpoint**
- `@Scheduled(cron = "0 30 16 * * MON-FRI", zone = "America/New_York")` publishes `IngestionRequestedEvent`
- `POST /api/v1/ingest/trigger` does the same on demand
- `GET /api/v1/ingest/status/{runId}` and `GET /api/v1/ingest/status/latest` read `ingest_log`

**Definition of done:**
```bash
docker compose up -d
mvn spring-boot:run -pl ftm-app        # applies Flyway, binds :8080
curl -X POST http://localhost:8080/api/v1/ingest/trigger
# poll /api/v1/ingest/status/{runId} until status=SUCCESS
```

---

### EP-002 — PostgreSQL Schema & Seeding

**Milestone:** M1  
**Goal:** Initialize PostgreSQL with all tables, indexes, constraints, and seed data via Flyway on `ftm-app` startup.

**Technical tasks:**

**T-002-1: Flyway in `ftm-app`**
- `spring.flyway.enabled=true`, `locations=classpath:db/migration`
- Applied automatically on startup

**T-002-2: `V1__initial_schema.sql`**
- All DDL from `spec.md` exactly: `categories`, `raw_prices`, `benchmark_prices`, `macro_indicators`, `signals`, `rotation_events`, `portfolio`, `alerts`, `alert_rules`, `ingest_log`
- All indexes and CHECK constraints per spec

**T-002-3: `V2__seed_categories.sql`**
- INSERT all 19 categories per `spec.md` investable universe table
- `INSERT … ON CONFLICT (id) DO NOTHING`

**T-002-4: `V3__seed_alert_rules.sql`**
- INSERT 9 alert rule rows with RFC-0003 defaults (pending confirmation of thresholds)

**T-002-5: JPA entities (`domain.*`)**
- One `@Entity` per table; composite keys via `@IdClass`
- Use `BigDecimal` for monetary fields, never `Double`

**Definition of done:**
- `docker compose up -d postgres && mvn spring-boot:run -pl ftm-app` applies all migrations on fresh DB
- All 19 categories present, all 9 alert rules present
- All tables exist with constraints and indexes matching `spec.md`

---

## M2 — Basic Dashboard

**Epics:** EP-003, EP-004  
**Blocked by:** M1

**Goal:** Working web UI showing live category data from the local backend.

**Acceptance criteria:**
- [ ] `mvn spring-boot:run -pl ftm-app` starts without error, binds to `127.0.0.1:8080`
- [ ] `GET /api/v1/categories` returns all 19 categories with latest close price
- [ ] `GET /api/v1/macro` returns current macro indicators
- [ ] Next.js dashboard loads at `http://localhost:3000`
- [ ] Category list view displays all 19 categories with name, ETF ticker, latest price
- [ ] Manual refresh button triggers ingestion and updates displayed data
- [ ] Stale data warning shown if `raw_prices` last updated > 2 trading days ago

**Enables:** M3

---

### EP-003 — Spring Boot REST API Skeleton

**Milestone:** M2  
**Goal:** `ftm-app` exposes all M2-relevant REST endpoints. Later-phase endpoints return `501 Not Implemented`.

**Technical tasks:**

**T-003-1: `CategoryController`** — `GET /api/v1/categories` joining categories + latest `raw_prices`; supports `?timeframe=MONTH`

**T-003-2: `MacroController`** — `GET /api/v1/macro`; regime hardcoded `RISK_ON_GROWTH` until EP-007

**T-003-3: `IngestController`** — `POST /ingest/trigger`, `GET /ingest/status/{runId}`, `GET /ingest/status/latest`

**T-003-4: DTOs and response shapes** — Java records matching `spec.md` API shapes exactly; `@Schema` annotations for OpenAPI

**T-003-5: `GlobalExceptionHandler`** — `@RestControllerAdvice` returning RFC 7807 `ProblemDetail`

**Definition of done:** OpenAPI docs at `/swagger-ui.html`; all endpoints respond only on `127.0.0.1`

---

### EP-004 — Next.js Dashboard Shell

**Milestone:** M2  
**Goal:** Working Next.js 15 dashboard on `localhost:3000` calling `ftm-app` and rendering category list + macro panel.

**Technical tasks:**

**T-004-1: Next.js 15 setup** — `pnpm create next-app ftm-frontend --typescript --app --tailwind`; install `@tanstack/react-query`, `zustand`, `recharts`, `lightweight-charts`; rewrite `/api/*` → `http://localhost:8080/api/*`

**T-004-2: Typed API client** (`src/lib/api.ts`) — generated from OpenAPI spec using `openapi-typescript`; React Query hooks: `useCategories(timeframe)`, `useMacro()`, `useIngestStatus()`, `useAlerts()`

**T-004-3: Layout + navigation** — sidebar (Rotation, RRG, Flows, Macro, Portfolio, Alerts, Backtest); global timeframe selector in header defaulting to `MONTH`; dark mode

**T-004-4: Category list view** — table: name, ETF ticker, type badge, latest close, 1D% change, composite score heatmap; stale data warning banner; refresh button

**T-004-5: Macro panel** — cards for all 7 FRED series; regime badge with color coding

**Definition of done:** M2 acceptance criteria above

---

## M3 — Full Signal Engine

**Epics:** EP-005, EP-006, EP-007  
**Blocked by:** M2 (RFC-0001 and RFC-0002 resolved as D-008, D-009)

**Goal:** All signal types computed daily and stored for all 19 categories.

**Acceptance criteria:**
- [ ] RS (20, 60, 120d) computed for all 19 categories with ≥ 1 year of history
- [ ] MOM computed for all categories
- [ ] FLOW_1D through FLOW_60D and PERSISTENCE signals computed where AUM is available
- [ ] RRG_RATIO, RRG_MOM, RRG_QUADRANT computed for all categories
- [ ] MACRO_FIT score computed using current regime
- [ ] COMPOSITE score computed with spec-defined weights; NULL categories handled
- [ ] COMPOSITE_TREND_5D/10D/20D computed
- [ ] RRG chart renders in dashboard with all 19 categories plotted with trails
- [ ] `GET /api/v1/signals/{categoryId}` returns full signal history
- [ ] Signal engine runs in < 30 seconds for all categories

**Enables:** M4

---

### EP-005 — Signal Engine: RS, MOM, FLOW

**Milestone:** M3  
**Goal:** Implement the three primary signals as `@EventListener @Async` in `SignalService`.

**Tasks:** `RelativeStrengthService`, `MomentumService`, `FlowService` in `signals/service/`; batch compute for all categories and dates; write to `signals` table; handle NULL gracefully where insufficient history.

---

### EP-006 — RRG Chart + Quadrant Engine

**Milestone:** M3  
**Goal:** RRG signal computation and scatter chart in the dashboard.

**Tasks:** `RrgService` implementing RS_Ratio and RS_Momentum EMA formulas; quadrant assignment; trail data (8 weeks); RRG scatter chart component: x=RS_Ratio, y=RS_Momentum, origin at (100,100), quadrant backgrounds, labeled dots, 8-week trails, hover tooltip.

---

### EP-007 — Macro Regime Detection

**Milestone:** M3  
**Goal:** Auto-classify macro environment; compute MACRO_FIT and COMPOSITE using D-008 thresholds and D-009 weights.

**Tasks:** `MacroRegimeService` using RFC-0001 threshold rules; MACRO_FIT historical win-rate computation; `CompositeScoreService` with RFC-0002 weights; replace hardcoded regime in `MacroController`.

---

## M4 — Rotation Detection

**Epics:** EP-008  
**Blocked by:** M3

**Goal:** System identifies and flags meaningful rotation events.

**Acceptance criteria:**
- [ ] Rotation events written to `rotation_events` on RRG quadrant transitions (Improving→Leading, Lagging→Improving)
- [ ] COMPOSITE_BREAKOUT events when composite crosses threshold (default 0.70)
- [ ] FLOW_SURGE events when FLOW z-score > +2.0
- [ ] `GET /api/v1/rotation` returns top-3 inflow and outflow categories
- [ ] Rotation heatmap renders: 19 categories color-coded by composite score
- [ ] Flow bar chart: FLOW z-scores with ±1.5 threshold lines
- [ ] Historical rotation events visible (last 90 days)

**Enables:** M5

---

### EP-008 — Rotation Event Detection

**Milestone:** M4  
**Goal:** Detect RRG transitions, flow surges, composite breakouts; render rotation heatmap and flow bar chart.

**Tasks:** Quadrant transition detector (compare today vs. yesterday RRG_QUADRANT per category); FLOW_SURGE and COMPOSITE_BREAKOUT detectors; `GET /api/v1/rotation` endpoint; rotation heatmap component; flow bar chart component.

---

## M5 — Portfolio Intelligence

**Epics:** EP-009, EP-010  
**Blocked by:** M4, RFC-0003 (alert architecture)

**Goal:** User can input allocation and receive data-driven rebalancing suggestions; alert system operational.

**Acceptance criteria:**
- [ ] Portfolio entry UI with % sliders per category; validates sum = 100%
- [ ] `PUT /api/v1/portfolio` persists allocation
- [ ] Alignment score computed and displayed (>0.7=green, 0.4–0.7=yellow, <0.4=red)
- [ ] Suggested rebalance: top 3 "reduce" and "increase" actions
- [ ] Alert system operational with RFC-0003 rule engine
- [ ] Alert center in dashboard with unacknowledged count badge
- [ ] Portfolio alignment chart (current allocation vs. composite-optimal)

**Enables:** M6

---

### EP-009 — Portfolio Model + Alignment

**Milestone:** M5  
**Goal:** Portfolio entry UI, alignment score, rebalancing suggestions.

**Tasks:** `PortfolioService` with weighted Spearman correlation (allocation % vs. composite scores); `AlignmentService`; portfolio entry UI; `PortfolioController` (`GET`/`PUT /api/v1/portfolio`); dual bar chart (allocation vs. optimal).

---

### EP-010 — Alert System

**Milestone:** M5  
**Prerequisite:** RFC-0003 resolved  
**Goal:** Write alerts when rotation events occur; surface in dashboard.

**Tasks:** `AlertRulesEngine` evaluating 9 rule types; deduplication (unique per category+rule+ACTIVE); auto-resolution (2 consecutive days below threshold); alert center component; acknowledge endpoint.

---

## M6 — Backtester

**Epics:** EP-011  
**Blocked by:** M5

**Goal:** Validate rotation strategy against historical data.

**Acceptance criteria:**
- [ ] Accepts: start date, end date, rebalance frequency (weekly/monthly), signal threshold
- [ ] Simulates portfolio reallocation based on composite scores at each rebalance date
- [ ] Outputs: total return, annualized return, max drawdown, Sharpe ratio vs. SPY
- [ ] Results persisted to `backtest_results` table
- [ ] Equity curve chart renders in dashboard
- [ ] 5-year backtest completes in < 60 seconds

**Post-M6:** Revisit RFC-0002 with empirical weight data. If a non-default profile outperforms by > 2% annualized, update DECISIONS.md D-002 composite weights.

---

### EP-011 — Backtester

**Milestone:** M6  
**Goal:** Historical strategy validation engine and UI.

**Tasks:** Backtest engine (strategy: allocate equally to top-N categories by composite at each rebalance date); SPY buy-and-hold baseline; Sharpe ratio (risk-free = FRED FEDFUNDS); `backtest_results` table (schema finalized in M5 refinement); equity curve chart component.

---

## Epic dependency map

```
EP-000 (scaffolding)
  → EP-002 (schema) → EP-001 (ingestion)
                    → EP-003 (API skeleton) → EP-004 (dashboard shell)
                                              → EP-005 (signals: RS·MOM·FLOW)
                                                → EP-006 (RRG)
                                                → EP-007 (macro regime)
                                              EP-006 + EP-007
                                                → EP-008 (rotation detection)
                                                  → EP-009 (portfolio)
                                                    → EP-010 (alerts)
                                                      → EP-011 (backtester)
```

---

## Deferred / out of scope

- Mobile app
- Multi-user / auth
- Brokerage integration
- Real-time intraday data
- Options flow data (consider after M4 if institutional signals prove valuable)
- Social / community features
