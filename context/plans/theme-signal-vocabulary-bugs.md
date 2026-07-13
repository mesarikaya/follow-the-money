# Theme Signal Vocabulary — Bug Fix Plan

Found while refactoring the theme pages (EP-101, #153). Not fixed there: a refactor must not change
behaviour, and every one of these changes what the app outputs.

---

## 1. The root cause

Two string vocabularies exist for the same two concepts. The producers emit one; some consumers still
read an older one. Nothing type-checks the pair, so the mismatches fail **silently** — a badge that
never renders, a scoring factor that always returns zero.

| Concept | What the backend actually emits | The stale vocabulary still being read |
|---|---|---|
| `phaseTransitionSignal` | `APPROACHING_BUY`, `BREAKOUT_AT_RISK`, `EARLY_RECOVERY`, `DISTRIBUTION` (`themes/transition/*TransitionRule`) | `WATCH_FOR_ENTRY`, `APPROACHING_EXIT`, `CYCLE_RESET` |
| `entryAction` | `ENTER`, `SCALE_IN`, `WATCH`, `AVOID` (enum `themes/entry/EntryAction`) | `ENTER`, `WAIT`, `AVOID` |

## 2. The four bugs

**B1 — `PhaseTransitionFactor` always scores 0 (backend, worst one).**
`themes/confluence/PhaseTransitionFactor` switches on `WATCH_FOR_ENTRY` / `CYCLE_RESET` /
`APPROACHING_EXIT`. The detector emits none of them, so every theme falls through to `default -> 0`.
Its **15% weight in the confluence score is dead**: `confluenceScore` and `confidenceLabel` have been
computed as if phase transitions never happen — and because confluence feeds the Investment Quality
Score, the IQS grade is affected too.

**B2 — `EntryTimingFactor` under-scores two of the four actions (backend).**
It scores `ENTER` (+3), `WAIT` (0 — never emitted) and `AVOID` (−3). `SCALE_IN` and `WATCH` hit
`default -> 0`. `SCALE_IN` is a bullish action being scored as neutral.

**B3 — the detail page's phase-transition badge has never rendered (frontend).**
`components/themes/detailPanels.tsx` → `PHASE_TRANSITION_CONFIG` is keyed by the stale vocabulary,
so the lookup misses and the badge returns `null` for every theme.

**B4 — the detail page's entry-advice card is blank for `SCALE_IN` and `WATCH` (frontend).**
`ENTRY_ACTION_CONFIG` in the same file has `ENTER` / `WAIT` / `AVOID`. A theme the backend says to
`SCALE_IN` shows **no entry advice at all**.

Note the screener (`components/themes/badges.tsx`) is *correct* on both counts — only the detail page
and the two confluence factors are stale.

## 3. The fix, in order

Each step is one PR, each is a behaviour change, each is independently revertible.

- **Step 1 — one source of truth (backend).** Make `phaseTransitionSignal` an enum
  (`themes/transition/PhaseTransitionSignal`) the way `EntryAction` already is, and have the rules
  and DTO carry it. Then switch the confluence factors over the **enum**, not over strings, so the
  compiler rejects a missing case instead of silently scoring 0. This is what stops the bug class
  from recurring; it is not a behaviour change on its own.
- **Step 2 — fix `PhaseTransitionFactor` (B1).** Score the four real signals. Proposed, mirroring
  the intent of the old table: `APPROACHING_BUY +2`, `EARLY_RECOVERY +1`, `BREAKOUT_AT_RISK −2`,
  `DISTRIBUTION −2`. **Confirm these weights before merging** — they move every theme's
  `confluenceScore`, `confidenceLabel` and IQS grade.
- **Step 3 — fix `EntryTimingFactor` (B2).** Score the enum exhaustively: `ENTER +3`,
  `SCALE_IN +2`, `WATCH 0`, `AVOID −3`. Same caveat: it moves confluence scores.
- **Step 4 — fix the detail page (B3, B4).** Re-key `PHASE_TRANSITION_CONFIG` and
  `ENTRY_ACTION_CONFIG` to the real vocabulary, adding the missing `SCALE_IN` entry. Cheapest step,
  no backend risk — could go first if we want a visible win immediately.

## 4. How each step is verified

- Steps 1–3: `ConfluenceFactorTest` and `ConfluenceScoreServiceTest` currently *encode the bug*
  (`ConfluenceScoreServiceTest` passes `"WATCH_FOR_ENTRY"` as an input). They must be rewritten to
  the real vocabulary — that rewrite is the proof. Full `./mvnw test` on CI.
- Step 4: Playwright e2e, plus one look at a theme detail page for a theme currently in `SCALE_IN`
  to confirm the entry card and the transition badge now appear.
- Because steps 2–3 shift `confluenceScore` for every theme, capture the before/after scores for all
  themes (`GET /api/v1/themes`) and eyeball the diff rather than trusting the tests alone.

## 5. What we are NOT doing

- Not touching the screener's badge configs — they are already right.
- Not tuning the *thresholds* of the rules themselves. This plan makes the existing rules count; it
  does not re-tune the model.
