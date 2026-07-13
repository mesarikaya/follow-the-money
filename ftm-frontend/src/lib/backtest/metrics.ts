import { EquityCurvePoint } from "@/lib/api";

/**
 * Pure backtest metric computations extracted from the backtest page so they can be unit-tested and
 * reused independently of the chart components. Every function is deterministic and depends only on
 * the equity curve (and, for regimes, the macro-regime history) — no React, no formatting.
 */

export type DrawdownPeriod = {
  startDate: string;
  troughDate: string;
  endDate: string | null;
  depthPct: number;
  durationDays: number;
  recoveryDays: number | null;
};

/** The five deepest peak-to-trough drawdowns (≥2%) of the portfolio (or SPY) curve, deepest first. */
export const computeDrawdownPeriods = (curve: EquityCurvePoint[], useSpy = false): DrawdownPeriod[] => {
  if (curve.length < 2) return [];
  const getValue = (pt: EquityCurvePoint) => (useSpy ? pt.spyValue : pt.portfolioValue);
  const periods: DrawdownPeriod[] = [];
  let peakIdx = 0;
  let peakVal = getValue(curve[0]);
  let inDrawdown = false;
  let startIdx = 0;
  let troughIdx = 0;
  let troughVal = peakVal;

  for (let i = 1; i < curve.length; i++) {
    const v = getValue(curve[i]);
    if (v >= peakVal) {
      if (inDrawdown) {
        const depthPct = (1 - troughVal / peakVal) * 100;
        if (depthPct >= 2) {
          const durationDays = i - startIdx;
          const recoveryDays = i - troughIdx;
          periods.push({ startDate: curve[startIdx].date, troughDate: curve[troughIdx].date, endDate: curve[i].date, depthPct, durationDays, recoveryDays });
        }
        inDrawdown = false;
      }
      peakVal = v;
      peakIdx = i;
    } else {
      if (!inDrawdown) {
        inDrawdown = true;
        startIdx = peakIdx;
        troughIdx = i;
        troughVal = v;
      } else if (v < troughVal) {
        troughIdx = i;
        troughVal = v;
      }
    }
  }
  if (inDrawdown && peakVal > 0) {
    const depthPct = (1 - troughVal / peakVal) * 100;
    if (depthPct >= 2) {
      periods.push({ startDate: curve[startIdx].date, troughDate: curve[troughIdx].date, endDate: null, depthPct, durationDays: curve.length - 1 - startIdx, recoveryDays: null });
    }
  }
  return periods.sort((a, b) => b.depthPct - a.depthPct).slice(0, 5);
}

export type RiskAttribution = {
  beta: number | null;
  correlation: number | null;
  capmAlphaDailyAnn: number | null;
  trackingError: number;
  informationRatio: number | null;
  upCapture: number | null;
  downCapture: number | null;
};

/** Beta/correlation/alpha/capture ratios of the strategy vs SPY, from daily returns. */
export const computeRiskAttribution = (curve: EquityCurvePoint[]): RiskAttribution | null => {
  if (curve.length < 30) return null;
  const portRet: number[] = [];
  const spyRet: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    portRet.push(curve[i].portfolioValue / curve[i - 1].portfolioValue - 1);
    spyRet.push(curve[i].spyValue / curve[i - 1].spyValue - 1);
  }
  const n = portRet.length;
  const meanPort = portRet.reduce((s, r) => s + r, 0) / n;
  const meanSpy = spyRet.reduce((s, r) => s + r, 0) / n;
  let covPS = 0, varSpy = 0, varPort = 0;
  for (let i = 0; i < n; i++) {
    covPS += (portRet[i] - meanPort) * (spyRet[i] - meanSpy);
    varSpy += (spyRet[i] - meanSpy) ** 2;
    varPort += (portRet[i] - meanPort) ** 2;
  }
  covPS /= n;
  varSpy /= n;
  varPort /= n;
  const beta = varSpy > 0 ? covPS / varSpy : null;
  const correlation = varSpy > 0 && varPort > 0 ? covPS / Math.sqrt(varSpy * varPort) : null;
  const capmAlphaDailyAnn = beta != null ? (meanPort - beta * meanSpy) * 252 : null;
  const diffRet = portRet.map((p, i) => p - spyRet[i]);
  const meanDiff = diffRet.reduce((s, r) => s + r, 0) / n;
  const varDiff = diffRet.reduce((s, r) => s + (r - meanDiff) ** 2, 0) / n;
  const trackingError = Math.sqrt(varDiff * 252);

  const upDays = portRet.filter((_, i) => spyRet[i] > 0);
  const upSpy = spyRet.filter(r => r > 0);
  const downDays = portRet.filter((_, i) => spyRet[i] < 0);
  const downSpy = spyRet.filter(r => r < 0);
  const upCapture = upDays.length > 0 && upSpy.length > 0
    ? (upDays.reduce((s, r) => s + r, 0) / upDays.length) / (upSpy.reduce((s, r) => s + r, 0) / upSpy.length) * 100
    : null;
  const downCapture = downDays.length > 0 && downSpy.length > 0
    ? (downDays.reduce((s, r) => s + r, 0) / downDays.length) / (downSpy.reduce((s, r) => s + r, 0) / downSpy.length) * 100
    : null;
  const informationRatio = trackingError > 0 ? (meanDiff * 252) / trackingError : null;
  return { beta, correlation, capmAlphaDailyAnn, trackingError: trackingError * 100, informationRatio, upCapture, downCapture };
}

export type MonthlyReturn = { ym: string; year: number; month: number; port: number; spy: number };

/** Month-over-month returns of the portfolio and SPY (using each month's last curve point). */
export const computeMonthlyReturns = (curve: EquityCurvePoint[]): MonthlyReturn[] => {
  if (curve.length < 2) return [];
  const monthEnd = new Map<string, { portfolio: number; spy: number }>();
  for (const pt of curve) {
    const ym = pt.date.slice(0, 7);
    monthEnd.set(ym, { portfolio: pt.portfolioValue, spy: pt.spyValue });
  }
  const sortedMonths = Array.from(monthEnd.keys()).sort();
  const rows: MonthlyReturn[] = [];
  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = monthEnd.get(sortedMonths[i - 1])!;
    const curr = monthEnd.get(sortedMonths[i])!;
    const [yr, mo] = sortedMonths[i].split("-").map(Number);
    rows.push({ ym: sortedMonths[i], year: yr, month: mo, port: curr.portfolio / prev.portfolio - 1, spy: curr.spy / prev.spy - 1 });
  }
  return rows;
}

export type AnnualReturn = { yr: number; port: number; spy: number };

/** Calendar-year returns, chaining from the prior year's last month-end when available. */
export const computeAnnualReturns = (curve: EquityCurvePoint[]): AnnualReturn[] => {
  if (curve.length < 2) return [];
  const monthEnd = new Map<string, { portfolio: number; spy: number }>();
  for (const pt of curve) monthEnd.set(pt.date.slice(0, 7), { portfolio: pt.portfolioValue, spy: pt.spyValue });
  const sortedYears = Array.from(new Set(Array.from(monthEnd.keys()).map(ym => Number(ym.slice(0, 4))))).sort();
  return sortedYears.map(yr => {
    const yrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr))).sort();
    const prevYrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr - 1))).sort();
    const startVal = prevYrMonths.length > 0 ? monthEnd.get(prevYrMonths[prevYrMonths.length - 1])! : monthEnd.get(yrMonths[0])!;
    const endVal = monthEnd.get(yrMonths[yrMonths.length - 1])!;
    return { yr, port: endVal.portfolio / startVal.portfolio - 1, spy: endVal.spy / startVal.spy - 1 };
  });
}

/** Annualized Sortino ratio (downside-deviation risk-adjusted return) of the portfolio (or SPY). */
export const computeSortino = (curve: EquityCurvePoint[], useSpy: boolean): number | null => {
  if (curve.length < 2) return null;
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = useSpy ? curve[i - 1].spyValue : curve[i - 1].portfolioValue;
    const curr = useSpy ? curve[i].spyValue : curve[i].portfolioValue;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  if (returns.length === 0) return null;
  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const downsideVariance = returns.reduce((s, r) => s + Math.pow(Math.min(r, 0), 2), 0) / returns.length;
  const downsideStd = Math.sqrt(downsideVariance);
  if (downsideStd === 0) return null;
  return (meanReturn / downsideStd) * Math.sqrt(252);
}

export type RegimeBreakdown = {
  regime: string;
  days: number;
  portReturn: number;
  spyReturn: number;
};

/** Compounded portfolio vs SPY return within each macro regime, by extending weekly regimes forward. */
export const computeRegimeBreakdown = (
  curve: EquityCurvePoint[],
  history: { date: string; regime: string }[],
): RegimeBreakdown[] => {
  if (curve.length < 2 || history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  const regimeByDate: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].date;
    const end = sorted[i + 1]?.date ?? "9999-99-99";
    for (const pt of curve) {
      if (pt.date >= start && pt.date < end) {
        regimeByDate[pt.date] = sorted[i].regime;
      }
    }
  }

  const regimeGroups: Record<string, { portValues: number[]; spyValues: number[] }> = {};
  for (const pt of curve) {
    const regime = regimeByDate[pt.date];
    if (!regime) continue;
    if (!regimeGroups[regime]) regimeGroups[regime] = { portValues: [], spyValues: [] };
    regimeGroups[regime].portValues.push(pt.portfolioValue);
    regimeGroups[regime].spyValues.push(pt.spyValue);
  }

  return Object.entries(regimeGroups).map(([regime, { portValues, spyValues }]) => {
    const portReturn = portValues.length > 1 ? (portValues[portValues.length - 1] / portValues[0] - 1) * 100 : 0;
    const spyReturn = spyValues.length > 1 ? (spyValues[spyValues.length - 1] / spyValues[0] - 1) * 100 : 0;
    return { regime, days: portValues.length, portReturn, spyReturn };
  }).sort((a, b) => b.days - a.days);
}
