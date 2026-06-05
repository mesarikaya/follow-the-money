import { fetchSubSectors, fetchCategoryScoreHistory, SubSectorSummary } from "@/lib/api";

const QUADRANT_LABELS: Record<string, string> = {
  "4": "↗ Leading",
  "3": "↖ Improving",
  "2": "↘ Weakening",
  "1": "↙ Lagging",
};

const QUADRANT_COLORS: Record<string, string> = {
  "4": "text-green-400",
  "3": "text-cyan-400",
  "2": "text-orange-400",
  "1": "text-slate-400",
};

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  MTUM: "Follows stocks with strong recent price momentum. Leads in risk-on environments.",
  QUAL: "Targets high-ROE, low-leverage stocks. Defensive in drawdowns.",
  USMV: "Minimizes portfolio volatility. Outperforms in choppy markets.",
  VLUE: "Selects undervalued stocks by price-to-book and earnings. Mean-reversion play.",
};

function rs60Color(rs60: number | null): string {
  if (rs60 === null) return "text-slate-500";
  if (rs60 >= 1.05) return "text-emerald-400";
  if (rs60 >= 1.0) return "text-blue-400";
  if (rs60 >= 0.95) return "text-amber-400";
  return "text-red-400";
}

function formatRs(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3);
}

function formatMom(value: number | null): string {
  if (value === null) return "—";
  const pct = (value * 100).toFixed(1);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}

const FACTOR_COLORS: Record<string, { stroke: string; label: string }> = {
  MTUM: { stroke: "#34d399", label: "MTUM" },
  QUAL: { stroke: "#60a5fa", label: "QUAL" },
  USMV: { stroke: "#fbbf24", label: "USMV" },
  VLUE: { stroke: "#c084fc", label: "VLUE" },
};

function FactorScoreHistoryChart({ scoreHistory }: { scoreHistory: Record<string, number[]> }) {
  const series = Object.entries(FACTOR_COLORS)
    .map(([id, cfg]) => ({ id, ...cfg, scores: scoreHistory[id] ?? [] }))
    .filter(s => s.scores.length >= 5);

  if (series.length === 0) return null;

  const DAYS = Math.min(60, Math.max(...series.map(s => s.scores.length)));
  const W = 520, H = 130, padL = 36, padR = 14, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const toX = (i: number, n: number) => padL + (i / (n - 1)) * innerW;
  const toY = (v: number) => padT + (1 - v) * innerH;

  const xLabelIdxs = [0, Math.floor(DAYS * 0.25), Math.floor(DAYS * 0.5), Math.floor(DAYS * 0.75), DAYS - 1];
  const daysAgo = xLabelIdxs.map(i => -(DAYS - 1 - i));

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">Factor Score History</div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          {series.map(s => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: s.stroke }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "110px" }}>
        {/* Gridlines at 0.25, 0.5, 0.75 */}
        {[0.25, 0.5, 0.75].map((f, i) => {
          const y = toY(f);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4" />
              <text x={padL - 4} y={y + 3} fontSize="7" fill="#475569" textAnchor="end">{Math.round(f * 100)}</text>
            </g>
          );
        })}
        {/* Series lines */}
        {series.map(({ id, stroke, scores }) => {
          const slice = scores.slice(-DAYS);
          if (slice.length < 2) return null;
          const pts = slice.map((v, i) => `${toX(i, slice.length).toFixed(1)},${toY(v).toFixed(1)}`);
          const last = slice[slice.length - 1];
          const lastX = toX(slice.length - 1, slice.length);
          return (
            <g key={id}>
              <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.8" opacity="0.9" />
              <circle cx={lastX.toFixed(1)} cy={toY(last).toFixed(1)} r="2.5" fill={stroke} />
            </g>
          );
        })}
        {/* X-axis labels */}
        {xLabelIdxs.map((_, i) => {
          const x = toX(xLabelIdxs[i], DAYS);
          const d = daysAgo[i];
          return (
            <text key={i} x={x.toFixed(1)} y={H - 4} fontSize="7" fill="#475569" textAnchor="middle">
              {d === 0 ? "now" : `${d}d`}
            </text>
          );
        })}
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#334155" strokeWidth="0.5" />
      </svg>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Composite signal score 0–100 · {DAYS}-day history · MTUM rising = risk-on shift
      </div>
    </div>
  );
}

function FactorComparisonStrip({ factors }: { factors: SubSectorSummary[] }) {
  const withRs = factors.filter((f) => f.rs60 !== null);
  if (withRs.length === 0) return null;

  const sorted = [...withRs].sort((a, b) => (b.rs60 ?? 0) - (a.rs60 ?? 0));

  return (
    <div className="mb-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RS-60 Ranking vs SPY</span>
        <span className="text-[10px] text-slate-600">Par = 1.000 · positive deviation = outperforming · ↗↘ = accel vs 120d</span>
      </div>
      {sorted.map((factor, idx) => {
        const rs = factor.rs60 ?? 0;
        const deviation = rs - 1.0;
        const barPct = Math.min(Math.abs(deviation) / 0.12 * 100, 100);
        const isAbove = rs >= 1.0;
        const rank = idx + 1;
        const rankColor = rank === 1 ? "text-emerald-400" : rank === sorted.length ? "text-red-400" : "text-slate-500";
        const barColor = isAbove ? "bg-emerald-500/60" : "bg-red-500/60";
        const valColor = isAbove ? "text-emerald-400" : "text-red-400";
        const accel = factor.rs120 != null ? rs - factor.rs120 : null;
        const accelPositive = accel !== null && accel > 0.002;
        const accelNegative = accel !== null && accel < -0.002;

        return (
          <div key={factor.id} className="flex items-center gap-3">
            <span className={`text-[11px] font-bold tabular-nums w-5 ${rankColor}`}>#{rank}</span>
            <span className="text-xs font-mono font-semibold text-slate-200 w-12 shrink-0">{factor.etfTicker}</span>
            <div className="flex-1 bg-slate-700/40 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
            </div>
            <span
              className={`text-xs font-mono tabular-nums w-14 text-right ${valColor}`}
              title={accel != null ? `RS-60: ${rs.toFixed(4)} | vs 120d: ${accel >= 0 ? "+" : ""}${(accel * 100).toFixed(2)}%` : undefined}
            >
              {rs.toFixed(3)}
            </span>
            <span className="w-4 text-center shrink-0">
              {accelPositive && <span className="text-[10px] text-emerald-400">↗</span>}
              {accelNegative && <span className="text-[10px] text-red-400">↘</span>}
            </span>
            <span className="text-[10px] text-slate-500 w-14 text-right tabular-nums">
              {deviation >= 0 ? "+" : ""}{(deviation * 100).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ score, trend5d, trend20d }: { score: number | null; trend5d: number | null | undefined; trend20d: number | null | undefined }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const filled = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  const textColor = score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="bg-slate-900/40 rounded p-2 flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 shrink-0">Signal</span>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`w-1.5 h-2.5 rounded-[1px] ${i < filled ? barColor : "bg-slate-700"}`} />
          ))}
        </div>
        <span className={`text-xs font-mono tabular-nums ${textColor}`}>{pct}</span>
        {trend5d != null && Math.abs(trend5d * 100) >= 1 && (
          <span className={`text-[9px] tabular-nums ${trend5d > 0 ? "text-emerald-400" : "text-red-400"}`}
            title={`5d trend: ${trend5d > 0 ? "+" : ""}${Math.round(trend5d * 100)}pt`}>
            {trend5d > 0 ? "↑" : "↓"}{Math.abs(Math.round(trend5d * 100))}
          </span>
        )}
        {trend20d != null && Math.abs(trend20d * 100) >= 1 && (
          <span className={`text-[9px] tabular-nums ${trend20d > 0 ? "text-emerald-400/60" : "text-red-400/60"}`}
            title={`20d trend: ${trend20d > 0 ? "+" : ""}${Math.round(trend20d * 100)}pt`}>
            {trend20d > 0 ? "↑" : "↓"}{Math.abs(Math.round(trend20d * 100))}
          </span>
        )}
      </div>
    </div>
  );
}

function FactorCard({ factor }: { factor: SubSectorSummary }) {
  const quadrantLabel = factor.rrgQuadrant ? QUADRANT_LABELS[factor.rrgQuadrant] : "—";
  const quadrantColor = factor.rrgQuadrant ? QUADRANT_COLORS[factor.rrgQuadrant] : "text-slate-500";
  const rs60Class = rs60Color(factor.rs60);
  const description = FACTOR_DESCRIPTIONS[factor.id] ?? "";

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">{factor.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/60 rounded px-2 py-1 shrink-0">
          {factor.etfTicker}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">RS vs SPY</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">20d</span>
              <span className={`font-mono ${rs60Color(factor.rs20)}`}>{formatRs(factor.rs20)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">60d</span>
              <span className="flex items-center gap-1">
                <span className={`font-mono font-bold ${rs60Class}`}>{formatRs(factor.rs60)}</span>
                {factor.rs120 !== null && factor.rs60 !== null && Math.abs(factor.rs60 - factor.rs120) >= 0.002 && (
                  <span className={`text-[9px] ${factor.rs60 > factor.rs120 ? "text-emerald-400" : "text-red-400"}`}>
                    {factor.rs60 > factor.rs120 ? "↗" : "↘"}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">120d</span>
              <span className={`font-mono ${rs60Color(factor.rs120)}`}>{formatRs(factor.rs120)}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">Momentum</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">MOM</span>
              <span className={`font-mono ${factor.momentum !== null && factor.momentum >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatMom(factor.momentum)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">RRG</span>
              <span className={`text-right ${quadrantColor}`}>{quadrantLabel}</span>
            </div>
          </div>
        </div>
      </div>
      <ScoreBar score={factor.compositeScore} trend5d={factor.compositeTrend5d} trend20d={factor.compositeTrend20d} />
    </div>
  );
}

type RegimeSignal = {
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
};

function FactorHistoricalContext({ factors }: { factors: SubSectorSummary[] }) {
  const withPct = factors.filter(f => f.scorePercentile252d != null && f.compositeScore != null);
  if (withPct.length === 0) return null;

  return (
    <div className="mb-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Score vs 252-Day Historical Range
        </span>
        <span className="text-[10px] text-slate-600">percentile rank of current score vs trailing year</span>
      </div>
      <div className="space-y-3">
        {withPct.map(f => {
          const pct = Math.round((f.scorePercentile252d ?? 0) * 100);
          const score = Math.round((f.compositeScore ?? 0) * 100);
          const pctColor = pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-lime-400" : pct >= 40 ? "text-amber-400" : "text-red-400";
          const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-lime-500" : pct >= 40 ? "bg-amber-500" : "bg-red-600";
          const label = pct >= 80 ? "Near 1Y High" : pct >= 60 ? "Above Avg" : pct >= 40 ? "Below Avg" : "Near 1Y Low";
          return (
            <div key={f.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-200 w-10">{f.etfTicker}</span>
                  <span className="text-[9px] text-slate-500 hidden sm:inline">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] tabular-nums ${pctColor}`}
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {label}
                  </span>
                  <span className="text-[9px] text-slate-500 tabular-nums"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    score {score} · P{pct}
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                  style={{ width: `${pct}%`, opacity: 0.85 }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/60 rounded-full"
                  style={{ left: `${score}%` }}
                  title={`Current score: ${score}/100`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-slate-600 mt-2">
        Bar = score percentile rank vs trailing 252 days · white tick = current score position · P80+ = historically strong
      </div>
    </div>
  );
}

function deriveFactorRegime(factors: SubSectorSummary[]): RegimeSignal | null {
  const withRs = factors.filter(f => f.rs60 !== null);
  if (withRs.length < 2) return null;
  const sorted = [...withRs].sort((a, b) => (b.rs60 ?? 0) - (a.rs60 ?? 0));
  const rankOf = (id: string) => sorted.findIndex(f => f.id === id) + 1 || 99;
  const mtum = rankOf("MTUM");
  const usmv = rankOf("USMV");
  const qual = rankOf("QUAL");
  const n = sorted.length;

  if (mtum === 1 && usmv === n) return { label: "Strong Risk-On", description: "Momentum dominant, low-vol at bottom — market in high-conviction risk-on phase", colorClass: "text-emerald-300", borderClass: "border-emerald-700/50", bgClass: "bg-emerald-900/20" };
  if (usmv === 1 && mtum === n) return { label: "Strong Risk-Off", description: "Low-vol dominant, momentum at bottom — capital rotating to defensives", colorClass: "text-amber-300", borderClass: "border-amber-700/50", bgClass: "bg-amber-900/20" };
  if (mtum <= 2 && usmv >= 3)  return { label: "Risk-On",         description: "Momentum in top half — market favoring growth and higher-beta exposure", colorClass: "text-emerald-400", borderClass: "border-emerald-800/40", bgClass: "bg-emerald-900/15" };
  if (usmv <= 2 && mtum >= 3)  return { label: "Risk-Off",        description: "Low-vol in top half — defensive rotation underway, monitor breadth", colorClass: "text-amber-400",   borderClass: "border-amber-800/40",  bgClass: "bg-amber-900/15"  };
  if (qual === 1 && mtum <= 2) return { label: "Late Cycle / Quality", description: "Quality momentum leads — often signals late-cycle selectivity with narrowing leadership", colorClass: "text-blue-300", borderClass: "border-blue-700/40", bgClass: "bg-blue-900/20" };
  return { label: "Transitional", description: "No clear factor dominance — factors in mixed rotation, await confirmation", colorClass: "text-slate-300", borderClass: "border-slate-700/40", bgClass: "bg-slate-800/40" };
}

export default async function FactorFlowsPage() {
  let factors: SubSectorSummary[] = [];
  let scoreHistory: Record<string, number[]> = {};
  let error: string | null = null;

  const [factorsResult, historyResult] = await Promise.allSettled([
    fetchSubSectors("FTRS"),
    fetchCategoryScoreHistory(60),
  ]);

  if (factorsResult.status === "fulfilled") {
    factors = factorsResult.value;
  } else {
    error = factorsResult.reason instanceof Error ? factorsResult.reason.message : "Failed to load factor data";
  }
  if (historyResult.status === "fulfilled") {
    scoreHistory = historyResult.value;
  }

  const regime = factors.length > 0 ? deriveFactorRegime(factors) : null;

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Factor Flows
          </h1>
          <span className="text-[11px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            4 factor ETFs · MTUM · QUAL · USMV · VLUE
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Smart-money rotation across factor ETFs vs SPY. MTUM leading = risk-on; USMV leading = risk-off.
        </p>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {factors.length === 0 && !error && (
          <div className="text-slate-500 text-sm">
            No factor data yet. Trigger ingestion to compute signals for MTUM, QUAL, USMV, VLUE.
          </div>
        )}

        {regime && (
          <div className={`mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg border ${regime.bgClass} ${regime.borderClass}`}>
            <span className={`text-sm font-bold ${regime.colorClass}`}>{regime.label}</span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-400">{regime.description}</span>
          </div>
        )}

        {factors.some(f => f.scorePercentile252d != null) && (
          <FactorHistoricalContext factors={factors} />
        )}

        {Object.keys(scoreHistory).some(k => FACTOR_COLORS[k]) && (
          <FactorScoreHistoryChart scoreHistory={scoreHistory} />
        )}

        <FactorComparisonStrip factors={factors} />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {factors.map((factor) => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
        </div>

        {factors.length > 0 && (
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Factor rotation signals
            </h3>
            <p className="text-xs text-slate-500">
              RS &gt; 1.0 means the factor is outperforming SPY. When Momentum (MTUM) leads and Low
              Volatility (USMV) lags, the market is in a risk-on environment. The reverse suggests
              risk aversion. Quality (QUAL) leading Value (VLUE) often signals late-cycle dynamics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
