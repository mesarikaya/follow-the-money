import { ApproachingSignalDto, CategorySummary, SignalTransitionDto, SignalWinRateDto } from "./api";

export type Urgency = "NOW" | "THIS WEEK" | "MONITOR";
export type ActionVerb = "ENTRY" | "ADD" | "TRIM" | "AVOID" | "WATCH";

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
};

const VERB_PRIORITY: Record<ActionVerb, number> = {
  ENTRY: 1,
  TRIM:  2,
  AVOID: 3,
  ADD:   4,
  WATCH: 5,
};

const URGENCY_WEIGHT: Record<Urgency, number> = {
  NOW:       0,
  "THIS WEEK": 10,
  MONITOR:   20,
};

export function derivePriorityActions(
  categories: CategorySummary[],
  approachingSignals: ApproachingSignalDto[],
  signalTransitions: SignalTransitionDto[],
  winRateByCategory: Record<string, SignalWinRateDto>,
): PriorityAction[] {
  const seen = new Set<string>();
  const candidates: Omit<PriorityAction, "rank">[] = [];

  const winPct = (id: string) => {
    const wr = winRateByCategory[id];
    return wr ? Math.round(wr.buyWinRate * 100) : null;
  };

  // 1 — HIGH confidence approaching BUY (≤7d) — entry window is open NOW
  for (const s of approachingSignals) {
    if (s.confidence === "HIGH" && s.projectedSignal === "BUY") {
      seen.add(s.categoryId);
      candidates.push({
        verb: "ENTRY",
        etfTicker: s.etfTicker,
        categoryName: s.categoryName,
        categoryId: s.categoryId,
        signal: s.currentSignal,
        rationale: `BUY threshold in ${s.estimatedDays}d at current momentum (+${(s.dailyVelocity * 100).toFixed(2)}pt/day)`,
        urgency: "NOW",
        winRatePct: winPct(s.categoryId),
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
      candidates.push({
        verb: "TRIM",
        etfTicker: cat.etfTicker,
        categoryName: cat.name,
        categoryId: cat.id,
        signal: "REDUCE",
        rationale: `REDUCE + ${cat.rrgQuadrant === "1" ? "Lagging" : "Weakening"} quadrant + falling momentum — deterioration confirmed`,
        urgency: "NOW",
        winRatePct: null,
      });
    }
  }

  // 3 — Fresh BUY transition within 3 days
  for (const t of signalTransitions) {
    if (seen.has(t.categoryId)) continue;
    if (t.currentSignal === "BUY" && t.daysAgo <= 3) {
      seen.add(t.categoryId);
      const conviction = t.convictionScore ? ` (conviction ${Math.round(t.convictionScore * 100)}%)` : "";
      candidates.push({
        verb: "ADD",
        etfTicker: t.etfTicker,
        categoryName: t.categoryName,
        categoryId: t.categoryId,
        signal: "BUY",
        rationale: `Fresh BUY signal ${t.daysAgo === 0 ? "today" : `${t.daysAgo}d ago`}${conviction} — score ${Math.round(t.currentScore * 100)}`,
        urgency: "THIS WEEK",
        winRatePct: winPct(t.categoryId),
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
      candidates.push({
        verb: "ADD",
        etfTicker: cat.etfTicker,
        categoryName: cat.name,
        categoryId: cat.id,
        signal: "BUY",
        rationale: `BUY + Leading quadrant + positive 5d momentum — institutional accumulation pattern`,
        urgency: "THIS WEEK",
        winRatePct: winPct(cat.id),
      });
    }
  }

  // 6 — MEDIUM confidence approaching BUY (8-15d) — monitor for entry
  for (const s of approachingSignals) {
    if (seen.has(s.categoryId)) continue;
    if (s.confidence === "MEDIUM" && s.projectedSignal === "BUY") {
      seen.add(s.categoryId);
      candidates.push({
        verb: "WATCH",
        etfTicker: s.etfTicker,
        categoryName: s.categoryName,
        categoryId: s.categoryId,
        signal: s.currentSignal,
        rationale: `BUY threshold in ~${s.estimatedDays}d at current pace — set price alert for entry`,
        urgency: "MONITOR",
        winRatePct: winPct(s.categoryId),
      });
    }
  }

  // Sort: verb priority first, then urgency weight, cap at 5
  candidates.sort((a, b) => {
    const pa = VERB_PRIORITY[a.verb] + URGENCY_WEIGHT[a.urgency];
    const pb = VERB_PRIORITY[b.verb] + URGENCY_WEIGHT[b.urgency];
    return pa - pb;
  });

  return candidates.slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 }));
}
