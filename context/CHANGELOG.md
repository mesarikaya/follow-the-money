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

## 2026-06-16 (session 39 — EP-070 through EP-072 UI feature wave)

- `NEW` EP-070: `ThemeScoreZPanel` — statistical deviation panel on /themes page
  - Computes z-score per theme from 30-day history: `(current − mean) / stddev`
  - Guards: history.length < 6 → null; stddev < 0.005 → null (flat history)
  - Top 3 "Elevated" and bottom 2 "Depressed" entries
  - Color bands: z≥2 emerald, z≥1 cyan, z≥0 slate, z≥-1 amber, z<-1 red
  - 4 E2E tests

- `NEW` EP-071: `ThemeSignalStreakPanel` — signal conviction tracker on /themes page
  - Infers daily signal from compositeScore: ≥0.65 BUY, ≥0.50 WATCH, ≥0.35 HOLD, else REDUCE
  - Counts consecutive trailing days at current inferred signal from 30-day history
  - Shows top 6 themes by streak, signal-colored horizontal progress bars
  - High-conviction message when top streak ≥ 20 days
  - 4 E2E tests

- `NEW` EP-072: `ThemeMomentumForecast` — 5–10d score projection panel on dashboard
  - Filters sub-BUY themes (score 0.40–0.64) with positive compositeTrend5d
  - Projects score: `projected5d = compositeScore + trend5d * 5`
  - Labels: APPROACHING_BUY (p5d ≥ 0.65), BUILDING (p10d ≥ 0.65), SLOW_CLIMB
  - Visual dual-fill progress bars: solid=current, translucent=projected
  - 4 E2E tests

---

## 2026-06-16 (session 38 — EP-065 through EP-069 UI feature wave)

- `NEW` EP-065: `ThemeScoreCalendar` — GitHub-style 13-week × 7-day score heatmap on theme detail page
  - Props: `{ history: ThemeHistoryPoint[] }`; pads to 91 cells; 13 columns (weeks) × 7 rows (days)
  - Zone-aware colour intensity: BUY=emerald, WATCH=cyan, HOLD=amber, REDUCE=red
  - Day labels Mon–Sun on left; BUY/WATCH/HOLD/REDUCE zone legend in header
  - Uses `fetchThemeHistory(id, 91)` in parallel in themes/[id]/page.tsx
  - 4 E2E tests; 91 → 95 E2E total

- `NEW` EP-066: `ThemeAlertActivityStrip` — 30-day alert heat map on dashboard
  - Shows top 8 themes by `alertCount30d`; grid of 4 columns; links to `/themes/${id}`
  - Heat labels: "hot" (≥75% of max), "active" (≥50%), "warm" (≥25%), "low" (<25%)
  - Animated red pulse dot for "hot" themes; total fire count in header
  - 4 E2E tests; 95 → 99 E2E total

- `RESOLVED` EP-060 tests permanently lost in pages.spec.ts — restored via PR #47
  - EP-061 merge had clobbered the EP-060 `alert-rule-activity-panel` test describe block
  - Identified and re-added 3 tests; now at 102 E2E total after this fix + EP-065 + EP-066

- `NEW` EP-067: `ThemeAlertRiskMap` — 2D scatter on /themes: alert activity vs 5d momentum
  - X = alertCount30d (quiet→noisy); Y = compositeTrend5d (fading→rising)
  - 4 quadrant labels: Rising Quietly / Alert-Confirmed Rise / Fading Quietly / Alarm Zone
  - Dot size = compositeScore; dot colour = dominantSignal
  - 4 E2E tests; 103 → 107 E2E total (including EP-067 tests after EP-060 fix)

- `NEW` EP-068: `ThemeBuyCountdown` — days-to-BUY countdown on /themes page
  - Filters score 0.50–0.65 with positive trend; computes `ceil((0.65 - score) / trend5d)`
  - Urgency colour: green ≤5d, cyan 5–14d, amber 15–30d; shows ⬆ accel badge
  - Also adds `~Nd` inline badge to `NearEntryRow` in `ThemeSignalWidget`
  - 4 E2E tests

- `NEW` EP-069: `ThemeHealthGauge` — SVG semi-circular arc gauge on dashboard
  - Synthesises all theme signals: BUY=+2, WATCH=+1, HOLD=0, REDUCE=-1 → 0–100 score
  - Four zones: RISK OFF / CAUTION / NEUTRAL / RISK ON; needle + active arc fill
  - Side panel: signal count badges, bullish vs fading phase counts, avg 5d trend
  - 4 E2E tests

---

## 2026-06-15 (session 32 — backtester SPY data fix + auto-reclassify on ticker mapping)

- `RESOLVED` Backtester showing -140% excess return — root cause: SPY benchmark_prices seeded
  with placeholder adj_close=200.0 for Feb–Jun 2024 (130 rows). Real SPY was ~$495 in Feb 2024.
  This made SPY appear to return 270% (200→741) instead of ~50%, inflating the "Excess Return"
  metric by ~220 percentage points.
  - V67 migration: DELETE all SPY rows from benchmark_prices; next ingest backfills 7 years.
  - ⚠️ User must run POST /api/v1/ingest/trigger once after deploy to restore SPY history.

- `RESOLVED` SAP.DE segment not appearing in portfolio after adding ticker mapping
  - Adding a ticker mapping refreshed the in-memory cache but did NOT update existing holdings.
  - TickerMappingController.upsert() now calls holdingUploadService.reclassifyUnmappedHoldings()
    after refreshCache(), automatically re-classifying any holdings with null category_id.
  - HoldingUploadService.reclassifyUnmappedHoldings() is now public (was: private syncMissingCategoryIds).

- `UPDATED` backtest/page.tsx — "Excess Return" label renamed to "Cumulative Alpha (vs SPY)"
  - Shows breakdown: "strategy_total% − spy_total%" below the value for clarity.
  - Tooltip added explaining the metric is strategy total return minus SPY total return.

## 2026-06-14 (session 31 — GBX/SEK currency support, ticker seeds, portfolio history)

- `NEW` V64: `rotation_events_event_type_check` constraint fix — added `COMPOSITE_BREAKDOWN`
  - Backend crashed when CASH category fired COMPOSITE_BREAKDOWN rotation event
  - Drops & recreates constraint to include all 7 current RotationEventType enum values

- `NEW` V65: ticker-category seed mappings for user's real portfolio holdings
  - 50+ mappings: BA.L→INDU_ADEF, SAAB-B.ST→INDU_ADEF, BNTX→HLTH_BIOT, ASML→SEMI,
    RHM.DE→INDU_ADEF, MO→STPL, PYPL→FINL_FINT, FISV→FINL_FINT, QS→ENRG_DRIV,
    SPCE→TECH, WKL.AS→SOFT, DFEU.AS→INDU_ADEF, DIS→COMM, GD/LMT/BA/AIR→INDU_ADEF, CASH→CASH
  - Restores classifications wiped when test suite ran against production DB in session 30

- `NEW` GBX (British pence) currency support in HoldingUploadService
  - Yahoo Finance returns LSE tickers (BA.L) in pence (GBX), not GBP
  - Now detects GBX, divides by 100 to normalize to GBP, then applies GBP/USD FX rate
  - BA.L EUR market value now computed correctly

- `NEW` SEK (Swedish krona) currency support
  - HoldingPriceService.fetchSekUsdRate() fetches SEKUSD=X from Yahoo Finance
  - fx-rate-sek-usd Caffeine cache (max 1, 1h TTL) registered in CacheConfig
  - HoldingUploadService routes SEK holdings through sekUsdRate for EUR conversion
  - SAAB-B.ST EUR market value now computed correctly

- `NEW` brief/page.tsx — Daily Brief RSC command-center page
  - 3-column Buy/Watch/Reduce signal grid, 5d movers, themes grid, active alert log
  - Sidebar updated: Daily Brief is first nav item under Analysis

- `NEW` V66: portfolio_value_snapshots + fx_rates_history tables
  - Stores daily EUR portfolio value snapshot on every "Refresh Prices" click
  - Also stores USD/EUR, GBP/USD, SEK/USD rates as of that day
  - PortfolioSnapshotRepository: raw jOOQ DSL, upsert on conflict by date
  - GET /api/v1/portfolio/holdings/snapshots?days=N endpoint
  - PortfolioValueChart: SVG line chart on portfolio page showing 90d value history

- `RESOLVED` HoldingUploadServiceTest + HoldingControllerTest updated for new constructor params
  - 540 backend tests pass

---

## 2026-06-14 (session 30 — CI E2E fix + test isolation + FRED data restore)

- `RESOLVED` E2E CI test failures: 11 tests failing on CI because `BACKEND_URL` is server-side only
  - Client components (alerts page, ticker-mappings) use `fetchAlertRules()` etc. from the browser
  - Browser can't see `BACKEND_URL`; falls back to `localhost:8080` (no server on CI)
  - Fix: added `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:9999` to `playwright.config.ci.ts`
  - Also updated `activeCount: 7 → 8` in `ALERTS_RESPONSE` to match 8 ACTIVE alerts

- `RESOLVED` Test isolation: integration tests wiping production database when run with `-Plocal-pg`
  - Root cause: `MacroIndicatorRepositoryIT`, `TickerMappingRepositoryIT` etc. have `TRUNCATE` in `@BeforeEach`
  - With `-Plocal-pg`, Surefire connects to `localhost:5432/ftm` (production) — tests destroy real data
  - Fix: created `ftm_test` database; pom.xml now migrates `ftm_test` before test phase
  - Surefire now uses `jdbc:postgresql://localhost:5432/ftm_test` (isolated test DB)
  - pom.xml also activates Spring `local` profile for `spring-boot:run` so `application-local.yml` loads

- `RESOLVED` FRED macro data restoration
  - `macro_indicators` had 1 corrupted test row (DGS10=5026.44 from 2024-01-02 — Instancio random value)
  - Backend needed restart with `local` profile so FRED key is available
  - User needs to: restart backend with `-Plocal-pg` then trigger ingestion

---

## 2026-06-14 (session 29 — V63 theme_peer_divergence alert rule + Docker fix)

- `NEW` V63: `theme_peer_divergence` alert rule
  - Fires INFO when ≥3 theme constituents have composite signals, max−min spread > 30 pts, avg > 0.40
  - Indicates internal rotation: leader/laggard within theme, suggesting catch-up opportunity
  - Resolves when spread drops below 20 pts (convergence)
  - 4 backend tests; mock backend updated (alert id=8, rule in ALERT_RULES_RESPONSE)
  - 127 AlertRulesEngineTest tests pass

- `NEW` `local-pg` Maven profile (added session 28)
  - Docker Desktop 4.77.0 broke docker-java 3.3.x (API 1.32 vs required 1.40)
  - Profile bypasses Testcontainers for codegen + tests: `./mvnw <goal> -Plocal-pg`
  - Required for ALL Maven goals: `test`, `spring-boot:run`, `clean install`, `generate-sources`

---

## 2026-06-13 (session 27 — V78 theme_strong_breakout_confirmation alert rule)

- `NEW` V78: `theme_strong_breakout_confirmation` alert rule
  - Fires ACTION when avg theme score >= 0.70 AND prior-20d score < 0.65
  - Confirms sustained institutional follow-through: score broke above BUY threshold AND kept climbing
  - Distinct from `theme_phase_breakout_entry` (phase-based) — this is score-level confirmation
  - Uses `findNthPreviousSignalDate(COMPOSITE, signalDate, 20)` for 20 trading day lookback
  - Resolves when score drops below 0.65 (BUY threshold lost)
  - V61 Flyway migration seeds as enabled/ACTION
  - 4 tests using `any(LocalDate.class)` thenAnswer chain for 20-day prior date lookup
  - 534 backend tests pass
  - Full BUILTIN_RULES note + RULE_LABELS added in alerts page and both theme pages
  - Mock backend: rule added to ALERT_RULES_RESPONSE; AI_INFRA strong breakout alert (id=7) in ALERTS_RESPONSE

---

## 2026-06-13 (session 27 — V77 NearEntryRow in ThemeSignalWidget + V76 E2E coverage)

- `NEW` V77: `NearEntryRow` component and "NEAR ENTRY" section in `ThemeSignalWidget`
  - Shows themes approaching BUY territory: score 0.55–0.65, 5d trend > 0.003, not already BUY
  - Mini progress bar (sky→emerald gradient) showing distance through entry zone
  - Displays 5d momentum rate ("+N.Npt/d"), score, and "Xpt to BUY" gap
  - Top 3 near-entry themes sorted by score; section only renders when qualifying themes exist
  - Phase badge from PHASE_MINI rendered inline if themePhase is set
  - 3 new E2E tests: "NEAR ENTRY" label, theme names, "pt to BUY" text

- `NEW` V76: E2E mock coverage for all 5 new theme alert rules (V57–V60 era)
  - Added to `ALERT_RULES_RESPONSE` in `mock-backend.mjs`: `theme_setup_acceleration`,
    `theme_failed_breakout`, `theme_phase_fading`, `theme_momentum_exhaustion`, `theme_recovery_signal`
  - Added `theme_recovery_signal` active alert for SAAS_AT_RISK (id=6) to ALERTS_RESPONSE; activeCount → 6
  - Added SAAS_AT_RISK per-theme alert history entries for phase_fading (id=92) and recovery_signal (id=93)
  - Added phase_fading and setup_acceleration events to recent alerts feed
  - Added all 5 rules to `BUILTIN_RULES` in `alerts/page.tsx` with full description notes
  - Added all 5 rules to `RULE_LABELS` in `alerts/page.tsx`
  - 9 new E2E tests: 4 alert-rules-panel label tests, 2 active-alert tests, 3 theme-detail-history tests

---

## 2026-06-10 (session 26 — V75 theme_recovery_signal alert rule)

- `NEW` V75: `theme_recovery_signal` alert rule — closes the loop after fading/exhaustion rules
  - Fires INFO when: score in [0.35, 0.55], 5d trend > 0.003, AND 20d was negative 5 days ago
  - Confirms nascent recovery before phase fully resolves — "early turn signal"
  - Resolves when score > 0.60 (confirmed) or < 0.30 (failed)
  - V60 Flyway migration seeds as enabled/INFO
  - 4 tests: fires on recovery, no fire when 5d too weak, no fire when score above zone, no fire disabled
  - 119 AlertRulesEngine tests pass; frontend RULE_LABELS updated

---

## 2026-06-10 (session 26 — V74 ThemeSignalWidget conviction footer)

- `NEW` V74: ThemeConvictionBar footer added to ThemeSignalWidget
  - Shows BUY/WATCH signal counts, bullish/bearish phase counts, BULLISH/MIXED/BEARISH label
  - Zero API calls — derives from existing ThemeSummary.themePhase and dominantSignal

---

## 2026-06-10 (session 26 — V73 ThemeSignalWidget phase badges)

- `NEW` V73: Phase badges in ThemeSignalWidget on main dashboard
  - `PHASE_MINI` config adds arrow-prefixed label (e.g. "↗ BREAKOUT") with per-phase color scheme
  - Phase badge renders inline next to signal badge for each theme row
  - Zero new API calls — `themePhase` already in ThemeSummary

---

## 2026-06-10 (session 26 — V72 ThemeScoreHeatmap component)

- `NEW` V72: ThemeScoreHeatmap component on `/themes` page
  - 20-day daily dot grid, each cell colored by score bucket (red → emerald)
  - Color thresholds: emerald ≥0.70, emerald-600 ≥0.65, cyan ≥0.55, amber ≥0.40, red below
  - Date column headers (rotated) every 5 days; rightmost column shows current score text
  - Theme name column links to detail page; graceful handling when history gap exists
  - Inserted after ThemeScreener, before theme card grid

---

## 2026-06-10 (session 25 — V71 theme_momentum_exhaustion alert rule)

- `NEW` V71: `theme_momentum_exhaustion` alert rule — early exit signal for BUY-zone themes
  - Fires when score >= 0.65 AND 5d trend < -0.005 AND 20d trend < 0 (both trends negative simultaneously)
  - Resolves when 5d trend recovers > 0.002 or score drops below 0.60
  - Earlier warning than theme_failed_breakout (which requires score to already drop below 0.57)
  - V59 Flyway migration seeds the rule as enabled/WARNING
  - 4 tests added; 526 total backend tests pass

---

## 2026-06-10 (session 25 — V70 velocity sort in ThemeScreener)

- `NEW` V70: Added `velocity` sort key to ThemeScreener
  - Sorts themes by momentum acceleration (compositeTrend5d − compositeTrend20d)
  - "Trend" column header now a clickable SortLink (sort=velocity)
  - Fastest-accelerating themes bubble to the top
  - Zero new API calls — uses existing ThemeSummary trend fields

---

## 2026-06-10 (session 25 — V69 Theme Playbook component)

- `NEW` V69: ThemePlaybook component on `/themes` page
  - Per-theme action-oriented guidance: ENTER (BUY+BREAKOUT), HOLD (BUY+MOMENTUM), WATCH (BUY+FADING), PREPARE (WATCH+SETUP), REDUCE
  - Shows score, 5d delta, and specific note per theme
  - Sorted by priority: ENTER first, REDUCE last
  - Zero new API calls — uses existing ThemeSummary + history data

---

## 2026-06-10 (session 24 — V68 theme_phase_fading alert rule)

- `NEW` V68: `theme_phase_fading` alert rule — fires when a theme enters the FADING phase
  - Lazy prior-data loading (same pattern as theme_phase_breakout_entry)
  - Resolves when phase exits FADING (score recovers or trend turns non-negative)
  - V58 Flyway migration seeds the rule as enabled/WARNING
  - 3 tests added (fires on entry, no fire on already-FADING, no fire when disabled)
  - 111 AlertRulesEngine tests pass

---

## 2026-06-10 (session 24 — V67 Theme Tipping Points panel)

- `NEW` V67: ThemeTippingPoints component on `/themes` page
  - Surfaces themes nearest key signal thresholds: ENTRY (approaching BUY), AT RISK (BUY zone but momentum fading), RECOVERY (rising from HOLD zone)
  - Uses existing history data — no new API calls
  - Shows score bar, 5d delta, distance to threshold, and context note for each theme

---

## 2026-06-10 (session 24 — V66 Theme Events Feed)

- `NEW` V66: Theme Events Feed — cross-theme chronological activity log on `/themes`
  - New `GET /api/v1/alerts/recent` backend endpoint (limit 30, all statuses, newest first)
  - `AlertRepository.findRecentAlerts(limit)` — queries across all categories and themes
  - `AlertService.getRecentAlerts()` + `AlertController` `/recent` endpoint
  - `fetchRecentAlerts()` in `api.ts`; `ThemeEventsFeed` component on themes page
  - Renders event log: timestamp · severity dot · subject link · rule label · status badge
  - Active alerts shown at full opacity; resolved/acknowledged dimmed to 50%

---

## 2026-06-10 (session 23 — V65 constituent 5d trend + screener bullish bar)

- `NEW` V65: Constituent 5-day trend in theme detail page
  - Added `compositeTrend5d` field to `ThemeConstituentDto` (backend) and `ThemeConstituent` (frontend type)
  - Detail page constituent table now shows separate "5d" and "20d" trend columns
  - Lets traders spot which ETFs in a theme are currently accelerating vs decelerating
- `UPDATED` V65: Bullish column in ThemeScreener upgraded from % text to segmented dot bar
  - Renders one dot per constituent, green=bullish (BUY/WATCH), slate=non-bullish
  - Shows count as `N/total` text alongside bar
  - 519 backend + 64 E2E tests pass

---

## 2026-06-10 (session 23 — V64 sector badges in ThemeScreener)

- `NEW` V64: Sector badges in ThemeScreener
  - New "Sector" column between Theme and Signal
  - Color-coded badge per GICS sector (Tech=blue, Health=emerald, Finl=amber, etc.)
  - Each badge links to `/sectors/{sectorId}` drilldown page
  - Derived from `topConstituents` via `getParentSectorId` — zero new API calls
  - Lets traders instantly spot "all TECH themes in BREAKOUT = sector confirmation"
  - 519 backend + 64 E2E tests pass

---

## 2026-06-10 (session 23 — V63 failed breakout alert rule)

- `NEW` V63: `theme_failed_breakout` alert rule (V57 migration)
  - Fires when theme avg composite drops from ≥0.65 (BUY zone) to <0.57 within 5 trading days
  - Severity: WARNING — exit signal, not entry
  - Resolves when score recovers to ≥0.62
  - Completes alert lifecycle: setup_acceleration → phase_breakout_entry → [distribute_warning] → failed_breakout
  - 519 backend tests pass (4 new AlertRulesEngineTest tests)
  - Frontend label mapping added in both themes/ and themes/[id]/ pages

---

## 2026-06-10 (session 23 — V62 sortable ThemeScreener columns)

- `NEW` V62: URL-param sortable columns in ThemeScreener
  - Sort keys: `score` (default), `delta5d` (5-day momentum), `alerts` (active alert count), `rs60` (relative strength)
  - Active sort column highlighted cyan with ↓ indicator; inactive columns shown in slate-600
  - `ThemesPage` accepts `searchParams: Promise<{ sort? }>` (Next.js 16 RSC async searchParams)
  - `SortLink` component renders `<Link href="/themes?sort=X">` — pure server-side, zero client JS
  - 515 backend + 74 E2E tests pass

---

## 2026-06-10 (session 23 — V57-V61 alert history, phase age, score delta, setup acceleration)

- `NEW` V57: GET /alerts/theme/{themeId} endpoint + ThemeAlertHistory component on detail page
- `NEW` V58: Phase age indicator in ThemeScreener (days in current phase, freshness-colored)
- `NEW` V59: E2E tests for alert history + fix stale theme/ETF count test
- `NEW` V60: 5d score delta column in ThemeScreener — absolute pts change over 5 trading days
- `NEW` V61: theme_setup_acceleration alert rule (V56 migration) — pre-breakout early entry signal
  - Fires when: avg score 0.52-0.64 (SETUP) AND 5d trend >= 0.008 pt/day
  - Resolves when: score >= 0.65 (breakout confirmed) or score < 0.48 or trend stalls
  - 515 backend + 74 E2E tests pass

---

## 2026-06-10 (session 23 — alert history + phase age + E2E V57-V59)

- `NEW` V57: Theme alert history endpoint + detail page section (see V57 entry below)
- `NEW` V58: Phase age indicator in ThemeScreener Phase cell — shows days in current phase (bright for fresh ≤2d, dimming as phase matures); computed from historiesByThemeId via phaseFromHistory helper
- `NEW` V59: E2E coverage — alert history section test; fix stale "9 themes/45 ETFs" test to 12/58
  - 511 backend + 74 E2E tests pass

---

## 2026-06-10 (session 23 — theme alert history V57)

- `NEW` Theme alert history endpoint: `GET /alerts/theme/{themeId}` returns all statuses (ACTIVE/RESOLVED/ACKNOWLEDGED), last 100, newest-first
  - AlertRepository.findRecentByThemeId: jOOQ query, no status filter
  - AlertService.getThemeAlertHistory: uppercase-normalises themeId
  - ThemeAlertHistory UI component: shows resolved/acknowledged alerts with status dot + severity badge + date range (created→closed), dimmed styling; renders below active panel on detail page
  - mock-backend: /api/v1/alerts/theme/{id} returns active + synthetic resolved/acknowledged history entries
  - 511 backend tests (+2) + 73 E2E tests pass
  - ✅ `ftm-app/.../AlertRepository.java`, `AlertService.java`, `AlertController.java`, `AlertControllerTest.java`
  - ✅ `ftm-frontend/.../api.ts`, `themes/[id]/page.tsx`, `e2e/mock-backend.mjs`

---

## 2026-06-10 (session 22 — theme screener upgrades V56)

- `UPDATED` ThemeScreener: rank-change column, alert badge column, mini sparklines in Score cell
  - Rank Δ column: compares each theme's current rank vs its rank 5 trading days ago (using historiesByThemeId). Green ↑N = moved up, red ↓N = moved down.
  - Alerts column: active alert count badge per theme (amber pill); rows with active alerts get a left amber border accent. Data comes from alertsByThemeId computed in the page server component from existing alertsResponse — no new API call.
  - Score cell: embedded 40×12 SVG sparkline (last 14 history points) gives at-a-glance momentum shape.
  - 509 backend tests + 73 E2E tests pass.
  - ✅ `ftm-frontend/src/app/themes/page.tsx`

---

## 2026-06-09 (sessions 19-21 — cross-sector themes + alert engine expansion V49-V55)

- `NEW` V49-V53: theme alert engine expanded — theme_dominant_signal_transition, theme_momentum_surge, theme_momentum_collapse, theme_distribute_warning alert rules; theme lifecycle phases (BREAKOUT/MOMENTUM/SETUP/BUILDING/HOLDING/FADING/DISTRIBUTE/WEAK/NEUTRAL); ThemeScreener table
  - Theme lifecycle phases computed from compositeScore + trend5d + trend20d; shown as badges on screener + detail pages
  - PhaseTimelineStrip on detail page: 30-day phase history as colored band chart
  - 'What to Watch' guidance on detail page based on current phase
  - ThemeRaceChart: animated 30d score history chart for up to 10 themes
  - ThemeRelativeStrengthPlot, ThemePositioningMatrix for cross-theme comparison
  - ActiveRotationBanner, RotationMomentumStrip for momentum context
  - TopOpportunitiesPanel, PreBuySetupPanel for actionable signals
  - ThemeAlertFeed on hub page; ThemeDetailAlerts on detail page
  - ✅ AlertRulesEngine.java (4 new evaluate* methods)
  - ✅ ftm-frontend/src/app/themes/page.tsx
  - ✅ ftm-frontend/src/app/themes/[id]/page.tsx

- `NEW` V54: 3 new investment themes seeded — BIOTECH_WAVE, FINANCIAL_ROTATION, RESHORING_CYCLE
  - Total themes: 10 (was 7); constituent IDs use V9 sub-sector prefixed IDs
  - ✅ `ftm-app/src/main/resources/db/migration/V54__new_themes_biotech_financial_reshoring.sql`

- `NEW` V55: theme_phase_breakout_entry alert rule
  - Fires when a theme transitions INTO BREAKOUT from any lower phase; uses 5-day lookback via chained findPreviousSignalDate to avoid false positives on noise
  - Resolves automatically when theme exits BREAKOUT or MOMENTUM
  - ✅ `ftm-app/src/main/resources/db/migration/V55__theme_phase_breakout_entry_alert_rule.sql`
  - ✅ `AlertRulesEngine.java` (evaluateThemePhaseBreakoutEntry, findNthPreviousSignalDate, computeThemePhaseForAlert)
  - ✅ `ftm-frontend/e2e/mock-backend.mjs` (new rule + 3 new themes)

---

## 2026-05-17 (session 14 — EP-020: sector visual polish; EP-021: /sub-sectors redirect cleanup)

- `UPDATED` EP-020: Sector pages visual upgrade to match redesigned mockups
  - Added Rajdhani (display) + JetBrains Mono (data) fonts via `next/font/google`; exposed as `--font-rajdhani` / `--font-jetbrains-mono` CSS variables
  - `sectors/page.tsx`: gradient card backgrounds, 3-stat grid (Score/RS60d/Flow20d), Rajdhani headings, styled quadrant badges with colored borders, cyan ticker badge, hover "→ drill down" hint
  - `sectors/[id]/page.tsx`: prominent sector banner with blue left-border accent, styled quadrant badges as colored boxes, Rajdhani table headers, JetBrains Mono for all numeric cells
  - Matches approved mockups in `context/mockups/sectors-index.html` and `context/mockups/sector-drilldown.html`
  - ✅ `ftm-frontend/src/app/layout.tsx` (Rajdhani + JetBrains Mono fonts added)
  - ✅ `ftm-frontend/src/app/globals.css` (--font-display, --font-data CSS vars)
  - ✅ `ftm-frontend/src/app/sectors/page.tsx`
  - ✅ `ftm-frontend/src/app/sectors/[id]/page.tsx`

- `UPDATED` EP-021: `/sub-sectors` redirect + E2E cleanup
  - `/sub-sectors` now permanently redirects (307) to `/sectors/TECH`
  - Removed 3 "Tech Sub-Sectors page" E2E tests (fully covered by "Sector drilldown page" group)
  - Added 1 redirect smoke-test; net E2E count: **30 tests** (was 32)
  - ✅ `ftm-frontend/src/app/sub-sectors/page.tsx` (redirect only)
  - ✅ `ftm-frontend/e2e/pages.spec.ts` (3 removed, 1 added)

---

## 2026-05-17 (session 13 — M12: CI/CD gate, CategoryId bug fix, spec drift elimination)

- `NEW` EP-019 (M12) complete: GitHub Actions CI + branch protection
  - `.github/workflows/ci.yml`: two required jobs — Backend Tests (Maven + Testcontainers, JDK 25) + Frontend E2E Tests (Playwright chromium)
  - `ftm-frontend/playwright.config.ci.ts`: Linux-compatible webServer commands for CI (replaces Windows .cmd wrappers)
  - Branch protection applied to `main` and `develop` via GitHub API: both CI jobs must pass before any PR can merge
  - Playwright report uploaded as artifact on failure (7-day retention)
  - ✅ `.github/workflows/ci.yml` (new)
  - ✅ `ftm-frontend/playwright.config.ci.ts` (new)

- `UPDATED` CategoryId enum: added all 58 V9 sub-sector constants
  - Root cause: V9 migration seeded TECH_CYBR, HLTH_BIOT, FINL_BANK, etc. to DB but CategoryId enum was never updated; CategoryRepository.valueOf() threw IllegalArgumentException at runtime
  - Fix: added all sector-prefixed IDs (TECH_CYBR/HACK/ROBO/AIQQ, HLTH_BIOT/BIOI/MDEV/PROV/PHAR/GNOM, FINL_BANK/REGI/INSR/BROK/FINT/KBWB, DISR_RETL/HOME/AIRL/HOTL/REST/AUTO, INDU_ADEF/TRAN/PAVE/AIRR/ROAD, ENRG_OILS/EXPL/SOLR/CLEN/WIND/DRIV/NUCL/URAN, MATL_STEE/LITH/COPP/RING/WOOD/AGRI/RARE, UTIL_WATR/FIWA/UTES, REIT_RESI/MORT/DATA/INDS/RETL, STPL_FOOD/GROC/PRDT, COMM_SOCL/ESPO/NERD/BETZ/FIVG)
  - CategoryRepositoryIT: updated hardcoded counts 27→85 (active) and 26→84 (with CASH excluded)
  - Result: 141 backend tests pass (was 0/141 with 9 errors)
  - ✅ `ftm-app/src/main/java/com/ftm/app/domain/CategoryId.java`
  - ✅ `ftm-app/src/test/java/com/ftm/app/api/repository/CategoryRepositoryIT.java`

- `UPDATED` roadmap.md: comprehensive spec drift elimination
  - M1–M11 all acceptance criteria ticked [x]
  - M9/M10/M11 milestone table rows updated to Complete
  - M10 status line In Progress → Complete
  - M8: NYSE A/D marked deferred (requires Alpha Vantage API key)
  - M9: E2E count 25 → 32; badge label text corrected
  - M10: sub-sector E2E count corrected (9 new tests, not 2)
  - M12 + EP-019 section added
  - ✅ `context/roadmap.md`

- `UPDATED` conventions.md: SPEC DRIFT IS A BUG section added (zero-tolerance rule)
  - Prominent non-negotiable obligations at session end
  - Drift detection checklist (scan for stale checkboxes, test counts, milestone status)
  - AI must NEVER list expanded: explicit spec drift prohibitions at the top
  - ✅ `context/.ai/conventions.md`

---

## 2026-05-17 (session 12 — M9/M10/M11: UI redesign, structural sub-sectors, conventions)

- `NEW` EP-018 (M11) complete: mockup-first workflow rule added to `context/.ai/conventions.md`
  - Added `## Frontend workflow (mandatory)` section with 5-step mockup → approve → implement → E2E → verify rule
  - Design token reference table (surface/panel/border/muted hex values)
  - ✅ `context/.ai/conventions.md`

- `NEW` EP-016 (M9) complete: global header + CategoryTable redesign
  - GlobalHeader component: brand + TimeframeSelector + RefreshButton in one top bar
  - Brand moved out of Sidebar; sidebar starts with Analysis group label
  - TimeframeSelector made self-contained (reads ?timeframe= from URL; no prop)
  - CategoryTable: fixed PRECIOUS_METAL key (was COMMODITY — no DB rows matched)
  - CategoryTable: added CASH→"CA" badge (BIL was falling through to ALT)
  - CategoryTable: added section divider rows between EQUITY/PM/FI/CASH groups
  - CSS design token vars added: --surface, --panel, --border, --muted
  - 25 E2E tests pass (24 + CA badge assertion)
  - ✅ `ftm-frontend/src/components/GlobalHeader.tsx` (new)
  - ✅ `ftm-frontend/src/app/layout.tsx`
  - ✅ `ftm-frontend/src/components/Sidebar.tsx`
  - ✅ `ftm-frontend/src/components/TimeframeSelector.tsx`
  - ✅ `ftm-frontend/src/app/page.tsx`
  - ✅ `ftm-frontend/src/app/globals.css`
  - ✅ `ftm-frontend/src/components/CategoryTable.tsx`

- `UPDATED` roadmap.md: M9/M10/M11 milestones and EP-016/017/018 epics added
  - ✅ `context/roadmap.md`

- `UPDATED` EP-016 badge labels corrected: all type badges use full descriptive names (Equity, Precious Metal, Fixed Income, Cash) — no abbreviations
  - ✅ `ftm-frontend/src/components/CategoryTable.tsx`
  - ✅ `ftm-frontend/e2e/mock-backend.mjs` (GOLD → PRECIOUS_METAL type; BIL → CASH type; TLT added as FIXED_INCOME)
  - ✅ `ftm-frontend/e2e/dashboard.spec.ts`

- `NEW` EP-017 (M10) complete: V9 migration + /sectors hub + /sectors/[id] drilldown + redesigned mockups
  - V9 Flyway migration: ~70 ETFs across all 11 GICS sectors. benchmark_ticker = parent sector ETF. display_order = parent×100+N. HLTH starts at 205 (skips 201-204 used by FTRS from V8).
  - `/sectors` hub: 11 sector cards with RRG quadrant badge, RS% vs SPY, sub-sector count, link to drilldown
  - `/sectors/[id]` drilldown: table sorted by quadrant→RS60, quadrant distribution summary cards, breadcrumb
  - Sidebar: "Tech Sub-Sectors" → "Sub-Sectors" → /sectors
  - Both mockups redesigned with Rajdhani + JetBrains Mono, deep dark gradient, left-border quadrant coloring
  - 11 new E2E tests; 32/32 total pass
  - PRs: #9 (EP-018 → develop), #10 (EP-016 → develop), #11 (EP-017 → EP-016)
  - ✅ `ftm-app/src/main/resources/db/migration/V9__sub_sectors_all_sectors.sql`
  - ✅ `ftm-frontend/src/app/sectors/page.tsx` (new)
  - ✅ `ftm-frontend/src/app/sectors/[id]/page.tsx` (new)
  - ✅ `ftm-frontend/src/components/Sidebar.tsx`
  - ✅ `ftm-frontend/e2e/mock-backend.mjs`
  - ✅ `ftm-frontend/e2e/pages.spec.ts`
  - ✅ `context/mockups/sectors-index.html` (redesigned)
  - ✅ `context/mockups/sector-drilldown.html` (redesigned)

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
