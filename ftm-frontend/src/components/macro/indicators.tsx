import { MacroIndicators, MacroSeriesPoint } from "@/lib/api";
import { MacroHistory, MacroStress, realYield, realYieldHistory, yieldCurveShape } from "@/lib/macro/macroMetrics";
import { INDICATOR_LABELS } from "@/components/macro/regimeConfig";

/** The tiles across the top of the macro page: the stress meter, each indicator, and the curve. */

export function MacroStressMeter({ score, components }: MacroStress) {
  const label = score >= 70 ? "High Stress" : score >= 40 ? "Moderate" : "Low Stress";
  const color = score >= 70 ? "#f87171" : score >= 40 ? "#fbbf24" : "#34d399";
  const bgColor = score >= 70 ? "border-red-700/50 bg-red-950/20" : score >= 40 ? "border-amber-700/50 bg-amber-950/15" : "border-emerald-700/40 bg-emerald-950/10";
  const W = 240, H = 12;
  return (
    <div className={`bg-slate-800/60 border rounded-xl px-4 py-3 space-y-2.5 ${bgColor}`}
      title="Composite macro stress score: weighted blend of VIX z-score (40%), yield curve inversion (35%), USD strength vs 1Y avg (15%), and breakeven inflation deviation from 2.2% (10%). 0 = calm, 100 = maximum stress.">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">Macro Stress</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{label}</span>
          <span className="text-xl font-bold tabular-nums" style={{ color, fontFamily: "var(--font-jetbrains-mono)" }}>
            {score}
          </span>
          <span className="text-[10px] text-slate-600">/100</span>
        </div>
      </div>
      <div className="space-y-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-3">
          <rect x={0} y={0} width={W} height={H} rx={H / 2} fill="#1e293b" />
          <rect x={0} y={0} width={Math.round(score / 100 * W)} height={H} rx={H / 2} fill={color} opacity="0.85" />
        </svg>
        <div className="flex items-center gap-3 flex-wrap">
          {components.map(c => {
            const cColor = c.score >= 70 ? "text-red-400" : c.score >= 40 ? "text-amber-400" : "text-emerald-400";
            return (
              <span key={c.label} className="text-[10px] flex items-center gap-1 text-slate-500">
                {c.label}
                <span className={`font-mono ${cColor}`}>{c.score}</span>
                <span className="text-slate-700">({c.weight}%)</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function IndicatorSparkline({ points, seriesId }: { points: MacroSeriesPoint[]; seriesId: string }) {
  if (!points || points.length < 2) return null;
  const W = 120, H = 32, padX = 2, padY = 4;
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const toX = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const toY = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);
  const last = points[points.length - 1].value;
  const first = points[0].value;
  const isUp = last >= first;
  const strokeColor = isUp ? "#34d399" : "#f87171";
  const polyline = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");
  const dotY = toY(last);
  void seriesId;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={polyline} fill="none" stroke={strokeColor} strokeWidth="1.5" opacity="0.7" />
      <circle cx={toX(points.length - 1).toFixed(1)} cy={dotY.toFixed(1)} r="2" fill={strokeColor} />
    </svg>
  );
}

export function IndicatorCard({
  indicatorKey,
  value,
  previousValue,
  history,
}: {
  indicatorKey: keyof MacroIndicators;
  value: number | null;
  previousValue: number | null;
  history?: MacroSeriesPoint[];
}) {
  const config = INDICATOR_LABELS[indicatorKey];
  if (!config) return null;

  let trendEl: React.ReactNode = null;
  if (value != null && previousValue != null) {
    const delta = value - previousValue;
    const absDelta = Math.abs(delta);
    const threshold = Math.abs(previousValue) * 0.001;
    if (absDelta <= threshold) {
      trendEl = <span className="flex items-center gap-1 text-slate-500">→ Unchanged</span>;
    } else {
      const up = delta > 0;
      const arrow = up ? "↑" : "↓";
      const wasStr = config.format(previousValue);
      trendEl = (
        <span className="flex items-center gap-1 text-slate-400">
          <span>{arrow}</span>
          <span>was {wasStr}</span>
        </span>
      );
    }
  }

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-1"
      title={config.tooltip}
    >
      <div className="text-xs text-slate-500">{config.label}</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-100">{config.format(value)}</div>
      {trendEl && <div className="text-xs">{trendEl}</div>}
      {history && history.length > 1 && (
        <div className="pt-1">
          <IndicatorSparkline points={history} seriesId={config.series} />
        </div>
      )}
      <div className="text-[10px] text-slate-600">Series: {config.series} · 1Y · FRED</div>
    </div>
  );
}

type YieldPoint = { label: string; maturity: number; value: number };

export function YieldCurveChart({ indicators }: { indicators: MacroIndicators }) {
  const raw: { label: string; maturity: number; value: number | null }[] = [
    { label: "FF", maturity: 0,  value: indicators.fedFundsRate },
    { label: "2Y", maturity: 2,  value: indicators.twoYearYield },
    { label: "10Y", maturity: 10, value: indicators.tenYearYield },
  ];
  const points: YieldPoint[] = raw.filter((p): p is YieldPoint => p.value != null);
  if (points.length < 2) return null;

  const spread = (indicators.tenYearYield ?? 0) - (indicators.twoYearYield ?? 0);
  const shapeLabel = yieldCurveShape(indicators);
  const isInverted = shapeLabel === "Inverted";
  const isFlat = shapeLabel === "Flat";
  const shapeColor = isInverted ? "text-red-400" : isFlat ? "text-amber-400" : "text-emerald-400";
  const lineColor  = isInverted ? "#f87171"    : isFlat ? "#fbbf24"    : "#34d399";

  const W = 300, H = 80, padX = 36, padY = 10;
  const values = points.map(p => p.value);
  const yMin = Math.min(...values) - 0.4;
  const yMax = Math.max(...values) + 0.4;
  const yRange = yMax - yMin || 1;
  const maxMat = 10;

  const toX = (mat: number) => padX + (mat / maxMat) * (W - padX * 2);
  const toY = (v: number) => padY + (1 - (v - yMin) / yRange) * (H - padY * 2 - 14);
  const polyline = points.map(p => `${toX(p.maturity).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");

  const yGridValues = [Math.floor(yMin * 2) / 2, Math.ceil(yMax * 2) / 2];

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-1"
      title="Term structure (yield curve): Fed Funds rate, 2Y Treasury, 10Y Treasury. Shape indicates economic cycle phase — inverted curves precede recessions."
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Yield Curve</span>
        <span className={`text-xs font-semibold tabular-nums ${shapeColor}`}>
          {shapeLabel}
          {spread != null && (
            <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
              10Y–2Y {spread >= 0 ? "+" : ""}{spread.toFixed(2)}%
            </span>
          )}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        {/* Y-axis grid lines */}
        {yGridValues.map(v => (
          <g key={v}>
            <line x1={padX} y1={toY(v).toFixed(1)} x2={W - 10} y2={toY(v).toFixed(1)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,2" />
            <text x={padX - 4} y={(toY(v) + 3).toFixed(1)} fill="#475569" fontSize="7" textAnchor="end">{v.toFixed(1)}%</text>
          </g>
        ))}
        {/* Fill area under curve */}
        <polygon
          points={`${toX(points[0].maturity).toFixed(1)},${(H - 14).toFixed(1)} ${polyline} ${toX(points[points.length - 1].maturity).toFixed(1)},${(H - 14).toFixed(1)}`}
          fill={lineColor}
          opacity="0.08"
        />
        {/* Curve line */}
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" />
        {/* Data points */}
        {points.map(p => (
          <g key={p.maturity}>
            <circle cx={toX(p.maturity).toFixed(1)} cy={toY(p.value).toFixed(1)} r="3" fill={lineColor} />
            <text x={toX(p.maturity).toFixed(1)} y={(H - 4).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="middle">{p.label}</text>
            <text x={toX(p.maturity).toFixed(1)} y={(toY(p.value) - 5).toFixed(1)} fill="#94a3b8" fontSize="7.5" textAnchor="middle">
              {p.value.toFixed(2)}%
            </text>
          </g>
        ))}
      </svg>

      <div className="text-[9px] text-slate-600">
        FF (overnight) · 2Y · 10Y · FRED · Inverted = recession signal · Normal = growth
      </div>
    </div>
  );
}

export function RealYieldCard({ indicators, history }: { indicators: MacroIndicators; history: MacroHistory }) {
  const currentRealYield = realYield(indicators);
  if (currentRealYield == null) return null;

  const realHistory = realYieldHistory(history);

  const isNegative = currentRealYield < 0;
  const isExtreme = currentRealYield < -1 || currentRealYield > 2;
  const label = currentRealYield < -1
    ? "Deeply Negative"
    : currentRealYield < 0
    ? "Negative"
    : currentRealYield < 1
    ? "Low Positive"
    : currentRealYield < 2
    ? "Moderate"
    : "Elevated";
  const color = currentRealYield < 0 ? "text-emerald-400" : currentRealYield < 1.5 ? "text-amber-400" : "text-red-400";
  const interpretation = currentRealYield < -0.5
    ? "Stimulative — favors risk assets, growth stocks, gold"
    : currentRealYield < 0.5
    ? "Near-neutral — modest headwind to valuations"
    : "Restrictive — headwind for long-duration assets";

  const W = 280, H = 44, padX = 4, padY = 6;
  const sparkColor = isNegative ? "#34d399" : isExtreme ? "#f87171" : "#fbbf24";
  const hasSparkline = realHistory.length >= 5;
  const sparkMin = hasSparkline ? Math.min(...realHistory) - 0.1 : 0;
  const sparkMax = hasSparkline ? Math.max(...realHistory) + 0.1 : 1;
  const sparkRange = sparkMax - sparkMin || 1;
  const toSX = (i: number) => padX + (i / (realHistory.length - 1)) * (W - padX * 2);
  const toSY = (v: number) => padY + (1 - (v - sparkMin) / sparkRange) * (H - padY * 2);
  const sparkPts = realHistory.map((v, i) => `${toSX(i).toFixed(1)},${toSY(v).toFixed(1)}`).join(" ");
  const zeroY = sparkMin < 0 && sparkMax > 0 ? toSY(0) : null;

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-1"
      title={`Real 10Y yield = nominal DGS10 minus T10YIE breakeven. Negative = real rates below inflation; gold and growth equities historically outperform. Current: ${currentRealYield.toFixed(2)}%`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">Real 10Y Yield</span>
        <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${color}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {currentRealYield >= 0 ? "+" : ""}{currentRealYield.toFixed(2)}%
      </div>
      {hasSparkline && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8">
          {zeroY != null && (
            <line x1={padX} x2={W - padX} y1={zeroY.toFixed(1)} y2={zeroY.toFixed(1)}
              stroke="#475569" strokeWidth="0.8" strokeDasharray="2,3" />
          )}
          <polyline points={sparkPts} fill="none" stroke={sparkColor} strokeWidth="1.5" opacity="0.8" />
          <circle cx={toSX(realHistory.length - 1).toFixed(1)} cy={toSY(currentRealYield).toFixed(1)} r="2.5" fill={sparkColor} />
        </svg>
      )}
      <div className="text-[9px] text-slate-600">{interpretation}</div>
    </div>
  );
}
