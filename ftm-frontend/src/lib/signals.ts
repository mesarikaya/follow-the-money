export type TradeSignal = "BUY" | "WATCH" | "HOLD" | "REDUCE";

export type SignalSource = {
  compositeScore: number | null;
  rrgQuadrant: string | null;
  compositeTrend20d: number | null;
};

export function deriveTradeSignal(cat: SignalSource): TradeSignal | null {
  const score = cat.compositeScore;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;

  if (score == null) return null;

  const improving = quadrant === 3 || quadrant === 4;
  const weakening = quadrant === 1 || quadrant === 2;
  const trending = trend20d != null && trend20d > 0;

  if (score >= 0.65 && improving && trending) return "BUY";
  if (score >= 0.50 && (improving || trending)) return "WATCH";
  if (score < 0.35 && weakening) return "REDUCE";
  return "HOLD";
}

export function countBuyConditions(cat: SignalSource): number {
  const score = cat.compositeScore;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;
  if (score == null) return 0;
  let count = 0;
  if (score >= 0.65) count++;
  if (quadrant === 3 || quadrant === 4) count++;
  if (trend20d != null && trend20d > 0) count++;
  return count;
}

export function missingBuyConditions(cat: SignalSource): string[] {
  const score = cat.compositeScore ?? 0;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;
  const missing: string[] = [];
  if (score < 0.65) missing.push(`score ${Math.round(score * 100)}<65`);
  if (quadrant !== 3 && quadrant !== 4) missing.push("RRG not improving");
  if (trend20d == null || trend20d <= 0) missing.push("trend negative");
  return missing;
}
