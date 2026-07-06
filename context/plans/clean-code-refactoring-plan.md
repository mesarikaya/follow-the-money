# Clean Code & SOLID Refactoring Plan

**Goal:** Restructure the backend and frontend so that any single implementation is small,
single-purpose, and readable — a non-developer should be able to open one file and follow what it
does. Behaviour must not change: this is pure refactoring, verified by tests at every step.

**Not in scope:** new features, bug fixes, or behaviour changes. If a bug is found mid-refactor, it
gets its own separate PR — never mixed into a refactor commit.

---

## 1. Definition of Done (how we know a file is "clean enough")

A file passes when all of these are true:

- **One reason to exist.** The file/class does one job; its name says exactly what that job is.
- **Readable top-to-bottom.** A non-developer can read the method names in order and understand the
  flow without reading the bodies.
- **Small.** Backend: a class is a smell past ~200 lines and a hard look past ~300. Frontend: a
  component past ~150 lines, a page past ~200, is a smell.
- **No mixed layers.** HTTP handling, business rules, data access, and presentation live in
  different files (see §2).
- **Descriptive names, no abbreviations** (project convention: `assetsUnderManagementUsd`, not
  `aum`). Booleans read as questions (`isStale`, `hasPriceData`).
- **No dead code, no commented-out code, no "and also" helpers** that belong elsewhere.

---

## 2. Target Architecture (the standard every change moves toward)

### Backend (Java / Spring)

A request flows through one direction only:

```
Controller  →  Service (orchestration)  →  Calculator/Domain (pure logic)  →  Repository (data)
  HTTP only     "what steps happen"          "the maths/rules"                 "load/save"
```

- **Controller** — parse request, call one service method, return response. No business logic.
- **Service** — orchestrates a use case; delegates maths to pure calculators and data to
  repositories. Reads like a recipe.
- **Calculator / domain component** — pure, stateless `@Component`, constructor-injected, no DB.
  Directly unit-testable (this is already the pattern for `MomentumScoreComputer`,
  `AllocationComputer`, `CategoryHierarchyResolver` — we extend it).
- **Repository** — the only place that talks to jOOQ/SQL.
- **Composition over inheritance; constructor injection; one public class per file.**
- Package by feature (`portfolio`, `backtest`, `signals`, `alerts`, `themes`), not by layer. Fold
  the leftover `api.service.*` domain logic into its feature package.

### Frontend (Next.js / React / TypeScript)

```
page.tsx        →  hooks (use…)        →  lib (pure logic)     →  presentational components
"assemble the      "fetch + state"        "format/derive"          "given props, render"
 page"                                                              (no fetch, no business rules)
```

- **Page** — thin. Calls hooks, lays out presentational components. Almost no logic.
- **Hook (`usePortfolio`, `useHoldings`)** — owns data fetching and state for one concern.
- **lib/** — pure functions (formatting, derivations). No React, trivially testable.
- **Presentational component** — receives data via props and renders it. No `fetch`, no business
  rules. A designer/non-dev can read it.
- **`api.ts` split by domain** — one module per area (`api/portfolio.ts`, `api/backtest.ts`,
  `api/themes.ts`, …) plus shared `types`.

---

## 3. Prerequisites (do first, in order)

0. **Merge the open feature PRs to `main`:** #106 → #107 → #108. They rewrite `PortfolioService`,
   `AlignmentService`, the portfolio DTOs, `api.ts`, and `HoldingPriceService` — all on the refactor
   list. Refactoring before they land guarantees conflicts. **The refactor branches off `main` only
   after these are merged.**

---

## 4. Safety Nets (behaviour preservation — non-negotiable per step)

- **Backend:** full `./mvnw test` green after every step. For `AlertRulesEngine` specifically, add a
  **golden-master test first** — capture the exact alerts produced for a fixed signal-date input,
  then assert byte-identical output after each rule is extracted.
- **Frontend:** `tsc` proves it compiles, not that it works. The real gate is the **Playwright e2e
  suite** (`e2e/pages.spec.ts` + `mock-backend.mjs`) — run it green for every page decomposition.
- **One unit of work per PR.** Small, reviewable, independently revertible.

---

## 5. Phased Steps (small, one PR each)

### Phase 1 — Standard + exemplars (STOP for confirmation after this)

- **1.1** This document (the standard). ✅ *(you're reading it)*
- **1.2 Backend exemplar:** extract **one** alert rule from `AlertRulesEngine` into a standalone
  `AlertRule` component behind a small interface, wired via an injected list. Add the golden-master
  first. Prove the pattern on one rule.
- **1.3 Frontend exemplar:** decompose `app/portfolio/page.tsx` (1,520 lines) into a thin page +
  `usePortfolio`/`useHoldings` hooks + pure `lib` helpers + presentational components. e2e green.
- **➡ GATE:** confirm "yes, this is the readability I meant" before scaling to everything else.

### Phase 2 — Mechanical, high-value, low-risk

- **2.1** Split `lib/api.ts` (792 lines) into `lib/api/*` by domain + shared types. Pure move, no
  logic change.

### Phase 3 — `AlertRulesEngine` (3,764 lines → the flagship)

Apply the Phase-1.2 pattern to the remaining ~20 rules, **one rule per PR**:
- **3.x** Move `evaluateRotationEventAlerts`, `evaluateMacroRegimeShift`, `evaluatePersistenceLow`,
  `evaluateRsAccelerationCrossover`, `evaluateBreadthVelocity`, `evaluateTradeSignalTransitions`,
  `evaluateApproaching{Buy,Reduce}Signal`, `evaluateHighConviction{Buy,Cluster,ReduceCluster}`,
  `evaluateSignalDeterioration`, `evaluateRsAligned{Bull,Bear}`, … each into its own `AlertRule`.
- **End state:** `AlertRulesEngine` is a thin orchestrator over `List<AlertRule>`; adding a rule = a
  new file (Open/Closed). Golden-master stays green throughout.

### Phase 4 — Remaining giant pages (one page per PR, e2e-gated)

- **4.1** `app/themes/page.tsx` (2,566) · **4.2** `app/backtest/page.tsx` (2,182) ·
  **4.3** `app/themes/[id]/page.tsx` (1,130) · **4.4** `app/flows/page.tsx` (937) ·
  **4.5** `app/sectors/page.tsx` (929) · **4.6** `components/CategoryTable.tsx` (921).
  Same recipe: page → hooks → lib → presentational components.

### Phase 5 — Backend service cleanups (one service per PR)

- **5.1** `BacktestEngine` (566) → split data-access, simulation, and statistics responsibilities.
- **5.2** `ThemeService` (486) · **5.3** `HoldingUploadService` (454) · **5.4** `CategoryService`
  (371) · **5.5** `SignalComputationService` (369) · **5.6** `SignalRepository` (584, split by
  query area).
- **5.7** Fold `api.service.*` domain logic into feature packages; controllers keep only HTTP.

### Phase 6 — Cross-cutting polish

- **6.1** Consistent naming pass (kill remaining abbreviations). · **6.2** Consistent error/response
  handling. · **6.3** Remove dead code. · **6.4** Short `README`/header comment per package
  explaining its one job.

---

## 6. Working rules

- Branch each step off `main` (or the current refactor tip if strictly sequential); PR; CI green;
  merge; next.
- Never mix a behaviour change into a refactor PR.
- Keep each PR small enough to review in one sitting.
- After every backend step: `./mvnw test`. After every frontend step: Playwright e2e.
