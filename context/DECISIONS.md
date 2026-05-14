---
last-updated: 2026-05-15 (D-008, D-009 accepted)
---

# Decisions — Follow the Money

Single source of truth for all architectural decisions and open design questions.
**How to update:** Change this file first, then update affected sections in `spec.md`.

---

## Accepted decisions (locked)

### D-001 — PostgreSQL as primary store

**Status:** Accepted · **Date:** 2026-05-14

Use PostgreSQL 16 as the sole persistent store, run locally via Docker Compose.

**Rationale:** User's primary stack. Window functions (`LAG`, `LEAD`, `OVER`) sufficient for signal computation at this data volume (19 categories × ~252 days × 7 years ≈ 33 k rows). Native Spring Data JPA + Flyway. JSONB for signal metadata.

**Alternatives rejected:** DuckDB (no JPA integration), SQLite (weaker JSONB/window support), H2 (dev only).

---

### D-002 — Spring ApplicationEventPublisher for internal pipeline events

**Status:** Accepted · **Date:** 2026-05-15 · **Supersedes:** original RabbitMQ decision

Use Spring's `ApplicationEventPublisher` with `@Async` listeners for the ingestion pipeline.

**Pattern:**
```
@Scheduled / POST trigger → IngestionRequestedEvent
  @EventListener @Async → IngestionService → IngestionCompleteEvent
    @EventListener @Async → SignalService → SignalsUpdatedEvent
      @EventListener @Async → AlertService
```

**Rationale:** The pipeline runs once per day, on a single machine, for a single user. There is no cross-process coordination need, no need for guaranteed delivery across process restarts, and no need to retry across JVMs. Spring events deliver identical decoupling with zero infrastructure.

**Why RabbitMQ was rejected for MVP:**
- Adds `docker compose up -d rabbitmq` to every startup
- A broker failure kills the pipeline entirely
- Dead-letter queues are overkill when re-triggering via `POST /ingest/trigger` is sufficient
- Three exchange declarations + dead-letter wiring for what is essentially one event per day

**Upgrade path:** If the system ever needs cross-process messaging (multiple machines, guaranteed delivery across restarts), RabbitMQ or Kafka can be re-introduced. The event class names stay the same.

---

### D-003 — Estimate fund flows from AUM delta

**Status:** Accepted · **Date:** 2026-05-14

```
rawFlow(date) = AUM(date) - AUM(date-1) - (priceReturn(date) × AUM(date-1))
```

**Rationale:** Freely available via yfinance. Accuracy ~95% vs. actual flows on non-rebalancing days. Sufficient for Z-score ranking across categories.

**Degraded accuracy on:** ETF rebalancing days (flag in `ingest_log`). Some ETFs have infrequent AUM updates — NULL FLOW signals acceptable.

---

### D-004 — No authentication (loopback only)

**Status:** Accepted · **Date:** 2026-05-14

API bound to `127.0.0.1` only. No auth, no API keys.

**CORS:** Only `http://localhost:3000` and `http://127.0.0.1:3000`.

**Upgrade path:** Add Spring Security + bind to `0.0.0.0` when/if network exposure is needed.

---

### D-005 — Caffeine in-memory cache for computed signals

**Status:** Accepted · **Date:** 2026-05-15 · **Supersedes:** original Redis decision

Use Caffeine (Spring Boot's default in-process cache) instead of Redis.

**Configuration:**
```java
@Cacheable("signals-latest")   // on the signal query method
@CacheEvict(allEntries = true) // in AlertService after signals are saved
```

1h TTL. Cache is lost on restart — recompute is fast (< 30s for all 19 categories).

**Rationale:** 19 categories × 6 signal types ≈ 114 rows. PostgreSQL with correct indexes (`category_id, signal_date DESC`) returns this in < 50ms. Caffeine adds < 5ms. No network hop, no docker service, no fallback logic needed. Single-user means no cross-instance cache invalidation.

**Why Redis was rejected for MVP:**
- Requires `docker compose up -d redis` on every dev startup
- Adds a failure mode (Redis down = degraded dashboard)
- Fallback-to-PostgreSQL logic is boilerplate that adds no real resilience value
- Cache is lost on Redis restart anyway unless persistence is configured (it wasn't)

**Upgrade path:** If the app ever becomes multi-instance or multi-user, Redis can be re-introduced. The `@Cacheable` annotation surface stays the same.

---

### D-006 — Spring AI for natural-language signal explanations (opt-in)

**Status:** Accepted · **Date:** 2026-05-14

Optional Spring AI layer. Three services: `ExplanationService`, `AdviceService`, `RegimeAnalysisService`.

If `spring.ai.anthropic.api-key` is not set, all AI endpoints return `204 No Content` + `X-AI-Status: disabled`. No hard dependency.

**Privacy:** AI calls receive only signal metadata (category name, signal values, macro regime). Raw portfolio holdings are never sent.

**Model-agnostic:** Swap Claude for OpenAI/Mistral via `application.yml` only.

---

### D-007 — Modular monolith (single `ftm-app` service)

**Status:** Accepted · **Date:** 2026-05-15 · **Supersedes:** original 4-microservice decision

Single Spring Boot 4 application `ftm-app` with packages mirroring old service boundaries.

**Package structure:**
```
com.ftm.app/
  ingestion/    ← YahooFinanceClient, FredClient, IngestionService
  signals/      ← RS, MOM, FLOW, RRG, MacroRegime, Composite services
  alerts/       ← AlertRulesEngine, AlertService
  portfolio/    ← PortfolioService, AlignmentService
  api/          ← REST controllers (Spring MVC)
  ai/           ← ExplanationService, AdviceService (Spring AI)
```

`ftm-frontend` (Next.js) remains separate — it is a different runtime.

**Why microservices were rejected for MVP:**
- 4 JVMs = ~1-2 GB RAM overhead on a Windows 11 laptop before any business logic runs
- The main decoupling benefit (RabbitMQ) is gone (see D-002)
- `ftm-api` already owned Flyway and was the de facto coordinator — the split was artificial
- "Independent restarts" is a weak benefit when all services share one PostgreSQL

**Upgrade path:** Package boundaries mirror old service boundaries. Extracting `ingestion` or `signals` into a separate service later requires only: extract the package, add a Spring Boot main class, switch from `ApplicationEventPublisher` to RabbitMQ.

---

---

### D-008 — Macro regime classification (rule-based, Option A)

**Status:** Accepted · **Date:** 2026-05-15

Classify the macro environment into one of four regimes using rule-based thresholds on FRED data. Evaluate daily, propagate immediately (no lag).

| Priority | Condition | Regime |
|----------|-----------|--------|
| 1 (highest) | T10Y2Y > 0.3 AND breakeven_inflation > 2.5 | STAGFLATION |
| 2 | VIX > 25 OR T10Y2Y < -0.2 | RISK_OFF_FLIGHT |
| 3 | T10Y2Y < 0.3 AND VIX < 22 | RISK_ON_DEFENSIVE |
| 4 (default) | T10Y2Y > 0.3 AND VIX < 22 | RISK_ON_GROWTH |
| fallback | Conflicting signals | RISK_ON_GROWTH |

Evaluate in priority order (highest first). The first matching condition wins.

**Why these thresholds:**
- VIX 22: historical long-run average ~20; above 22 = elevated uncertainty
- T10Y2Y 0.3: inverted/flat curve (<0.3) signals tight credit; steep (>0.3) signals growth expectations
- Breakeven inflation 2.5: the Fed's target is 2%; above 2.5% = above-target inflation concern
- T10Y2Y -0.2: deeply inverted = recessionary signal; stricter than flat for RISK_OFF trigger

**Propagation:** Immediate. No 3-day lag — if real data shows false flips, add smoothing then.

**No TRANSITION regime:** Conflicts fall back to RISK_ON_GROWTH. Adding a 5th regime requires MACRO_FIT historical win-rates for TRANSITION periods — complexity without validated benefit.

**No separate precious metals regime:** Uniform 4 regimes for all 19 categories. MACRO_FIT's category-specific historical win-rate handles their different behavior within each regime.

**Upgrade path:** After M6 backtester validates, upgrade to percentile-based scoring (5-year historical percentile of T10Y2Y and VIX) if rule-based thresholds prove too brittle.

---

### D-009 — Composite signal weights (uniform, 35/25/20/10/10)

**Status:** Accepted · **Date:** 2026-05-15

```
COMPOSITE = 0.35 × norm(RS_60)
          + 0.25 × norm(FLOW_20D)
          + 0.20 × norm(MOM)
          + 0.10 × norm(MACRO_FIT)
          + 0.10 × rrgScore
```

`norm()` = min-max across all 19 categories on a given date.
`rrgScore`: Leading=1.0, Improving=0.7, Weakening=0.3, Lagging=0.0.

Same weights apply uniformly to all 19 categories (equity, fixed income, metals, cash).

**Weight rationale:**
- RS_60 (35%): Price is the ultimate arbiter. When institutions have rotated, price follows. Most reliable signal.
- FLOW_20D (25%): The leading indicator, but AUM estimation has ~5% error on rebalancing days. High enough to matter; not so high that estimation noise dominates.
- MOM (20%): Is the RS trend accelerating or decelerating? Important for entry timing.
- MACRO_FIT (10%): Context, not signal. Informs but should not override clear price/flow signals.
- rrgScore (10%): Largely captured by RS+MOM; small weight keeps it as a quadrant-level sanity check.

**No category-type-specific weights for MVP:** The hypothesis that fixed income needs higher MACRO_FIT is reasonable but unvalidated. Add complexity after M6 data shows it's warranted.

**User-configurable profiles:** Deferred to M5+. Define after M6 backtester can validate which profile has better historical performance.

---

## Open questions (RFCs)

### RFC-0003 — Multi-timeframe independent alerts

**Status:** Draft · **Target:** Needed before M5

**Proposed:** 9 independent alert rule types (5d/10d/20d flow inflow, 5d/10d/20d flow outflow, RRG transition, composite breakout, macro regime shift). Each configurable with threshold, persistence, severity, and category filter. Three preset profiles: Active Trader / Balanced / Patient Capital.

**Open questions:**
1. Confirm `Balanced` as default profile
2. Confirm z-threshold 1.5 and persistence 3/6/12 defaults
3. MACRO_REGIME_SHIFT cascade (3d/10d/30d)? Recommendation: no — single fire on classification flip
4. Severity colour mapping: INFO=blue, WARNING=amber, ACTION=red?

**Action needed:** Confirm defaults before M5.
