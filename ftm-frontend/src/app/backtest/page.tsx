"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { runBacktest, runBacktestSweep, runBacktestFrequencySweep, fetchRecentBacktests, fetchCategories, fetchMacro, BacktestResult, EquityCurvePoint, RebalanceEvent, CategorySummary, MacroResponse } from "@/lib/api";
import { CATEGORY_ETF_MAP } from "@/lib/sectors";
import { deriveTradeSignal } from "@/lib/signals";

const DATA_START         = "2019-05-16";
// Default to the full available history rather than an arbitrary hardcoded year. A fixed 2021
// start happened to land on the strategy's weakest window (mega-cap concentration era), which made
// the backtest look broken by default; using all data avoids cherry-picking a sub-period.
const DEFAULT_START_DATE = DATA_START;
const DEFAULT_END_DATE   = new Date().toISOString().split("T")[0];

const CHART_W = 640;
const CHART_H = 200;
const PAD_L   = 48;
const PAD_R   = 16;
const PAD_T   = 16;
const PAD_B   = 28;

function EquityCurveChart({ curve, rebalanceDates }: { curve: EquityCurvePoint[]; rebalanceDates?: string[] }) {
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


const ROLL_H = 110;
const ROLL_WINDOW = 252; // 1 trading year

function RollingReturnChart({ curve }: { curve: EquityCurvePoint[] }) {
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

const SHARPE_H = 90;

function RollingSharpeChart({ curve }: { curve: EquityCurvePoint[] }) {
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

const DD_H = 90;

function DrawdownChart({ curve }: { curve: EquityCurvePoint[] }) {
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

type DrawdownPeriod = {
  startDate: string;
  troughDate: string;
  endDate: string | null;
  depthPct: number;
  durationDays: number;
  recoveryDays: number | null;
};

function computeDrawdownPeriods(curve: EquityCurvePoint[], useSpy = false): DrawdownPeriod[] {
  if (curve.length < 2) return [];
  const getValue = (pt: EquityCurvePoint) => useSpy ? pt.spyValue : pt.portfolioValue;
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

function DrawdownAnalysisTable({ curve }: { curve: EquityCurvePoint[] }) {
  const stratPeriods = computeDrawdownPeriods(curve, false);
  if (stratPeriods.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-200 mb-3">Worst Drawdowns</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-4 font-medium">#</th>
              <th className="pb-2 pr-4 font-medium">Peak → Trough</th>
              <th className="pb-2 pr-4 font-medium text-right">Depth</th>
              <th className="pb-2 pr-4 font-medium text-right">Duration</th>
              <th className="pb-2 pr-4 font-medium text-right">Recovery</th>
              <th className="pb-2 font-medium text-right">Recovered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {stratPeriods.map((dd, i) => (
              <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                <td className="py-1.5 pr-4 text-slate-600 tabular-nums font-mono">{i + 1}</td>
                <td className="py-1.5 pr-4 text-slate-400 font-mono tabular-nums">
                  {dd.startDate} → {dd.troughDate}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                  <span className={`font-semibold ${dd.depthPct >= 20 ? "text-red-400" : dd.depthPct >= 10 ? "text-amber-400" : "text-slate-300"}`}>
                    -{dd.depthPct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-slate-400">
                  {dd.durationDays}d
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                  {dd.recoveryDays != null
                    ? <span className={dd.recoveryDays < 60 ? "text-emerald-400" : dd.recoveryDays < 252 ? "text-amber-400" : "text-red-400"}>{dd.recoveryDays}d</span>
                    : <span className="text-red-400">ongoing</span>
                  }
                </td>
                <td className="py-1.5 text-right">
                  {dd.endDate != null
                    ? <span className="text-emerald-400">✓ {dd.endDate}</span>
                    : <span className="text-red-400">✗ not yet</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Top 5 drawdowns ≥2% · Duration = peak to trough · Recovery = trough to new high · Ongoing = not yet recovered at end of period
      </div>
    </div>
  );
}

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function computeRiskAttribution(curve: EquityCurvePoint[]) {
  if (curve.length < 30) return null;
  const portRet: number[] = [];
  const spyRet: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    portRet.push(curve[i].portfolioValue / curve[i-1].portfolioValue - 1);
    spyRet.push(curve[i].spyValue / curve[i-1].spyValue - 1);
  }
  const n = portRet.length;
  const meanPort = portRet.reduce((s, r) => s + r, 0) / n;
  const meanSpy  = spyRet.reduce((s, r) => s + r, 0) / n;
  let covPS = 0, varSpy = 0, varPort = 0;
  for (let i = 0; i < n; i++) {
    covPS   += (portRet[i] - meanPort) * (spyRet[i] - meanSpy);
    varSpy  += (spyRet[i]  - meanSpy)  ** 2;
    varPort += (portRet[i] - meanPort) ** 2;
  }
  covPS  /= n;
  varSpy  /= n;
  varPort /= n;
  const beta = varSpy > 0 ? covPS / varSpy : null;
  const correlation = (varSpy > 0 && varPort > 0) ? covPS / Math.sqrt(varSpy * varPort) : null;
  const capmAlphaDailyAnn = beta != null ? (meanPort - beta * meanSpy) * 252 : null;
  const diffRet = portRet.map((p, i) => p - spyRet[i]);
  const meanDiff = diffRet.reduce((s, r) => s + r, 0) / n;
  const varDiff = diffRet.reduce((s, r) => s + (r - meanDiff) ** 2, 0) / n;
  const trackingError = Math.sqrt(varDiff * 252);

  const upDays  = portRet.filter((_, i) => spyRet[i] > 0);
  const upSpy   = spyRet.filter(r => r > 0);
  const downDays = portRet.filter((_, i) => spyRet[i] < 0);
  const downSpy  = spyRet.filter(r => r < 0);
  const upCapture   = upDays.length > 0 && upSpy.length > 0
    ? (upDays.reduce((s, r) => s + r, 0) / upDays.length) / (upSpy.reduce((s, r) => s + r, 0) / upSpy.length) * 100
    : null;
  const downCapture = downDays.length > 0 && downSpy.length > 0
    ? (downDays.reduce((s, r) => s + r, 0) / downDays.length) / (downSpy.reduce((s, r) => s + r, 0) / downSpy.length) * 100
    : null;
  const informationRatio = trackingError > 0 ? (meanDiff * 252) / trackingError : null;
  return { beta, correlation, capmAlphaDailyAnn, trackingError: trackingError * 100, informationRatio, upCapture, downCapture };
}

function RiskAttributionPanel({ curve }: { curve: EquityCurvePoint[] }) {
  const ra = computeRiskAttribution(curve);
  if (!ra) return null;

  type Cell = { label: string; value: string; sub?: string; color?: string; tooltip: string };
  const cells: Cell[] = [
    {
      label: "Beta",
      value: ra.beta != null ? ra.beta.toFixed(2) : "—",
      color: ra.beta != null ? (ra.beta < 0.8 ? "text-emerald-400" : ra.beta < 1.1 ? "text-slate-300" : "text-amber-400") : undefined,
      tooltip: "Sensitivity to SPY daily moves. β<1 = less market exposure than index; β>1 = amplified market risk.",
    },
    {
      label: "Correlation",
      value: ra.correlation != null ? ra.correlation.toFixed(3) : "—",
      color: ra.correlation != null ? (ra.correlation < 0.7 ? "text-emerald-400" : ra.correlation < 0.85 ? "text-slate-300" : "text-amber-400") : undefined,
      tooltip: "Pearson r of daily returns vs SPY. Lower = more independent return stream; ideal rotation strategy < 0.75.",
    },
    {
      label: "CAPM α (ann.)",
      value: ra.capmAlphaDailyAnn != null ? `${ra.capmAlphaDailyAnn >= 0 ? "+" : ""}${ra.capmAlphaDailyAnn.toFixed(2)}%` : "—",
      color: ra.capmAlphaDailyAnn != null ? (ra.capmAlphaDailyAnn > 0 ? "text-emerald-400" : "text-red-400") : undefined,
      tooltip: "Annualized Jensen's alpha — return unexplained by market beta. Positive = genuine skill after adjusting for market exposure.",
    },
    {
      label: "Tracking Error",
      value: ra.trackingError != null ? `${ra.trackingError.toFixed(2)}%` : "—",
      color: "text-slate-300",
      sub: "annualized",
      tooltip: "Annualized std dev of (strategy − SPY) daily returns. Measures how much the strategy deviates from the index.",
    },
    {
      label: "Info Ratio",
      value: ra.informationRatio != null ? ra.informationRatio.toFixed(2) : "—",
      color: ra.informationRatio != null ? (ra.informationRatio > 0.5 ? "text-emerald-400" : ra.informationRatio > 0 ? "text-slate-300" : "text-red-400") : undefined,
      tooltip: "Annualized alpha / tracking error. Measures consistency of excess return. >0.5 = good active management.",
    },
    {
      label: "Up Capture",
      value: ra.upCapture != null ? `${ra.upCapture.toFixed(1)}%` : "—",
      color: ra.upCapture != null ? (ra.upCapture > 100 ? "text-emerald-400" : ra.upCapture > 80 ? "text-blue-300" : "text-amber-400") : undefined,
      sub: "of SPY up moves",
      tooltip: "On days when SPY rises, what % of SPY's gain does the strategy capture? >100% = amplified upside.",
    },
    {
      label: "Down Capture",
      value: ra.downCapture != null ? `${ra.downCapture.toFixed(1)}%` : "—",
      color: ra.downCapture != null ? (ra.downCapture < 70 ? "text-emerald-400" : ra.downCapture < 90 ? "text-blue-300" : "text-amber-400") : undefined,
      sub: "of SPY down moves",
      tooltip: "On days when SPY falls, what % of SPY's loss does the strategy incur? <70% = strong downside protection.",
    },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-200 mb-3">Risk Attribution vs SPY</div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {cells.map(cell => (
          <div key={cell.label} className="space-y-0.5" title={cell.tooltip}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{cell.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums ${cell.color ?? "text-slate-300"}`}>{cell.value}</div>
            {cell.sub && <div className="text-[9px] text-slate-600">{cell.sub}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-slate-700/40 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[10px] text-slate-500">
        <span><span className="text-slate-400">Ideal rotation signal:</span> β≈0.7–0.9 · r&lt;0.8 · α&gt;2% · Up≥85% · Down≤75%</span>
        <span><span className="text-slate-400">Computed from:</span> {curve.length - 1} daily return pairs · no annualization of individual metrics except where noted</span>
      </div>
    </div>
  );
}

function computeMonthlyReturns(curve: EquityCurvePoint[]) {
  if (curve.length < 2) return [];
  const monthEnd = new Map<string, { portfolio: number; spy: number }>();
  for (const pt of curve) {
    const ym = pt.date.slice(0, 7);
    monthEnd.set(ym, { portfolio: pt.portfolioValue, spy: pt.spyValue });
  }
  const sortedMonths = Array.from(monthEnd.keys()).sort();
  const rows: { ym: string; year: number; month: number; port: number; spy: number }[] = [];
  for (let i = 1; i < sortedMonths.length; i++) {
    const prev = monthEnd.get(sortedMonths[i - 1])!;
    const curr = monthEnd.get(sortedMonths[i])!;
    const [yr, mo] = sortedMonths[i].split("-").map(Number);
    rows.push({ ym: sortedMonths[i], year: yr, month: mo, port: curr.portfolio / prev.portfolio - 1, spy: curr.spy / prev.spy - 1 });
  }
  return rows;
}

function computeAnnualReturns(curve: EquityCurvePoint[]): { yr: number; port: number; spy: number }[] {
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

function AnnualReturnsChart({ curve }: { curve: EquityCurvePoint[] }) {
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

function cellBg(excess: number): string {
  if (excess >= 0.03)  return "bg-emerald-800/80 text-emerald-200";
  if (excess >= 0.01)  return "bg-emerald-900/60 text-emerald-300";
  if (excess >= 0.003) return "bg-emerald-900/30 text-emerald-400";
  if (excess >= -0.003) return "bg-slate-700/40 text-slate-400";
  if (excess >= -0.01) return "bg-red-900/30 text-red-400";
  if (excess >= -0.03) return "bg-red-900/60 text-red-300";
  return "bg-red-800/80 text-red-200";
}

function MonthlyReturnsTable({ curve }: { curve: EquityCurvePoint[] }) {
  const rows = computeMonthlyReturns(curve);
  if (rows.length === 0) return null;

  const years = Array.from(new Set(rows.map(r => r.year))).sort();
  const byYM = new Map(rows.map(r => [r.ym, r]));

  // Annual returns: first value of year / last value of prev year
  const monthEnd = new Map<string, { portfolio: number; spy: number }>();
  for (const pt of curve) monthEnd.set(pt.date.slice(0, 7), { portfolio: pt.portfolioValue, spy: pt.spyValue });

  const annualReturns = years.map(yr => {
    const yrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr))).sort();
    const prevYrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr - 1))).sort();
    const start = prevYrMonths.length > 0 ? monthEnd.get(prevYrMonths[prevYrMonths.length - 1])! : monthEnd.get(yrMonths[0])!;
    const end = monthEnd.get(yrMonths[yrMonths.length - 1])!;
    return {
      yr,
      port: end.portfolio / start.portfolio - 1,
      spy: end.spy / start.spy - 1,
    };
  });

  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  const beatCount = rows.filter(r => r.port > r.spy).length;
  const winRate = Math.round((beatCount / rows.length) * 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Monthly Returns vs SPY</div>
        <div className="text-[10px] text-slate-500 flex items-center gap-3">
          <span>Beat SPY in <span className="text-emerald-400 font-semibold">{beatCount}/{rows.length}</span> months ({winRate}%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-800/80 inline-block"/>outperform</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-800/80 inline-block"/>underperform</span>
          <button
            onClick={() => {
              const header = "year_month,strategy_pct,spy_pct,excess_pct";
              const csvRows = rows.map(r =>
                `${r.ym},${(r.port*100).toFixed(4)},${(r.spy*100).toFixed(4)},${((r.port-r.spy)*100).toFixed(4)}`
              );
              const csv = [header, ...csvRows].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "monthly_returns.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 transition-colors"
            title="Download monthly returns as CSV"
          >
            ↓ CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 pr-3 pb-1.5 font-medium w-12">Year</th>
              {months.map(m => (
                <th key={m} className="text-center text-slate-500 pb-1.5 font-medium px-1 w-[calc(100%/14)]">
                  {MONTH_ABBR[m-1]}
                </th>
              ))}
              <th className="text-right text-slate-500 pb-1.5 font-medium pl-2 pr-1 w-16">Full Yr</th>
            </tr>
          </thead>
          <tbody>
            {years.map((yr, yi) => {
              const ann = annualReturns[yi];
              const annExcess = ann.port - ann.spy;
              return (
                <tr key={yr}>
                  <td className="text-slate-400 pr-3 py-0.5 font-mono font-medium">{yr}</td>
                  {months.map(mo => {
                    const ym = `${yr}-${String(mo).padStart(2, "0")}`;
                    const cell = byYM.get(ym);
                    if (!cell) return <td key={mo} className="px-0.5 py-0.5"><div className="text-center text-slate-700 text-[9px] rounded py-1">—</div></td>;
                    const excess = cell.port - cell.spy;
                    const bg = cellBg(excess);
                    const portPct = (cell.port * 100).toFixed(1);
                    const spyPct = (cell.spy * 100).toFixed(1);
                    const excessPct = (excess * 100).toFixed(1);
                    return (
                      <td key={mo} className="px-0.5 py-0.5" title={`${MONTH_ABBR[mo-1]} ${yr}\nStrategy: ${cell.port >= 0 ? "+" : ""}${portPct}%\nSPY: ${cell.spy >= 0 ? "+" : ""}${spyPct}%\nExcess: ${excess >= 0 ? "+" : ""}${excessPct}%`}>
                        <div className={`text-center rounded py-1 text-[9px] tabular-nums font-mono ${bg}`}>
                          {cell.port >= 0 ? "+" : ""}{portPct}%
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-0.5 py-0.5 pl-2">
                    <div className={`text-right rounded py-1 text-[10px] tabular-nums font-mono font-semibold ${cellBg(annExcess)}`}>
                      {ann.port >= 0 ? "+" : ""}{(ann.port * 100).toFixed(1)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Color intensity = excess return vs SPY that month. Hover cells for details. Annual column = full-year compounded return.
      </div>
    </div>
  );
}

function HoldingHeatmap({ events, curve }: { events: RebalanceEvent[]; curve: EquityCurvePoint[] }) {
  if (!events || events.length < 2) return null;

  // All unique categories that ever appeared, sorted by frequency (most held first)
  const freq: Record<string, number> = {};
  for (const ev of events) for (const id of ev.categoryIds) freq[id] = (freq[id] ?? 0) + 1;
  const categories = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
  if (categories.length === 0) return null;

  // Build portfolio value lookup from equity curve
  const valueByDate: Record<string, number> = {};
  for (const pt of curve) valueByDate[pt.date] = pt.portfolioValue;

  // Compute period return for each rebalance period
  const periods = events.map((ev, i) => {
    const nextDate = events[i + 1]?.date;
    const startVal = valueByDate[ev.date] ?? ev.portfolioValue;
    const endVal   = nextDate ? (valueByDate[nextDate] ?? events[i + 1].portfolioValue) : startVal;
    const returnPct = startVal > 0 ? (endVal - startVal) / startVal * 100 : 0;
    return { date: ev.date, heldIds: new Set(ev.categoryIds), returnPct };
  });

  // Show at most 30 most-recent periods to keep it readable
  const visiblePeriods = periods.slice(-30);

  const cellBgHeld = (returnPct: number) => {
    if (returnPct >= 3)  return "bg-emerald-700/80";
    if (returnPct >= 1)  return "bg-emerald-800/60";
    if (returnPct >= 0)  return "bg-emerald-900/50";
    if (returnPct >= -1) return "bg-red-900/50";
    if (returnPct >= -3) return "bg-red-800/60";
    return "bg-red-700/70";
  };

  const holdCount = (id: string) => periods.filter(p => p.heldIds.has(id)).length;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Rotation Heatmap</div>
        <div className="text-[10px] text-slate-500">
          {categories.length} sectors · {periods.length} periods · color = period return when held
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[9px] border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left text-slate-500 pr-2 pb-1 font-medium whitespace-nowrap w-14">Sector</th>
              {visiblePeriods.map(p => (
                <th key={p.date} className="pb-1 font-normal text-slate-600 px-px" style={{ minWidth: "18px" }}>
                  <div className="writing-mode-vertical" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", fontSize: "8px" }}>
                    {p.date.slice(5, 10)}
                  </div>
                </th>
              ))}
              <th className="pl-2 pb-1 text-right text-slate-500 font-medium whitespace-nowrap">Hold%</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(id => (
              <tr key={id}>
                <td className="pr-2 py-px">
                  <span className="font-mono text-slate-400">{CATEGORY_ETF_MAP[id] ?? id}</span>
                  <span className="text-slate-700 ml-1">({id.slice(0, 6)})</span>
                </td>
                {visiblePeriods.map(p => {
                  const held = p.heldIds.has(id);
                  return (
                    <td key={p.date} className="px-px py-px" title={`${p.date}: ${id} — ${held ? `held, period return: ${p.returnPct >= 0 ? "+" : ""}${p.returnPct.toFixed(1)}%` : "not held"}`}>
                      <div className={`w-4 h-4 rounded-sm ${held ? cellBgHeld(p.returnPct) : "bg-slate-800/30"}`} />
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-mono text-slate-500">
                  {Math.round(holdCount(id) / periods.length * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[9px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-700/80 inline-block"/>+3%+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-900/50 inline-block"/>0–1%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-900/50 inline-block"/>0–(−1)%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-700/70 inline-block"/>−3%+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-800/30 inline-block"/>not held</span>
        <span className="ml-auto">Hold% = fraction of all periods this sector was in the portfolio</span>
      </div>
    </div>
  );
}

function RebalanceTimeline({ events }: { events: RebalanceEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-slate-500 py-4 text-center">No rebalance events recorded.</p>;
  }
  const initial = 10_000;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-500 text-left">
            <th className="pb-2 pr-4 font-medium">#</th>
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Value</th>
            <th className="pb-2 pr-4 font-medium">Return</th>
            <th className="pb-2 font-medium">Hold — ETF (sector) · Equal weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {events.map((ev, i) => {
            const returnPct = ((ev.portfolioValue - initial) / initial) * 100;
            return (
              <tr key={ev.date} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-1.5 pr-4 text-slate-600 tabular-nums">{i + 1}</td>
                <td className="py-1.5 pr-4 font-mono text-slate-300">{ev.date}</td>
                <td className="py-1.5 pr-4 font-mono tabular-nums text-slate-200">
                  ${ev.portfolioValue.toFixed(2)}
                </td>
                <td className={`py-1.5 pr-4 font-mono tabular-nums ${returnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                </td>
                <td className="py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {ev.categoryIds.map(id => {
                      const ticker = CATEGORY_ETF_MAP[id] ?? id;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded" title={`Category: ${id}`}>
                          <span className="text-cyan-300 font-bold">{ticker}</span>
                          <span className="text-blue-500">({id})</span>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-600">
        Hypothetical equal-weighted positions. Rotation strategy exits all positions and buys the top-N sectors by composite score on each rebalance date. No transaction costs, slippage, or taxes modeled.
      </p>
    </div>
  );
}

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color: string; tooltip?: string }) {
  return (
    <div className="space-y-0.5" title={tooltip}>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help text-slate-600">(?)</span>}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function computeSortino(curve: EquityCurvePoint[], useSpy: boolean): number | null {
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

function SweepTable({ rows, currentTopN }: { rows: BacktestResult[]; currentTopN: number }) {
  if (rows.length === 0) return null;
  const spy = rows[0]; // spy metrics are constant across rows
  const best = rows.reduce((best, r) => (r.sortinoRatio ?? 0) > (best.sortinoRatio ?? 0) ? r : best, rows[0]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Parameter Sensitivity — Top-N Sweep</div>
        <div className="text-[10px] text-slate-500">
          Best Sortino: <span className="text-emerald-400 font-semibold">Top-{best.topN} ({best.sortinoRatio?.toFixed(2)})</span>
          {" · "} SPY baseline: {spy.spyTotalReturnPct?.toFixed(1)}% total, Sharpe {spy.spySharpeRatio?.toFixed(2)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">N</th>
              <th className="pb-2 pr-3 font-medium text-right">Total Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">Ann. Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">vs SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Max DD</th>
              <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
              <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
              <th className="pb-2 font-medium text-right">Calmar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const excess = (r.totalReturnPct ?? 0) - (r.spyTotalReturnPct ?? 0);
              const isCurrent = r.topN === currentTopN;
              const isBest = r.topN === best.topN;
              return (
                <tr key={r.topN} className={`${isCurrent ? "bg-blue-900/20" : ""} ${isBest ? "ring-1 ring-emerald-700/40" : ""} hover:bg-slate-800/40 transition-colors`}>
                  <td className={`py-1.5 pr-3 font-mono font-bold ${isBest ? "text-emerald-400" : isCurrent ? "text-blue-300" : "text-slate-400"}`}>
                    {r.topN}{isCurrent ? " ←" : ""}{isBest && !isCurrent ? " ★" : ""}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.totalReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.totalReturnPct != null ? `${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.annualizedReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.annualizedReturnPct != null ? `${r.annualizedReturnPct >= 0 ? "+" : ""}${r.annualizedReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-3 font-mono tabular-nums text-red-400 text-right">
                    -{r.maxDrawdownPct?.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sharpeRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sortinoRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-1.5 font-mono tabular-nums text-right ${(r.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.calmarRatio?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        ★ = best Sortino · ← = current selection · all runs use same date range, frequency, and universe
      </div>
    </div>
  );
}

const REGIME_COLORS: Record<string, { label: string; dot: string; textClass: string }> = {
  RISK_ON_GROWTH:    { label: "Risk-On Growth",    dot: "bg-emerald-500", textClass: "text-emerald-400" },
  RISK_ON_DEFENSIVE: { label: "Risk-On Defensive", dot: "bg-blue-500",    textClass: "text-blue-400"   },
  RISK_OFF_FLIGHT:   { label: "Risk-Off / Flight", dot: "bg-red-500",     textClass: "text-red-400"    },
  STAGFLATION:       { label: "Stagflation",        dot: "bg-amber-500",   textClass: "text-amber-400"  },
};

type RegimeBreakdown = {
  regime: string;
  days: number;
  portReturn: number;
  spyReturn: number;
};

function computeRegimeBreakdown(
  curve: EquityCurvePoint[],
  history: { date: string; regime: string }[],
): RegimeBreakdown[] {
  if (curve.length < 2 || history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  // Build date→regime lookup by extending each weekly observation forward
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

  // Group equity curve points by regime, compute compounded return per regime
  const regimeGroups: Record<string, { portValues: number[]; spyValues: number[] }> = {};
  for (const pt of curve) {
    const regime = regimeByDate[pt.date];
    if (!regime) continue;
    if (!regimeGroups[regime]) regimeGroups[regime] = { portValues: [], spyValues: [] };
    regimeGroups[regime].portValues.push(pt.portfolioValue);
    regimeGroups[regime].spyValues.push(pt.spyValue);
  }

  return Object.entries(regimeGroups).map(([regime, { portValues, spyValues }]) => {
    const portReturn = portValues.length > 1
      ? (portValues[portValues.length - 1] / portValues[0] - 1) * 100 : 0;
    const spyReturn = spyValues.length > 1
      ? (spyValues[spyValues.length - 1] / spyValues[0] - 1) * 100 : 0;
    return { regime, days: portValues.length, portReturn, spyReturn };
  }).sort((a, b) => b.days - a.days);
}

function RegimeBreakdownTable({ curve, history }: { curve: EquityCurvePoint[]; history: { date: string; regime: string }[] }) {
  const rows = computeRegimeBreakdown(curve, history);
  if (rows.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Performance by Macro Regime</div>
        <div className="text-[10px] text-slate-500">
          Compounded strategy return vs SPY in each regime · coverage from weekly macro signal
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">Regime</th>
              <th className="pb-2 pr-3 font-medium text-right">Days</th>
              <th className="pb-2 pr-3 font-medium text-right">Strategy</th>
              <th className="pb-2 pr-3 font-medium text-right">SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Alpha</th>
              <th className="pb-2 font-medium text-right">Daily Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const alpha = r.portReturn - r.spyReturn;
              const rc = REGIME_COLORS[r.regime] ?? { label: r.regime, dot: "bg-slate-500", textClass: "text-slate-400" };
              const dailyAvg = r.days > 1 ? r.portReturn / r.days : 0;
              return (
                <tr key={r.regime} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rc.dot} inline-block shrink-0`} />
                      <span className={`font-medium ${rc.textClass}`}>{rc.label}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-400">{r.days}</td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${r.portReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.portReturn >= 0 ? "+" : ""}{r.portReturn.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${r.spyReturn >= 0 ? "text-slate-300" : "text-red-400"}`}>
                    {r.spyReturn >= 0 ? "+" : ""}{r.spyReturn.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right font-semibold ${alpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {alpha >= 0 ? "+" : ""}{alpha.toFixed(1)}%
                  </td>
                  <td className={`py-2 font-mono tabular-nums text-right text-[10px] ${dailyAvg >= 0 ? "text-slate-400" : "text-red-400/70"}`}>
                    {dailyAvg >= 0 ? "+" : ""}{dailyAvg.toFixed(3)}%/d
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Regime classification is weekly (FRED data lag). Days = trading days in this backtest where the regime applied. Alpha = strategy minus SPY for that regime period only.
      </div>
    </div>
  );
}

const FREQ_LABELS: Record<string, { label: string; shortLabel: string; colorClass: string }> = {
  WEEKLY:    { label: "Weekly",    shortLabel: "W", colorClass: "text-purple-400" },
  MONTHLY:   { label: "Monthly",   shortLabel: "M", colorClass: "text-blue-400"   },
  QUARTERLY: { label: "Quarterly", shortLabel: "Q", colorClass: "text-cyan-400"   },
};

function FrequencySweepTable({ rows, currentFrequency }: { rows: BacktestResult[]; currentFrequency: string }) {
  if (rows.length === 0) return null;
  const spy = rows[0];
  const best = rows.reduce((b, r) => (r.sortinoRatio ?? 0) > (b.sortinoRatio ?? 0) ? r : b, rows[0]);
  const worstDD = rows.reduce((b, r) => (r.maxDrawdownPct ?? 0) > (b.maxDrawdownPct ?? 0) ? r : b, rows[0]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Frequency Sensitivity — Weekly vs Monthly vs Quarterly</div>
        <div className="text-[10px] text-slate-500">
          Best Sortino: <span className="text-emerald-400 font-semibold">{FREQ_LABELS[best.rebalanceFrequency]?.label} ({best.sortinoRatio?.toFixed(2)})</span>
          {" · "} SPY baseline: {spy.spyTotalReturnPct?.toFixed(1)}% total
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">Frequency</th>
              <th className="pb-2 pr-3 font-medium text-right">Rebalances</th>
              <th className="pb-2 pr-3 font-medium text-right">Total Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">Ann. Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">vs SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Max DD</th>
              <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
              <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
              <th className="pb-2 font-medium text-right">Calmar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const excess = (r.totalReturnPct ?? 0) - (r.spyTotalReturnPct ?? 0);
              const isCurrent = r.rebalanceFrequency === currentFrequency;
              const isBest = r.rebalanceFrequency === best.rebalanceFrequency;
              const isWorstDD = r.rebalanceFrequency === worstDD.rebalanceFrequency;
              const fc = FREQ_LABELS[r.rebalanceFrequency] ?? { label: r.rebalanceFrequency, shortLabel: r.rebalanceFrequency, colorClass: "text-slate-400" };
              return (
                <tr key={r.rebalanceFrequency} className={`${isCurrent ? "bg-blue-900/20" : ""} ${isBest ? "ring-1 ring-emerald-700/40" : ""} hover:bg-slate-800/40 transition-colors`}>
                  <td className={`py-2 pr-3 font-semibold ${fc.colorClass}`}>
                    {fc.label}{isCurrent ? " ←" : ""}{isBest && !isCurrent ? " ★" : ""}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-400">
                    {r.rebalanceFrequency === "WEEKLY" ? "~52/yr" : r.rebalanceFrequency === "MONTHLY" ? "~12/yr" : "~4/yr"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.totalReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.totalReturnPct != null ? `${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.annualizedReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.annualizedReturnPct != null ? `${r.annualizedReturnPct >= 0 ? "+" : ""}${r.annualizedReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${isWorstDD ? "text-red-400 font-semibold" : "text-red-400/70"}`}>
                    -{r.maxDrawdownPct?.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sharpeRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sortinoRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-2 font-mono tabular-nums text-right ${(r.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.calmarRatio?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        ★ = best Sortino · ← = current selection · all runs use same date range, topN, and universe · Weekly = higher turnover, higher transaction cost risk
      </div>
    </div>
  );
}

export default function BacktesterPage() {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY">("MONTHLY");
  const [categoryScope, setCategoryScope] = useState<"ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY">("TOP_LEVEL_ONLY");
  const [topN, setTopN] = useState(5);
  const [signalThreshold, setSignalThreshold] = useState("");
  // Realistic default trading cost (10 bps ≈ round-trip commission + spread for liquid ETFs).
  const [transactionCostBps, setTransactionCostBps] = useState(10);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<BacktestResult[]>([]);
  const [sweepResults, setSweepResults] = useState<BacktestResult[] | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [freqSweepResults, setFreqSweepResults] = useState<BacktestResult[] | null>(null);
  const [isFreqSweeping, setIsFreqSweeping] = useState(false);
  const [liveCategories, setLiveCategories] = useState<CategorySummary[]>([]);
  const [liveRegime, setLiveRegime] = useState<string | null>(null);
  const [regimeHistory, setRegimeHistory] = useState<MacroResponse["regimeHistory"]>([]);

  useEffect(() => {
    fetchRecentBacktests().then(setRecentRuns).catch(() => {});
    fetchCategories("MONTH").then(r => setLiveCategories(r.categories)).catch(() => {});
    fetchMacro().then(r => { setLiveRegime(r.regime); setRegimeHistory(r.regimeHistory ?? []); }).catch(() => {});
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const data = await runBacktest({
        startDate,
        endDate,
        rebalanceFrequency,
        topN,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
      });
      setResult(data);
      setRecentRuns(prev => [data, ...prev.filter(r => r.runId !== data.runId).slice(0, 9)]);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSweep = async () => {
    setIsSweeping(true);
    setSweepResults(null);
    try {
      const data = await runBacktestSweep({
        startDate,
        endDate,
        rebalanceFrequency,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
      });
      setSweepResults(data);
    } catch {} finally {
      setIsSweeping(false);
    }
  };

  const handleFrequencySweep = async () => {
    setIsFreqSweeping(true);
    setFreqSweepResults(null);
    try {
      const data = await runBacktestFrequencySweep({
        startDate,
        endDate,
        topN,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
      });
      setFreqSweepResults(data);
    } catch {} finally {
      setIsFreqSweeping(false);
    }
  };

  const formatPct = (value: number | null | undefined) => {
    if (value == null) return "—";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const formatDecimal = (value: number | null | undefined) => value == null ? "—" : value.toFixed(2);

  const winColor  = "text-emerald-400";
  const lossColor = "text-red-400";
  const neutColor = "text-slate-300";

  const inputCls = "w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none";
  const labelCls = "text-xs text-slate-500 block mb-1";

  type LiveCat = CategorySummary & { signal: "BUY" | "WATCH" | "HOLD" | "REDUCE" | null };
  const withSignals: LiveCat[] = liveCategories.map(cat => ({
    ...cat,
    signal: (cat.tradeSignal as "BUY" | "WATCH" | "HOLD" | "REDUCE" | null) ?? deriveTradeSignal(cat),
  }));
  const buySignals = withSignals.filter(c => c.signal === "BUY").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const watchSignals = withSignals.filter(c => c.signal === "WATCH").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)).slice(0, 6);
  const reduceSignals = withSignals.filter(c => c.signal === "REDUCE").slice(0, 4);
  const topNLive = withSignals.filter(c => c.signal === "BUY" || c.signal === "WATCH").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)).slice(0, topN);
  const hasLiveData = liveCategories.length > 0 && liveCategories.some(c => c.compositeScore != null);

  const REGIME_LABEL: Record<string, { label: string; color: string }> = {
    RISK_ON_GROWTH:    { label: "Risk-On Growth",     color: "text-green-400"  },
    RISK_ON_DEFENSIVE: { label: "Risk-On Defensive",  color: "text-cyan-400"   },
    RISK_OFF_FLIGHT:   { label: "Risk-Off / Flight",  color: "text-orange-400" },
    STAGFLATION:       { label: "Stagflation",        color: "text-red-400"    },
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Backtester
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical rotation strategy vs SPY buy-and-hold. Rebalances into top-N sectors by composite score.
          <span className="ml-2 text-slate-600">Data available from {DATA_START}.</span>
        </p>
      </header>

      <main className="flex-1 overflow-auto p-6">

        {/* Live Recommendations Panel */}
        {hasLiveData && (
          <div className="mb-5 bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-semibold text-slate-200">Live Signal — What the Strategy Holds Today</span>
              </div>
              <div className="flex items-center gap-3">
                {liveRegime && (() => {
                  const rc = REGIME_LABEL[liveRegime];
                  return rc ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60">
                      Regime: <span className={`font-semibold ${rc.color}`}>{rc.label}</span>
                    </span>
                  ) : null;
                })()}
                <span className="text-[10px] text-slate-500">Based on current composite scores</span>
              </div>
            </div>
            <div className="p-4 space-y-3">

              {/* Top-N portfolio preview */}
              {topNLive.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>Top-{topN} Holdings (current strategy picks)</span>
                    <span className="text-slate-600">— equal-weighted if run today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topNLive.map((cat, i) => {
                      const sig = cat.signal;
                      const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
                      const rrg = cat.rrgQuadrant;
                      const quadrantLabel = rrg === "4" ? "↗ Leading" : rrg === "3" ? "↖ Improving" : rrg === "2" ? "↘ Weakening" : rrg === "1" ? "↙ Lagging" : null;
                      const sigCls = sig === "BUY"
                        ? "bg-green-900/50 border-green-700/60 text-green-300"
                        : sig === "WATCH"
                        ? "bg-cyan-900/40 border-cyan-700/50 text-cyan-300"
                        : "bg-slate-700/50 border-slate-600/60 text-slate-400";
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const Wrapper = hasDrilldown ? Link : "div" as unknown as typeof Link;
                      return (
                        <Wrapper key={cat.id} href={hasDrilldown ? `/sectors/${cat.id}` : "#"} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-opacity ${hasDrilldown ? "hover:opacity-80 cursor-pointer" : ""} ${sigCls}`}
                          title={`${cat.name} (${cat.etfTicker}) — Score: ${score ?? "??"}/100${quadrantLabel ? ` — RRG: ${quadrantLabel}` : ""}${cat.macroFit != null ? ` — Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open sector drilldown" : ""}`}>
                          <span className="text-[10px] text-slate-500 tabular-nums w-3 shrink-0">{i + 1}</span>
                          <span className="font-mono font-bold text-sm">{cat.etfTicker}</span>
                          <span className="text-[10px] text-slate-400 hidden md:inline">{cat.name}</span>
                          {score != null && (
                            <span className="text-[10px] tabular-nums opacity-70">{score}/100</span>
                          )}
                          {sig && (
                            <span className={`text-[9px] font-bold uppercase opacity-80`}>{sig}</span>
                          )}
                          {hasDrilldown && <span className="text-[9px] text-slate-600 ml-0.5">↗</span>}
                        </Wrapper>
                      );
                    })}
                    {topNLive.length < topN && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600/40 bg-slate-700/20 text-slate-600 text-[10px]">
                        {topN - topNLive.length}× CASH (BIL) — no qualifying signal
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BUY / WATCH / REDUCE breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/40">
                <div>
                  <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1.5 font-semibold">BUY ({buySignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {buySignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {buySignals.map(cat => (
                      <Link key={cat.id} href={`/sectors/${cat.id}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800/50 hover:bg-green-900/70 transition-colors"
                        title={`${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""} — click to open drilldown`}>
                        {cat.etfTicker}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥65 + RRG 3/4 + positive trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1.5 font-semibold">WATCH ({watchSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {watchSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {watchSignals.map(cat => {
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40 hover:bg-cyan-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥50 + improving RRG or trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 font-semibold">REDUCE ({reduceSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {reduceSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {reduceSignals.map(cat => {
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score &lt;35 + lagging/weakening RRG</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-700/30">
                Live data — scores update after each market close. Hover any ticker for details. BUY = all three conditions aligned; WATCH = two conditions met; run a backtest below to see historical performance.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-5 min-h-0">

          {/* Left column: parameters */}
          <div className="col-span-1">

            {/* Quick Presets */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Quick Presets</div>
              <div className="flex flex-col gap-1.5">
                {([
                  {
                    label: "Conservative Rotation",
                    desc: "Monthly rebalance, top 3 GICS sectors, no threshold",
                    apply: () => { setRebalanceFrequency("MONTHLY"); setTopN(3); setCategoryScope("EQUITY_SECTORS_ONLY"); setSignalThreshold(""); },
                  },
                  {
                    label: "Balanced All-Asset",
                    desc: "Monthly, top 5 including Gold & Bonds as defensive",
                    apply: () => { setRebalanceFrequency("MONTHLY"); setTopN(5); setCategoryScope("TOP_LEVEL_ONLY"); setSignalThreshold(""); },
                  },
                  {
                    label: "Aggressive Momentum",
                    desc: "Weekly, top 3, min score 0.50 — only strong signals",
                    apply: () => { setRebalanceFrequency("WEEKLY"); setTopN(3); setCategoryScope("EQUITY_SECTORS_ONLY"); setSignalThreshold("0.50"); },
                  },
                  {
                    label: "Quality Filter",
                    desc: "Quarterly rebalance, top 5, min score 0.60",
                    apply: () => { setRebalanceFrequency("QUARTERLY"); setTopN(5); setCategoryScope("TOP_LEVEL_ONLY"); setSignalThreshold("0.60"); },
                  },
                ] as const).map(preset => (
                  <button
                    key={preset.label}
                    onClick={preset.apply}
                    className="text-left px-2.5 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40 hover:bg-slate-700/70 hover:border-slate-500/60 transition-colors group"
                  >
                    <div className="text-[11px] font-semibold text-slate-300 group-hover:text-slate-100">{preset.label}</div>
                    <div className="text-[9px] text-slate-600 group-hover:text-slate-500 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 sticky top-0">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">Strategy Parameters</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Rebalance Frequency</label>
                  <select
                    value={rebalanceFrequency}
                    onChange={(e) => setRebalanceFrequency(e.target.value as "WEEKLY" | "MONTHLY" | "QUARTERLY")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Universe
                    <span className="text-slate-600 ml-1 cursor-help" title="Which categories compete for allocation. 'Equity Sectors Only' forces TECH/HLTH/FINL etc. to compete against each other — use for pure sector rotation. 'All Top-Level' adds Gold, Bonds, and Cash as defensive alternatives. 'All' also includes sub-sectors and factor ETFs.">(?)</span>
                  </label>
                  <select
                    value={categoryScope}
                    onChange={(e) => setCategoryScope(e.target.value as "ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="EQUITY_SECTORS_ONLY">Equity Sectors Only (GICS)</option>
                    <option value="TOP_LEVEL_ONLY">All Top-Level (+ Gold, Bonds)</option>
                    <option value="ALL">All (incl. Sub-Sectors)</option>
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {categoryScope === "EQUITY_SECTORS_ONLY" && "Tech vs Financials vs Energy etc. — pure GICS rotation"}
                    {categoryScope === "TOP_LEVEL_ONLY" && "Can rotate to Gold/TLT/BIL in risk-off regimes"}
                    {categoryScope === "ALL" && "Broadest universe — sub-sectors may dilute signals"}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>
                    Top-N Categories
                    <span className="text-slate-600 ml-1 cursor-help" title="Hold this many categories with the highest composite scores. Equal weight applied.">(?)</span>
                  </label>
                  <input type="number" min="1" max="19" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 5)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    Min Composite Score (0–1)
                    <span className="text-slate-600 ml-1 cursor-help" title="Categories below this score are skipped and replaced with cash (BIL). Range 0–1.">(?)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder="e.g. 0.50"
                    value={signalThreshold}
                    onChange={(e) => setSignalThreshold(e.target.value)}
                    className={`${inputCls} placeholder-slate-600`}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">Categories below threshold → cash instead</p>
                </div>
                <div>
                  <label className={labelCls}>
                    Transaction Cost (bps)
                    <span className="text-slate-600 ml-1 cursor-help" title="Trading cost charged on turnover at each rebalance (1 bp = 0.01%). ~10 bps is realistic for liquid ETFs; set 0 for a frictionless comparison.">(?)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={transactionCostBps}
                    onChange={(e) => setTransactionCostBps(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">Charged on turnover per rebalance · 0 = frictionless</p>
                </div>
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full text-sm py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRunning ? "Running…" : "▶ Run Backtest"}
                </button>
                <button
                  onClick={handleSweep}
                  disabled={isSweeping || isRunning}
                  className="w-full text-xs py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-600"
                  title="Run the backtest for all topN values (1–12) and compare performance. Takes ~15s."
                >
                  {isSweeping ? "Sweeping…" : "⚡ Sweep topN 1–12"}
                </button>
                <button
                  onClick={handleFrequencySweep}
                  disabled={isFreqSweeping || isRunning}
                  className="w-full text-xs py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-600"
                  title="Compare weekly, monthly, and quarterly rebalance frequencies. Takes ~5s."
                >
                  {isFreqSweeping ? "Sweeping…" : "⚡ Sweep W/M/Q freq"}
                </button>
              </div>
            </div>
          </div>

          {/* Right 3 columns: results */}
          <div className="col-span-3 flex flex-col gap-5">
            {runError && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm space-y-1">
                <div className="font-semibold">Backtest failed</div>
                <div className="text-red-400/80 text-[11px]">{runError}</div>
                {(runError.includes("price data") || runError.includes("benchmark")) && (
                  <div className="text-red-400/60 text-[11px] mt-1">
                    Tip: the backtest needs historical ETF price data and SPY benchmark history for the
                    range. Try a more recent start date, or run the ingestion pipeline first.
                  </div>
                )}
                {runError.includes("composite scores") && (
                  <div className="text-red-400/60 text-[11px] mt-1">
                    Tip: signal computation hasn&apos;t produced scores for this range. Run signal
                    computation, or shorten the window to the period with available data.
                  </div>
                )}
              </div>
            )}

            {!result && !isRunning && !runError && (
              <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
                Configure strategy parameters and click Run Backtest.
              </div>
            )}

            {result && (
              <>
                {/* Equity Curve */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-200">Equity Curve</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 h-0.5 bg-blue-400" />
                        Strategy (Top-{topN} {rebalanceFrequency === "WEEKLY" ? "weekly" : rebalanceFrequency === "QUARTERLY" ? "quarterly" : "monthly"})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-t border-dashed border-slate-400 opacity-60" />
                        SPY Benchmark
                      </span>
                      <button
                        onClick={() => {
                          const p0 = result.equityCurve[0]?.portfolioValue || 1;
                          const s0 = result.equityCurve[0]?.spyValue || 1;
                          const header = "date,portfolio_value,spy_value,portfolio_pct,spy_pct";
                          const rows = result.equityCurve.map(pt =>
                            `${pt.date},${pt.portfolioValue.toFixed(4)},${pt.spyValue.toFixed(4)},${((pt.portfolioValue/p0-1)*100).toFixed(4)},${((pt.spyValue/s0-1)*100).toFixed(4)}`
                          );
                          const csv = [header, ...rows].join("\n");
                          const blob = new Blob([csv], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `backtest_equity_${result.startDate}_${result.endDate}_top${topN}_${rebalanceFrequency.toLowerCase()}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Download equity curve as CSV"
                      >
                        ↓ CSV
                      </button>
                    </div>
                  </div>
                  <EquityCurveChart curve={result.equityCurve} rebalanceDates={result.rebalanceHistory?.map(e => e.date)} />
                  <div className="mt-2 border-t border-slate-700/40 pt-2">
                    <DrawdownChart curve={result.equityCurve} />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1 text-center">
                    Hypothetical · Equal-weighted top-{topN} composite score categories · No transaction costs modeled · Blue ticks = rebalance events · Lower panel = rolling drawdown from peak
                  </div>
                </div>

                {/* Alpha summary bar */}
                {(() => {
                  const excessReturn = result.totalReturnPct - result.spyTotalReturnPct;
                  const spyAnn = result.spyAnnualizedReturnPct ?? 0;
                  const annAlpha = result.annualizedReturnPct - spyAnn;
                  const sharpeDelta = (result.sharpeRatio ?? 0) - (result.spySharpeRatio ?? 0);
                  const sortinoDelta = result.sortinoRatio != null && result.spySortinoRatio != null
                    ? result.sortinoRatio - result.spySortinoRatio : null;
                  // Period win rate: % of calendar months where strategy beat SPY
                  const monthlyRows = result.equityCurve?.length > 2 ? computeMonthlyReturns(result.equityCurve) : [];
                  const beatMonths = monthlyRows.filter(r => r.port > r.spy).length;
                  const totalMonths = monthlyRows.length;
                  const winRatePct = totalMonths > 0 ? Math.round((beatMonths / totalMonths) * 100) : null;
                  const isWin = excessReturn >= 0;
                  const color = isWin ? "text-emerald-400" : "text-red-400";
                  const bg = isWin ? "bg-emerald-900/20 border-emerald-700/40" : "bg-red-900/20 border-red-700/40";
                  return (
                    <div className={`border rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap ${bg}`}>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">vs SPY Outcome</div>
                        <div className={`text-base font-bold ${color}`}>{isWin ? "Outperforms" : "Underperforms"}</div>
                      </div>
                      <div title={`Strategy total return (${result.totalReturnPct?.toFixed(2)}%) minus SPY total return (${result.spyTotalReturnPct?.toFixed(2)}%) over the same period`}>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Cumulative Alpha (vs SPY)</div>
                        <div className={`text-xl font-bold font-mono ${color}`}>{excessReturn >= 0 ? "+" : ""}{excessReturn.toFixed(2)}%</div>
                        <div className="text-[9px] text-slate-500">{result.totalReturnPct?.toFixed(1)}% − {result.spyTotalReturnPct?.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Ann. Alpha</div>
                        <div className={`text-xl font-bold font-mono ${annAlpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>{annAlpha >= 0 ? "+" : ""}{annAlpha.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sharpe Delta</div>
                        <div className={`text-xl font-bold font-mono ${sharpeDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sharpeDelta >= 0 ? "+" : ""}{sharpeDelta.toFixed(2)}</div>
                      </div>
                      {sortinoDelta != null && (
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sortino Delta</div>
                          <div className={`text-xl font-bold font-mono ${sortinoDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sortinoDelta >= 0 ? "+" : ""}{sortinoDelta.toFixed(2)}</div>
                        </div>
                      )}
                      {winRatePct != null && (
                        <div title={`Beat SPY in ${beatMonths} of ${totalMonths} calendar months`}>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Monthly Win Rate</div>
                          <div className={`text-xl font-bold font-mono ${winRatePct >= 55 ? "text-emerald-400" : winRatePct >= 45 ? "text-slate-300" : "text-red-400"}`}>
                            {winRatePct}%
                          </div>
                          <div className="text-[9px] text-slate-600">{beatMonths}/{totalMonths} months</div>
                        </div>
                      )}
                      <div className="ml-auto text-[10px] text-slate-600">
                        {result.rebalanceHistory?.length ?? 0} rebalances · {result.tradingDays} trading days
                      </div>
                    </div>
                  );
                })()}

                {/* Risk Attribution panel */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <RiskAttributionPanel curve={result.equityCurve} />
                )}

                {/* Side-by-side metrics: Strategy | Equal-Weight | SPY */}
                <div className={`grid gap-4 ${result.equalWeightTotalReturnPct != null ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2"}`}>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                      Strategy (Top-{topN})
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.totalReturnPct)} color={result.totalReturnPct >= 0 ? winColor : lossColor} tooltip="Cumulative percentage gain from start to end of backtest, before fees." />
                      <MetricCard label="Ann. Return" value={formatPct(result.annualizedReturnPct)} color={result.annualizedReturnPct >= 0 ? winColor : lossColor} tooltip="CAGR: compound annual growth rate." />
                      <MetricCard label="Max Drawdown" value={`-${result.maxDrawdownPct?.toFixed(2)}%`} color={lossColor} tooltip="Largest peak-to-trough decline. Lower is better." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.sharpeRatio)} color={(result.sharpeRatio ?? 0) >= 1 ? winColor : neutColor} tooltip="Ann. return / ann. volatility. >1.0 = good, >2.0 = excellent." />
                      {(() => {
                        const calmar = result.calmarRatio ?? (result.maxDrawdownPct > 0 ? result.annualizedReturnPct / result.maxDrawdownPct : null);
                        if (calmar == null) return null;
                        return <MetricCard label="Calmar Ratio" value={calmar.toFixed(2)} color={calmar >= 1.5 ? winColor : calmar >= 0.5 ? neutColor : lossColor} tooltip="Ann. return ÷ max drawdown. >1.5 = good; favored by trend-following funds." />;
                      })()}
                      {(() => {
                        const sortino = result.sortinoRatio ?? computeSortino(result.equityCurve, false);
                        if (sortino == null) return null;
                        return <MetricCard label="Sortino Ratio" value={sortino.toFixed(2)} color={sortino >= 1.5 ? winColor : sortino >= 0.7 ? neutColor : lossColor} tooltip="Ann. return / downside deviation (negative-return days only). Better than Sharpe for asymmetric return profiles. >1.5 = excellent." />;
                      })()}
                    </div>
                  </div>
                  {result.equalWeightTotalReturnPct != null && (
                  <div className="bg-slate-800/50 border border-amber-700/40 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                      Equal-Weight
                      <span
                        className="text-[10px] text-slate-600 cursor-help normal-case font-normal"
                        title="Holds every in-scope category equal-weighted on the same rebalance schedule (no cost). If the strategy can't beat this, the composite signal adds no value over naive diversification."
                      >(?)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.equalWeightTotalReturnPct)} color={(result.equalWeightTotalReturnPct ?? 0) > result.totalReturnPct ? lossColor : "text-amber-200"} tooltip="Equal-weight benchmark cumulative return. Red if it beat the strategy." />
                      <MetricCard label="Ann. Return" value={formatPct(result.equalWeightAnnualizedReturnPct)} color="text-amber-200" tooltip="Equal-weight CAGR over the backtest period." />
                      <MetricCard label="Max Drawdown" value={result.equalWeightMaxDrawdownPct != null ? `-${result.equalWeightMaxDrawdownPct.toFixed(2)}%` : "—"} color="text-amber-200" tooltip="Largest peak-to-trough decline for the equal-weight benchmark." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.equalWeightSharpeRatio)} color={(result.equalWeightSharpeRatio ?? 0) > (result.sharpeRatio ?? 0) ? lossColor : "text-amber-200"} tooltip="Equal-weight risk-adjusted return. Red if it beat the strategy's Sharpe." />
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                      {(result.equalWeightTotalReturnPct ?? 0) > result.totalReturnPct
                        ? "⚠ Signal underperforms naive diversification"
                        : "Signal beats equal-weight"}
                    </div>
                  </div>
                  )}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" />
                      SPY Benchmark
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.spyTotalReturnPct)} color={result.spyTotalReturnPct >= 0 ? "text-slate-300" : lossColor} />
                      <MetricCard label="Ann. Return" value={formatPct(result.spyAnnualizedReturnPct)} color="text-slate-300" tooltip="SPY CAGR over the backtest period." />
                      <MetricCard label="Max Drawdown" value={result.spyMaxDrawdownPct != null ? `-${result.spyMaxDrawdownPct.toFixed(2)}%` : "—"} color="text-slate-300" tooltip="Largest peak-to-trough decline for SPY." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.spySharpeRatio)} color="text-slate-300" />
                      {(() => {
                        const spyCalmar = result.spyCalmarRatio ?? (result.spyAnnualizedReturnPct != null && result.spyMaxDrawdownPct != null && result.spyMaxDrawdownPct > 0
                          ? result.spyAnnualizedReturnPct / result.spyMaxDrawdownPct : null);
                        if (spyCalmar == null) return null;
                        return <MetricCard label="Calmar Ratio" value={spyCalmar.toFixed(2)} color="text-slate-300" tooltip="SPY ann. return ÷ max drawdown." />;
                      })()}
                      {(() => {
                        const spySortino = result.spySortinoRatio ?? computeSortino(result.equityCurve, true);
                        if (spySortino == null) return null;
                        return <MetricCard label="Sortino Ratio" value={spySortino.toFixed(2)} color="text-slate-300" tooltip="SPY ann. return / downside deviation." />;
                      })()}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] font-mono text-slate-600">
                      {result.tradingDays} days · Run {result.runId.slice(0, 8)}
                    </div>
                  </div>
                </div>
                {/* Drawdown analysis */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <DrawdownAnalysisTable curve={result.equityCurve} />
                )}

                {/* Monthly returns calendar */}
                {result.equityCurve && result.equityCurve.length > 2 && (
                  <MonthlyReturnsTable curve={result.equityCurve} />
                )}

                {/* Annual returns bar chart */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <AnnualReturnsChart curve={result.equityCurve} />
                )}

                {/* Rolling 1-year return chart */}
                {result.equityCurve && result.equityCurve.length > ROLL_WINDOW && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-200">Rolling 1-Year Return</div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-blue-400" />Strategy</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t border-dashed border-slate-400 opacity-60" />SPY</span>
                        <span>Green = positive 1Y return · Red = drawdown period</span>
                      </div>
                    </div>
                    <RollingReturnChart curve={result.equityCurve} />
                    <div className="text-[10px] text-slate-600 mt-1 text-center">
                      Each point = trailing 252-day (1-year) return at that date. Shows consistency of strategy edge vs SPY over time.
                    </div>
                  </div>
                )}

                {/* Rolling Sharpe ratio chart */}
                {result.equityCurve && result.equityCurve.length > ROLL_WINDOW + 5 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-200">Rolling 1-Year Sharpe</div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-violet-400" />Sharpe (vs SPY)</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t border-dashed border-blue-600" />Target: 1.0</span>
                      </div>
                    </div>
                    <RollingSharpeChart curve={result.equityCurve} />
                    <div className="text-[10px] text-slate-600 mt-1 text-center">
                      Rolling 252-day Sharpe ratio of excess returns vs SPY. Above 0 = outperforming risk-adjusted · Above 1 = strong edge
                    </div>
                  </div>
                )}

                {/* Regime breakdown table */}
                {result.equityCurve && result.equityCurve.length > 0 && regimeHistory.length > 0 && (
                  <RegimeBreakdownTable curve={result.equityCurve} history={regimeHistory} />
                )}

                {/* Rotation Heatmap */}
                {result.rebalanceHistory && result.rebalanceHistory.length >= 2 && result.equityCurve && (
                  <HoldingHeatmap events={result.rebalanceHistory} curve={result.equityCurve} />
                )}

                {/* Rebalance Timeline */}
                {result.rebalanceHistory && result.rebalanceHistory.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-slate-200">Rebalance Timeline</div>
                      <span className="text-xs text-slate-500">{result.rebalanceHistory.length} rebalances · $10,000 start</span>
                    </div>
                    <RebalanceTimeline events={result.rebalanceHistory} />
                  </div>
                )}
              </>
            )}

            {/* Sweep results — shown when sweep completes */}
            {sweepResults && sweepResults.length > 0 && (
              <SweepTable rows={sweepResults} currentTopN={topN} />
            )}

            {/* Frequency sweep results */}
            {freqSweepResults && freqSweepResults.length > 0 && (
              <FrequencySweepTable rows={freqSweepResults} currentFrequency={rebalanceFrequency} />
            )}

            {/* Recent Runs — always visible */}
            {recentRuns.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-200 mb-3">Recent Runs</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-500 text-left">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Range</th>
                        <th className="pb-2 pr-3 font-medium">Freq</th>
                        <th className="pb-2 pr-3 font-medium">N</th>
                        <th className="pb-2 pr-3 font-medium text-right">Strategy</th>
                        <th className="pb-2 pr-3 font-medium text-right">SPY</th>
                        <th className="pb-2 pr-3 font-medium text-right">Excess</th>
                        <th className="pb-2 pr-3 font-medium text-right">DD</th>
                        <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
                        <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
                        <th className="pb-2 font-medium text-right">Calmar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {recentRuns.map((run) => {
                        const excess = run.totalReturnPct - run.spyTotalReturnPct;
                        const isActive = result?.runId === run.runId;
                        return (
                          <tr key={run.runId} className={`transition-colors cursor-pointer ${isActive ? "bg-blue-900/20" : "hover:bg-slate-800/40"}`} onClick={() => setResult(run)} title="Click to load this run">
                            <td className="py-1.5 pr-3 font-mono text-slate-400 tabular-nums">
                              {run.runAt?.slice(0, 10) ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-400 tabular-nums">
                              {run.startDate?.slice(0, 7)} – {run.endDate?.slice(0, 7)}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-500">{run.rebalanceFrequency === "WEEKLY" ? "W" : run.rebalanceFrequency === "QUARTERLY" ? "Q" : "M"}</td>
                            <td className="py-1.5 pr-3 text-slate-500 tabular-nums">{run.topN}</td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${run.totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {run.totalReturnPct >= 0 ? "+" : ""}{run.totalReturnPct?.toFixed(1)}%
                            </td>
                            <td className="py-1.5 pr-3 font-mono tabular-nums text-slate-400 text-right">
                              {run.spyTotalReturnPct >= 0 ? "+" : ""}{run.spyTotalReturnPct?.toFixed(1)}%
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                            </td>
                            <td className="py-1.5 pr-3 font-mono tabular-nums text-red-400 text-right">
                              -{run.maxDrawdownPct?.toFixed(1)}%
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(run.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.sharpeRatio?.toFixed(2)}
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(run.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.sortinoRatio != null ? run.sortinoRatio.toFixed(2) : "—"}
                            </td>
                            <td className={`py-1.5 font-mono tabular-nums text-right ${(run.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.calmarRatio != null ? run.calmarRatio.toFixed(2) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
