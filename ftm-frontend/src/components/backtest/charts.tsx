"use client";

import { EquityCurvePoint } from "@/lib/api";
import { computeAnnualReturns } from "@/lib/backtest/metrics";

// Shared chart geometry (px).

export const CHART_W = 640;
export const CHART_H = 200;
export const PAD_L   = 48;
export const PAD_R   = 16;
export const PAD_T   = 16;
export const PAD_B   = 28;
export const ROLL_H = 110;
export const ROLL_WINDOW = 252; // 1 trading year
export const SHARPE_H = 90;
export const DD_H = 90;

export function EquityCurveChart({ curve, rebalanceDates }: { curve: EquityCurvePoint[]; rebalanceDates?: string[] }) {
  if (curve.length < 2) {
    return <p className="text-xs text-slate-500 text-center py-8">Insufficient data to draw chart.</p>;
  }

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  // Normalize to ratio starting at 1.0 so (val-1)*100 = % return
  const p0 = curve[0].portfolioValue || 1;
  const s0 = curve[0].spyValue || 1;
  const normalized = curve.map(p => ({
    date: p.date,
    portfolioValue: p.portfolioValue / p0,
    spyValue: p.spyValue / s0,
  }));

  const portfolioValues = normalized.map(p => p.portfolioValue);
  const spyValues       = normalized.map(p => p.spyValue);
  const allValues       = [...portfolioValues, ...spyValues];
  const minValue        = Math.min(...allValues);
  const maxValue        = Math.max(...allValues);
  const valueRange      = maxValue - minValue || 1;

  const toX = (i: number) => PAD_L + (i / (normalized.length - 1)) * innerW;
  const toY = (v: number) => PAD_T + (1 - (v - minValue) / valueRange) * innerH;

  const portfolioPoints = normalized.map((p, i) => `${toX(i).toFixed(1)},${toY(p.portfolioValue).toFixed(1)}`).join(" ");
  const spyPoints       = normalized.map((p, i) => `${toX(i).toFixed(1)},${toY(p.spyValue).toFixed(1)}`).join(" ");

  const fillPath = [
    `M ${toX(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)}`,
    ...normalized.map((p, i) => `L ${toX(i).toFixed(1)},${toY(p.portfolioValue).toFixed(1)}`),
    `L ${toX(normalized.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)}`,
    "Z",
  ].join(" ");

  // Alpha region segments: green where portfolio > spy, red where portfolio < spy
  type AlphaSeg = { points: { x: number; yPort: number; ySpy: number }[]; above: boolean };
  const alphaSegments: AlphaSeg[] = [];
  {
    let segPoints: AlphaSeg["points"] = [];
    let segAbove = normalized[0].portfolioValue >= normalized[0].spyValue;
    for (let i = 0; i < normalized.length; i++) {
      const x = toX(i);
      segPoints.push({ x, yPort: toY(normalized[i].portfolioValue), ySpy: toY(normalized[i].spyValue) });
      if (i < normalized.length - 1) {
        const d0 = normalized[i].portfolioValue - normalized[i].spyValue;
        const d1 = normalized[i + 1].portfolioValue - normalized[i + 1].spyValue;
        if ((d0 >= 0) !== (d1 >= 0)) {
          const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1));
          const cx = toX(i) + t * (toX(i + 1) - toX(i));
          const cv = normalized[i].portfolioValue + t * (normalized[i + 1].portfolioValue - normalized[i].portfolioValue);
          const cy = toY(cv);
          segPoints.push({ x: cx, yPort: cy, ySpy: cy });
          alphaSegments.push({ points: segPoints, above: segAbove });
          segPoints = [{ x: cx, yPort: cy, ySpy: cy }];
          segAbove = !segAbove;
        }
      }
    }
    if (segPoints.length > 0) alphaSegments.push({ points: segPoints, above: segAbove });
  }

  // Max drawdown period: find peak→trough segment with largest drawdown
  let maxDD = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;
  {
    let peak = normalized[0].portfolioValue;
    let peakI = 0;
    for (let i = 1; i < normalized.length; i++) {
      const v = normalized[i].portfolioValue;
      if (v > peak) { peak = v; peakI = i; }
      const dd = (peak - v) / peak;
      if (dd > maxDD) { maxDD = dd; ddPeakIdx = peakI; ddTroughIdx = i; }
    }
  }
  const showDD = maxDD > 0.02;

  // Y-axis grid lines: 5 horizontal lines — labels as % return from start
  const ySteps = 5;
  const yGridLines = Array.from({ length: ySteps }, (_, i) => {
    const frac = i / (ySteps - 1);
    const y    = PAD_T + frac * innerH;
    const val  = maxValue - frac * valueRange;
    const pct  = ((val - 1) * 100).toFixed(0);
    return { y, label: `${Number(pct) >= 0 ? "+" : ""}${pct}%` };
  });

  // X-axis labels: pick ~5 evenly spaced dates
  const xLabelIndices = [0, Math.floor(normalized.length * 0.25), Math.floor(normalized.length * 0.5), Math.floor(normalized.length * 0.75), normalized.length - 1];
  const xLabels = xLabelIndices.map(i => ({
    x: toX(i),
    label: normalized[i]?.date?.slice(0, 7) ?? "",
  }));

  // COVID annotation: check if Mar 2020 is in range
  const covidDate = "2020-03-01";
  const covidIdx  = normalized.findIndex(p => p.date >= covidDate);
  const showCovid = covidIdx > 0 && covidIdx < normalized.length - 1;
  const covidX    = showCovid ? toX(covidIdx) : null;

  const endPortfolioPct  = `${((normalized[normalized.length - 1].portfolioValue - 1) * 100).toFixed(1)}%`;
  const endSpyPct        = `${((normalized[normalized.length - 1].spyValue - 1) * 100).toFixed(1)}%`;
  const endStrategyY     = toY(normalized[normalized.length - 1].portfolioValue);
  const endSpyY          = toY(normalized[normalized.length - 1].spyValue);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
      {yGridLines.map(({ y, label }) => (
        <g key={y}>
          <line x1={PAD_L} y1={y.toFixed(1)} x2={CHART_W - PAD_R} y2={y.toFixed(1)} stroke="#334155" strokeWidth="0.5" />
          <text x={PAD_L - 4} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">{label}</text>
        </g>
      ))}

      {xLabels.map(({ x, label }) => (
        <text key={x} x={x.toFixed(1)} y={CHART_H - 6} fill="#64748b" fontSize="8" textAnchor="middle">{label}</text>
      ))}

      {showCovid && covidX && (
        <>
          <line x1={covidX.toFixed(1)} y1={PAD_T} x2={covidX.toFixed(1)} y2={PAD_T + innerH} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
          <text x={(covidX + 3).toFixed(1)} y={(PAD_T + 10).toFixed(1)} fill="#ef4444" fontSize="8" opacity="0.7">COVID</text>
        </>
      )}

      {/* Max drawdown period shading */}
      {showDD && (
        <>
          <rect
            x={toX(ddPeakIdx).toFixed(1)}
            y={PAD_T}
            width={Math.max(1, toX(ddTroughIdx) - toX(ddPeakIdx)).toFixed(1)}
            height={innerH}
            fill="#ef4444"
            fillOpacity="0.07"
          />
          <text
            x={((toX(ddPeakIdx) + toX(ddTroughIdx)) / 2).toFixed(1)}
            y={(PAD_T + innerH - 4).toFixed(1)}
            fill="#ef4444"
            fontSize="7"
            textAnchor="middle"
            opacity="0.5"
          >
            max DD
          </text>
        </>
      )}

      {/* Alpha region shading: green = strategy ahead, red = SPY ahead */}
      {alphaSegments.map((seg, i) => {
        const fwd = seg.points.map(p => `${p.x.toFixed(1)},${p.yPort.toFixed(1)}`).join(" L ");
        const bwd = [...seg.points].reverse().map(p => `${p.x.toFixed(1)},${p.ySpy.toFixed(1)}`).join(" L ");
        const d = `M ${fwd} L ${bwd} Z`;
        return <path key={i} d={d} fill={seg.above ? "#10b981" : "#ef4444"} fillOpacity="0.13" />;
      })}
      <path d={fillPath} fill="#3b82f6" fillOpacity="0.03" />
      <polyline points={spyPoints} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
      <polyline points={portfolioPoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx={(CHART_W - PAD_R).toFixed(1)} cy={endStrategyY.toFixed(1)} r="3" fill="#3b82f6" />
      <text x={(CHART_W - PAD_R - 5).toFixed(1)} y={(endStrategyY - 4).toFixed(1)} fill="#93c5fd" fontSize="8" textAnchor="end">{endPortfolioPct}</text>
      <circle cx={(CHART_W - PAD_R).toFixed(1)} cy={endSpyY.toFixed(1)} r="3" fill="#64748b" />
      <text x={(CHART_W - PAD_R - 5).toFixed(1)} y={(endSpyY - 4).toFixed(1)} fill="#94a3b8" fontSize="8" textAnchor="end">{endSpyPct}</text>

      {rebalanceDates && rebalanceDates.map((date) => {
        const idx = normalized.findIndex(p => p.date >= date);
        if (idx < 0) return null;
        const x = toX(idx);
        return (
          <line key={date} x1={x.toFixed(1)} y1={(PAD_T + innerH).toFixed(1)} x2={x.toFixed(1)} y2={(PAD_T + innerH + 5).toFixed(1)}
            stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
        );
      })}
    </svg>
  );
}

export function RollingReturnChart({ curve }: { curve: EquityCurvePoint[] }) {
  if (curve.length <= ROLL_WINDOW) return null;

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = ROLL_H - PAD_T - PAD_B;

  const portRolling: { date: string; ret: number }[] = [];
  const spyRolling:  { date: string; ret: number }[] = [];

  for (let i = ROLL_WINDOW; i < curve.length; i++) {
    const pPrev = curve[i - ROLL_WINDOW].portfolioValue || 1;
    const sPrev = curve[i - ROLL_WINDOW].spyValue || 1;
    portRolling.push({ date: curve[i].date, ret: (curve[i].portfolioValue / pPrev - 1) * 100 });
    spyRolling.push({  date: curve[i].date, ret: (curve[i].spyValue  / sPrev  - 1) * 100 });
  }

  const allRets = [...portRolling.map(p => p.ret), ...spyRolling.map(p => p.ret)];
  const minRet = Math.min(...allRets);
  const maxRet = Math.max(...allRets);
  const range  = maxRet - minRet || 1;
  const n = portRolling.length;

  const toX = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const toY = (v: number) => PAD_T + (1 - (v - minRet) / range) * innerH;
  const zeroY = toY(0);

  // Build port fill path split: green above 0, red below 0
  const portPoints = portRolling.map((p, i) => ({ x: toX(i), y: toY(p.ret), ret: p.ret }));
  const spyPoly   = spyRolling.map((p, i) => `${toX(i).toFixed(1)},${toY(p.ret).toFixed(1)}`).join(" ");

  // segments for fill: above zero = green, below zero = red
  type Seg = { xs: number[]; ys: number[]; positive: boolean };
  const segments: Seg[] = [];
  {
    let seg: Seg = { xs: [], ys: [], positive: portPoints[0].ret >= 0 };
    for (let i = 0; i < portPoints.length; i++) {
      const positive = portPoints[i].ret >= 0;
      if (positive !== seg.positive && seg.xs.length > 0) {
        // interpolate zero-crossing
        const prev = portPoints[i - 1];
        const curr = portPoints[i];
        const t = Math.abs(prev.ret) / (Math.abs(prev.ret) + Math.abs(curr.ret));
        const cx = prev.x + t * (curr.x - prev.x);
        seg.xs.push(cx); seg.ys.push(zeroY);
        segments.push(seg);
        seg = { xs: [cx], ys: [zeroY], positive };
      }
      seg.xs.push(portPoints[i].x); seg.ys.push(portPoints[i].y);
    }
    if (seg.xs.length > 0) segments.push(seg);
  }

  const ySteps = [minRet, 0, maxRet];
  const xLabelIndices = [0, Math.floor(n * 0.5), n - 1];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${ROLL_H}`} className="w-full">
      {ySteps.map(ret => {
        const y = toY(ret);
        const isZero = ret === 0;
        return (
          <g key={ret}>
            <line x1={PAD_L} y1={y.toFixed(1)} x2={CHART_W - PAD_R} y2={y.toFixed(1)}
              stroke={isZero ? "#475569" : "#334155"} strokeWidth={isZero ? "0.8" : "0.5"} strokeDasharray={isZero ? "none" : "none"} />
            <text x={PAD_L - 4} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">
              {ret >= 0 ? "+" : ""}{ret.toFixed(0)}%
            </text>
          </g>
        );
      })}
      {xLabelIndices.map(i => (
        <text key={i} x={toX(i).toFixed(1)} y={ROLL_H - 6} fill="#64748b" fontSize="8" textAnchor="middle">
          {portRolling[i]?.date?.slice(0, 7) ?? ""}
        </text>
      ))}

      {segments.map((seg, si) => {
        const topPath = seg.xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${seg.ys[i].toFixed(1)}`).join(" ");
        const fillPath = topPath +
          ` L ${seg.xs[seg.xs.length - 1].toFixed(1)},${zeroY.toFixed(1)}` +
          ` L ${seg.xs[0].toFixed(1)},${zeroY.toFixed(1)} Z`;
        return (
          <path key={si} d={fillPath}
            fill={seg.positive ? "#10b981" : "#ef4444"}
            fillOpacity="0.15"
          />
        );
      })}

      <polyline points={spyPoly} fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="4,2" opacity="0.6" />
      <polyline
        points={portPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <text x={PAD_L + 4} y="20" fill="#3b82f6" fontSize="8" opacity="0.7">Rolling 1Y Return</text>
    </svg>
  );
}

export function RollingSharpeChart({ curve }: { curve: EquityCurvePoint[] }) {
  if (curve.length <= ROLL_WINDOW + 5) return null;

  const portRet: number[] = [];
  const spyRet: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    portRet.push(curve[i].portfolioValue / curve[i - 1].portfolioValue - 1);
    spyRet.push(curve[i].spyValue / curve[i - 1].spyValue - 1);
  }

  const rolling: { date: string; sharpe: number }[] = [];
  for (let i = ROLL_WINDOW; i < portRet.length; i++) {
    const excess = portRet.slice(i - ROLL_WINDOW, i).map((r, j) => r - spyRet[i - ROLL_WINDOW + j]);
    const mean = excess.reduce((s, r) => s + r, 0) / excess.length;
    const variance = excess.reduce((s, r) => s + (r - mean) ** 2, 0) / excess.length;
    const std = Math.sqrt(variance) || 1e-10;
    rolling.push({ date: curve[i + 1]?.date ?? curve[i].date, sharpe: (mean / std) * Math.sqrt(252) });
  }

  if (rolling.length < 2) return null;

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = SHARPE_H - PAD_T - PAD_B;
  const sharpes = rolling.map(p => p.sharpe);
  const minS = Math.min(Math.min(...sharpes), -1.5);
  const maxS = Math.max(Math.max(...sharpes), 1.5);
  const range = maxS - minS || 1;
  const n = rolling.length;
  const toX = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const toY = (v: number) => PAD_T + (1 - (v - minS) / range) * innerH;
  const zeroY = toY(0);
  const oneY  = toY(1);

  const pts = rolling.map((p, i) => ({ x: toX(i), y: toY(p.sharpe), sharpe: p.sharpe }));
  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const xLabelIndices = [0, Math.floor(n * 0.5), n - 1];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${SHARPE_H}`} className="w-full">
      {/* Reference lines */}
      {[{ v: 0, stroke: "#475569", label: "0" }, { v: 1, stroke: "#1d4ed8", label: "1.0" }].map(({ v, stroke, label }) => {
        const y = toY(v);
        return (
          <g key={v}>
            <line x1={PAD_L} y1={y.toFixed(1)} x2={CHART_W - PAD_R} y2={y.toFixed(1)} stroke={stroke} strokeWidth="0.7" strokeDasharray={v === 1 ? "4,2" : "none"} />
            <text x={PAD_L - 4} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">{label}</text>
          </g>
        );
      })}
      {/* Min/max labels */}
      {[minS, maxS].map(v => (
        <g key={v}>
          <text x={PAD_L - 4} y={(toY(v) + 3).toFixed(1)} fill="#475569" fontSize="7" textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      {/* Fill: above zero = green, below = red */}
      {pts.map((p, i) => {
        if (i === 0) return null;
        const prev = pts[i - 1];
        if ((p.sharpe >= 0) === (prev.sharpe >= 0)) {
          const x1 = prev.x, x2 = p.x;
          const y1 = prev.y, y2 = p.y;
          const pos = p.sharpe >= 0;
          return (
            <polygon key={i}
              points={`${x1.toFixed(1)},${zeroY.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${zeroY.toFixed(1)}`}
              fill={pos ? "#10b981" : "#ef4444"} fillOpacity="0.12"
            />
          );
        }
        return null;
      })}
      {/* Sharpe = 1 fill highlight */}
      <rect x={PAD_L} y={Math.min(zeroY, oneY).toFixed(1)} width={innerW} height={Math.abs(zeroY - oneY).toFixed(1)} fill="#3b82f6" fillOpacity="0.04" />
      {/* Polyline */}
      <polyline points={polyPts} fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinejoin="round" />
      {/* X-axis dates */}
      {xLabelIndices.map(i => (
        <text key={i} x={toX(i).toFixed(1)} y={SHARPE_H - 4} fill="#64748b" fontSize="8" textAnchor="middle">
          {rolling[i]?.date?.slice(0, 7) ?? ""}
        </text>
      ))}
      <text x={PAD_L + 4} y="16" fill="#a78bfa" fontSize="8" opacity="0.8">Rolling 1Y Sharpe (vs SPY)</text>
    </svg>
  );
}

export function DrawdownChart({ curve }: { curve: EquityCurvePoint[] }) {
  if (curve.length < 2) return null;

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = DD_H - 8 - PAD_B;
  const toX = (i: number) => PAD_L + (i / (curve.length - 1)) * innerW;

  const computeDrawdowns = (values: number[]) => {
    let peak = values[0];
    return values.map(v => {
      if (v > peak) peak = v;
      return peak > 0 ? (peak - v) / peak * 100 : 0;
    });
  };

  const portVals = curve.map(p => p.portfolioValue);
  const spyVals  = curve.map(p => p.spyValue);
  const portDD   = computeDrawdowns(portVals);
  const spyDD    = computeDrawdowns(spyVals);
  const maxDD    = Math.max(...portDD, ...spyDD, 1);

  const toY = (dd: number) => 8 + (dd / maxDD) * innerH;

  const portPath = [
    `M ${toX(0).toFixed(1)},8`,
    ...portDD.map((dd, i) => `L ${toX(i).toFixed(1)},${toY(dd).toFixed(1)}`),
    `L ${toX(curve.length - 1).toFixed(1)},8`,
    "Z",
  ].join(" ");

  const spyPoints = spyDD.map((dd, i) => `${toX(i).toFixed(1)},${toY(dd).toFixed(1)}`).join(" ");

  const ySteps = [0, maxDD * 0.5, maxDD];
  const xLabelIndices = [0, Math.floor(curve.length * 0.5), curve.length - 1];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${DD_H}`} className="w-full">
      {ySteps.map(dd => {
        const y = toY(dd);
        return (
          <g key={dd}>
            <line x1={PAD_L} y1={y.toFixed(1)} x2={CHART_W - PAD_R} y2={y.toFixed(1)} stroke="#334155" strokeWidth="0.5" />
            <text x={PAD_L - 4} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">
              -{dd.toFixed(0)}%
            </text>
          </g>
        );
      })}
      {xLabelIndices.map(i => (
        <text key={i} x={toX(i).toFixed(1)} y={DD_H - 6} fill="#64748b" fontSize="8" textAnchor="middle">
          {curve[i]?.date?.slice(0, 7) ?? ""}
        </text>
      ))}
      <path d={portPath} fill="#3b82f6" fillOpacity="0.18" />
      <polyline points={spyPoints} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="4,2" opacity="0.6" />
      {portDD.map((dd, i) => {
        const next = portDD[i + 1];
        if (next == null) return null;
        const x1 = toX(i); const x2 = toX(i + 1);
        const y1 = toY(dd); const y2 = toY(next);
        return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="#3b82f6" strokeWidth="1.5" />;
      })}
      <text x={PAD_L + 4} y="18" fill="#3b82f6" fontSize="8" opacity="0.7">Drawdown</text>
    </svg>
  );
}

export function AnnualReturnsChart({ curve }: { curve: EquityCurvePoint[] }) {
  const annuals = computeAnnualReturns(curve);
  if (annuals.length < 2) return null;

  const allRets = annuals.flatMap(a => [a.port * 100, a.spy * 100]);
  const maxAbs = Math.max(Math.abs(Math.min(...allRets)), Math.abs(Math.max(...allRets)), 5);
  const BAR_W = 18, GAP = 6, GROUP_GAP = 16;
  const LABEL_H = 36, PAD_T = 8, PAD_R = 8;
  const CHART_H = 110;
  const innerH = CHART_H - PAD_T - LABEL_H;
  const totalW = annuals.length * (BAR_W * 2 + GAP + GROUP_GAP) - GROUP_GAP + PAD_R;
  const zeroY = PAD_T + (1 - (0 - (-maxAbs)) / (maxAbs * 2)) * innerH;
  const toY = (v: number) => PAD_T + (1 - (v - (-maxAbs)) / (maxAbs * 2)) * innerH;
  const barH = (v: number) => Math.abs(toY(v) - zeroY);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">Annual Returns vs SPY</div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-blue-500/80" />Strategy</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-slate-500/60" />SPY</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${totalW} ${CHART_H}`} className="w-full" style={{ minWidth: `${Math.min(totalW, 320)}px` }}>
          {/* Zero line */}
          <line x1={0} y1={zeroY.toFixed(1)} x2={totalW} y2={zeroY.toFixed(1)} stroke="#475569" strokeWidth="0.5" />
          {/* Y-axis grid at ±max/2 */}
          {[maxAbs * 0.5, -maxAbs * 0.5].map(v => (
            <g key={v}>
              <line x1={0} y1={toY(v).toFixed(1)} x2={totalW} y2={toY(v).toFixed(1)} stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={2} y={(toY(v) - 2).toFixed(1)} fill="#64748b" fontSize="7" textAnchor="start">{v > 0 ? "+" : ""}{v.toFixed(0)}%</text>
            </g>
          ))}
          {annuals.map((a, i) => {
            const x = i * (BAR_W * 2 + GAP + GROUP_GAP);
            const portPct = a.port * 100;
            const spyPct = a.spy * 100;
            const portColor = portPct >= 0 ? "#3b82f6" : "#ef4444";
            const spyColor = spyPct >= 0 ? "#64748b" : "#dc2626";
            const portBarY = portPct >= 0 ? toY(portPct) : zeroY;
            const spyBarY = spyPct >= 0 ? toY(spyPct) : zeroY;
            const portH = barH(portPct);
            const spyH = barH(spyPct);
            const excess = portPct - spyPct;
            return (
              <g key={a.yr}>
                {/* Strategy bar */}
                <rect x={x} y={portBarY.toFixed(1)} width={BAR_W} height={portH.toFixed(1)} fill={portColor} opacity="0.85" rx="1"
                  {...{ title: `${a.yr} Strategy: ${portPct >= 0 ? "+" : ""}${portPct.toFixed(1)}%` }} />
                {/* SPY bar */}
                <rect x={x + BAR_W + GAP} y={spyBarY.toFixed(1)} width={BAR_W} height={spyH.toFixed(1)} fill={spyColor} opacity="0.55" rx="1"
                  {...{ title: `${a.yr} SPY: ${spyPct >= 0 ? "+" : ""}${spyPct.toFixed(1)}%` }} />
                {/* Excess label above higher bar */}
                <text x={(x + BAR_W).toFixed(1)} y={(Math.min(portBarY, spyBarY) - 2).toFixed(1)} fill={excess >= 0 ? "#34d399" : "#f87171"} fontSize="6.5" textAnchor="middle">
                  {excess >= 0 ? "+" : ""}{excess.toFixed(0)}
                </text>
                {/* Year label */}
                <text x={(x + BAR_W).toFixed(1)} y={(CHART_H - 2).toFixed(1)} fill="#94a3b8" fontSize="8" textAnchor="middle">
                  {a.yr}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Numbers above bars = excess return vs SPY (green = outperform, red = underperform) · Partial years shown at actual period returns
      </div>
    </div>
  );
}

