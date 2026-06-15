import { ApproachingSignalDto, CategorySummary, PriceLevelDto, SignalTransitionDto, SignalWinRateDto } from "./api";

export type Urgency = "NOW" | "THIS WEEK" | "MONITOR";
export type ActionVerb = "ENTRY" | "ADD" | "TRIM" | "AVOID" | "WATCH";

export type ConvictionTier = "HIGH" | "MEDIUM" | "LOW";

export type PriorityAction = {
  rank: number;
  verb: ActionVerb;
  etfTicker: string;
  categoryName: string;
  categoryId: string;
  signal: string;
  rationale: string;
  urgency: Urgency;
  winRatePct: number | null;
  priceContext: string | null;
  riskNote: string | null;
  conviction: ConvictionTier;
  sizingHint: string;
};

const VERB_PRIORITY: Record<ActionVerb, number> = {
  ENTRY: 1,
  TRIM:  2,
  AVOID: 3,
  ADD:   4,
  WATCH: 5,
};

const URGENCY_WEIGHT: Record<Urgency, number> = {
  NOW:         0,
  "THIS WEEK": 10,
  MONITOR:     20,
};

function buildPriceContext(pl: PriceLevelDto | undefined): string | null {
  if (!pl || pl.currentPrice == null) return null;
  const parts: string[] = [];
  if (pl.positionInRange != null) {
    parts.push(`${Math.round(pl.positionInRange * 100)}% of 52w range`);
  }
  if (pl.drawdownFromHigh != null) {
    const dd = Math.abs(pl.drawdownFromHigh * 100);
    parts.push(`${dd.toFixed(1)}% off high`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function computeConviction(
  verb: ActionVerb,
  cat: CategorySummary | undefined,
  winRatePct: number | null,
): { conviction: ConvictionTier; sizingHint: string } {
  const pct = cat?.scorePercentile252d ?? null;
  const macroFit = cat?.macroFit ?? null;
  const improvingQuadrant = cat?.rrgQuadrant === "3" || cat?.rrgQuadrant === "4";

  if (verb === "ENTRY" || verb === "ADD") {
    const highScorePct = pct != null && pct > 0.75;
    const strongMacro = macroFit != null && macroFit > 0.6;
    const goodWinRate = winRatePct != null && winRatePct >= 60;
    if ((highScorePct || strongMacro) && improvingQuadrant && goodWinRate) {
      return { conviction: "HIGH", sizingHint: "Full position (4–6%)" };
    }
    if (pct != null && pct > 0.50 || strongMacro) {
      return { conviction: "MEDIUM", sizingHint: "Half position (2–3%)" };
    }
    return { conviction: "LOW", sizingHint: "Starter (1–2%), add on confirmation" };
  }

  if (verb === "TRIM" || verb === "AVOID") {
    const lowPct = pct != null && pct < 0.25;
    const weakMacro = macroFit != null && macroFit < 0.40;
    if (lowPct && weakMacro) {
      return { conviction: "HIGH", sizingHint: "Exit position fully" };
    }
    if (lowPct || weakMacro) {
      return { conviction: "MEDIUM", sizingHint: "Trim to half position" };
    }
    return { conviction: "LOW", sizingHint: "Trim 25% — monitor for confirmation" };
  }

  return { conviction: "LOW", sizingHint: "No action yet — set alert" };
}

function buildRiskNote(
  verb: ActionVerb,
  pl: PriceLevelDto | undefined,
  cat: CategorySummary | undefined,
): string | null {
  if (verb === "ENTRY" || verb === "ADD") {
    if (pl == null) return null;
    if (pl.positionInRange != null && pl.positionInRange > 0.85) {
      return "Near 52w high — use a tight stop; momentum extension risk.";
    }
    if (pl.drawdownFromHigh != null && Math.abs(pl.drawdownFromHigh) > 0.15) {
      return "Significant drawdown from high — confirm momentum is recovering, not a dead-cat bounce.";
    }
    if (pl.positionInRange != null && pl.positionInRange < 0.30) {
      return "At low end of 52w range — strong momentum required before sizing up.";
    }
  }
  if (verb === "TRIM" || verb === "AVOID") {
    if (cat?.macroFit != null && cat.macroFit > 0.6) {
      return "Macro regime still broadly supportive — consider partial trim rather than full exit.";
    }
    if (pl?.positionInRange != null && pl.positionInRange < 0.20) {
      return "Already near 52w low — may be late to trim; evaluate vs original thesis.";
    }
  }
  if (verb === "WATCH") {
    return "Confirm signal after threshold cross before entering — velocity can reverse.";
  }
  return null;
}

export function derivePriorityActions(
  categories: CategorySummary[],
  approachingSignals: ApproachingSignalDto[],
  signalTransitions: SignalTransitionDto[],
  winRateByCategory: Record<string, SignalWinRateDto>,
  priceLevelByCategory: Record<string, PriceLevelDto> = {},
): PriorityAction[] {
  const seen = new Set<string>();
  const candidates: Omit<PriorityAction, "rank">[] = [];
  const catById: Record<string, CategorySummary> = {};
  categories.forEach(c => { catById[c.id] = c; });

  const winPct = (id: string) => {
    const wr = winRateByCategory[id];
    return wr ? Math.round(wr.buyWinRate * 100) : null;
  };

  const priceCtx = (id: string) => buildPriceContext(priceLevelByCategory[id]);
  const risk = (verb: ActionVerb, id: string) =>
    buildRiskNote(verb, priceLevelByCategory[id], catById[id]);
  const conv = (verb: ActionVerb, id: string, wp: number | null) =>
    computeConviction(verb, catById[id], wp);

  // 1 — HIGH confidence approaching BUY (≤7d) — entry window is open NOW
  for (const s of approachingSignals) {
    if (s.confidence === "HIGH" && s.projectedSignal === "BUY") {
      seen.add(s.categoryId);
      const wp = winPct(s.categoryId);
      candidates.push({
        verb: "ENTRY",
        etfTicker: s.etfTicker,
        categoryName: s.categoryName,
        categoryId: s.categoryId,
        signal: s.currentSignal,
        rationale: `BUY threshold in ${s.estimatedDays}d at current momentum (+${(s.dailyVelocity * 100).toFixed(2)}pt/day)`,
        urgency: "NOW",
        winRatePct: wp,
        priceContext: priceCtx(s.categoryId),
        riskNote: risk("ENTRY", s.categoryId),
        ...conv("ENTRY", s.categoryId, wp),
      });
    }
  }

  // 2 — REDUCE signal + weakening quadrant (1 or 2) + falling momentum — cut position NOW
  for (const cat of categories) {
    if (seen.has(cat.id)) continue;
    const isReduce = cat.tradeSignal === "REDUCE";
    const isWeakening = cat.rrgQuadrant === "1" || cat.rrgQuadrant === "2";
    const falling = (cat.compositeTrend5d ?? 0) < -0.005;
    if (isReduce && isWeakening && falling) {
      seen.add(cat.id);
      const quadrantLabel = cat.rrgQuadrant === "1" ? "Lagging" : "Weakening";
      candidates.push({
        verb: "TRIM",
        etfTicker: cat.etfTicker,
        categoryName: cat.name,
        categoryId: cat.id,
        signal: "REDUCE",
        rationale: `REDUCE + ${quadrantLabel} quadrant + falling momentum — deterioration confirmed`,
        urgency: "NOW",
        winRatePct: null,
        priceContext: priceCtx(cat.id),
        riskNote: risk("TRIM", cat.id),
        ...conv("TRIM", cat.id, null),
      });
    }
  }

  // 3 — Fresh BUY transition within 3 days
  for (const t of signalTransitions) {
    if (seen.has(t.categoryId)) continue;
    if (t.currentSignal === "BUY" && t.daysAgo <= 3) {
      seen.add(t.categoryId);
      const wp = winPct(t.categoryId);
      const cvNote = t.convictionScore ? ` (conviction ${Math.round(t.convictionScore * 100)}%)` : "";
      candidates.push({
        verb: "ADD",
        etfTicker: t.etfTicker,
        categoryName: t.categoryName,
        categoryId: t.categoryId,
        signal: "BUY",
        rationale: `Fresh BUY signal ${t.daysAgo === 0 ? "today" : `${t.daysAgo}d ago`}${cvNote} — score ${Math.round(t.currentScore * 100)}`,
        urgency: "THIS WEEK",
        winRatePct: wp,
        priceContext: priceCtx(t.categoryId),
        riskNote: risk("ADD", t.categoryId),
        ...conv("ADD", t.categoryId, wp),
      });
    }
  }

  // 4 — Fresh REDUCE transition within 3 days
  for (const t of signalTransitions) {
    if (seen.has(t.categoryId)) continue;
    if (t.currentSignal === "REDUCE" && t.daysAgo <= 3) {
      seen.add(t.categoryId);
      candidates.push({
        verb: "AVOID",
        etfTicker: t.etfTicker,
        categoryName: t.categoryName,
        categoryId: t.categoryId,
        signal: "REDUCE",
        rationale: `Signal just crossed to REDUCE (${t.daysAgo === 0 ? "today" : `${t.daysAgo}d ago`}) — score ${Math.round(t.currentScore * 100)}`,
        urgency: "THIS WEEK",
        winRatePct: null,
        priceContext: priceCtx(t.categoryId),
        riskNote: risk("AVOID", t.categoryId),
        ...conv("AVOID", t.categoryId, null),
      });
    }
  }

  // 5 — BUY in Leading quadrant with positive 5d trend — add to winners
  for (const cat of categories) {
    if (seen.has(cat.id)) continue;
    if (
      cat.tradeSignal === "BUY" &&
      cat.rrgQuadrant === "4" &&
      (cat.compositeTrend5d ?? 0) > 0.005
    ) {
      seen.add(cat.id);
      const wp = winPct(cat.id);
      candidates.push({
        verb: "ADD",
        etfTicker: cat.etfTicker,
        categoryName: cat.name,
        categoryId: cat.id,
        signal: "BUY",
        rationale: `BUY + Leading quadrant + positive 5d momentum — institutional accumulation pattern`,
        urgency: "THIS WEEK",
        winRatePct: wp,
        priceContext: priceCtx(cat.id),
        riskNote: risk("ADD", cat.id),
        ...conv("ADD", cat.id, wp),
      });
    }
  }

  // 6 — MEDIUM confidence approaching BUY (8-15d) — monitor for entry
  for (const s of approachingSignals) {
    if (seen.has(s.categoryId)) continue;
    if (s.confidence === "MEDIUM" && s.projectedSignal === "BUY") {
      seen.add(s.categoryId);
      const wp = winPct(s.categoryId);
      candidates.push({
        verb: "WATCH",
        etfTicker: s.etfTicker,
        categoryName: s.categoryName,
        categoryId: s.categoryId,
        signal: s.currentSignal,
        rationale: `BUY threshold in ~${s.estimatedDays}d at current pace — set price alert for entry`,
        urgency: "MONITOR",
        winRatePct: wp,
        priceContext: priceCtx(s.categoryId),
        riskNote: risk("WATCH", s.categoryId),
        ...conv("WATCH", s.categoryId, wp),
      });
    }
  }

  candidates.sort((a, b) => {
    const pa = VERB_PRIORITY[a.verb] + URGENCY_WEIGHT[a.urgency];
    const pb = VERB_PRIORITY[b.verb] + URGENCY_WEIGHT[b.urgency];
    return pa - pb;
  });

  return candidates.slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 }));
}
