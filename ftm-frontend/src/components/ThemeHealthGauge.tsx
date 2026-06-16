import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

type HealthZone = "RISK OFF" | "CAUTION" | "NEUTRAL" | "RISK ON";

function computeHealthScore(themes: ThemeSummary[]): number {
  if (themes.length === 0) return 50;
  let sum = 0;
  for (const t of themes) {
    if (t.dominantSignal === "BUY") sum += 2;
    else if (t.dominantSignal === "WATCH") sum += 1;
    else if (t.dominantSignal === "HOLD") sum += 0;
    else if (t.dominantSignal === "REDUCE") sum += -1;
  }
  const maxScore = themes.length * 2;
  const minScore = themes.length * -1;
  return Math.round(((sum - minScore) / (maxScore - minScore)) * 100);
}

function healthZone(score: number): { zone: HealthZone; color: string; arcColor: string; needleColor: string } {
  if (score >= 72) return { zone: "RISK ON", color: "text-emerald-400", arcColor: "#34d399", needleColor: "#34d399" };
  if (score >= 48) return { zone: "NEUTRAL", color: "text-slate-400", arcColor: "#64748b", needleColor: "#94a3b8" };
  if (score >= 28) return { zone: "CAUTION", color: "text-amber-400", arcColor: "#fbbf24", needleColor: "#fbbf24" };
  return { zone: "RISK OFF", color: "text-red-400", arcColor: "#f87171", needleColor: "#f87171" };
}

const BULLISH_PHASES = new Set(["BREAKOUT", "MOMENTUM", "SETUP"]);
const BEARISH_PHASES = new Set(["FADING", "WEAK", "DISTRIBUTE"]);

export default function ThemeHealthGauge({ themes }: Props) {
  if (themes.length === 0) return null;

  const score = computeHealthScore(themes);
  const { zone, color, arcColor, needleColor } = healthZone(score);

  const buyCount = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchCount = themes.filter(t => t.dominantSignal === "WATCH").length;
  const holdCount = themes.filter(t => t.dominantSignal === "HOLD").length;
  const reduceCount = themes.filter(t => t.dominantSignal === "REDUCE").length;

  const bullishPhases = themes.filter(t => t.themePhase && BULLISH_PHASES.has(t.themePhase)).length;
  const bearishPhases = themes.filter(t => t.themePhase && BEARISH_PHASES.has(t.themePhase)).length;

  const avgTrend = themes
    .filter(t => t.compositeTrend5d != null)
    .reduce((sum, t) => sum + (t.compositeTrend5d ?? 0), 0) /
    Math.max(1, themes.filter(t => t.compositeTrend5d != null).length);

  // SVG gauge: semi-circle arc, needle from 180° (left/bearish) to 0° (right/bullish)
  const W = 200, H = 110;
  const cx = W / 2, cy = H - 10;
  const R = 78, rInner = 60;

  // Angle: 180° = score 0 (bearish), 0° = score 100 (bullish); we sweep 180°
  const angleRad = Math.PI * (1 - score / 100);
  const needleX = cx + R * 0.72 * Math.cos(angleRad);
  const needleY = cy - R * 0.72 * Math.sin(angleRad);

  // Background arc: full 180° from 180° to 0°
  const bgArcStart = { x: cx - R, y: cy };
  const bgArcEnd = { x: cx + R, y: cy };

  // Active arc: from 180° to current angle
  const activeArcEndX = cx + R * Math.cos(angleRad);
  const activeArcEndY = cy - R * Math.sin(angleRad);
  const largeArc = score >= 50 ? 0 : 1;

  // Zone band colors (4 bands of 25° each)
  const zoneBands = [
    { color: "#f87171", start: Math.PI, end: Math.PI * 0.75 },  // 0-25 risk-off
    { color: "#fbbf24", start: Math.PI * 0.75, end: Math.PI * 0.5 }, // 25-50 caution
    { color: "#64748b", start: Math.PI * 0.5, end: Math.PI * 0.25 }, // 50-75 neutral
    { color: "#34d399", start: Math.PI * 0.25, end: 0 },             // 75-100 risk-on
  ];

  function arcPath(startAngle: number, endAngle: number, r: number, rI: number) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    const xi1 = cx + rI * Math.cos(startAngle);
    const yi1 = cy - rI * Math.sin(startAngle);
    const xi2 = cx + rI * Math.cos(endAngle);
    const yi2 = cy - rI * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2} L ${xi2} ${yi2} A ${rI} ${rI} 0 0 1 ${xi1} ${yi1} Z`;
  }

  return (
    <div
      data-testid="theme-health-gauge"
      className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4"
    >
      <div className="flex items-start gap-4">
        {/* SVG Gauge */}
        <div className="shrink-0">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {/* Zone bands */}
            {zoneBands.map((b, i) => (
              <path
                key={i}
                d={arcPath(b.start, b.end, R, rInner)}
                fill={b.color}
                opacity="0.18"
              />
            ))}
            {/* Active arc fill */}
            <path
              d={`M ${bgArcStart.x} ${bgArcStart.y} A ${R} ${R} 0 ${largeArc} 0 ${activeArcEndX} ${activeArcEndY} L ${cx + rInner * Math.cos(angleRad)} ${cy - rInner * Math.sin(angleRad)} A ${rInner} ${rInner} 0 ${largeArc} 1 ${cx - rInner} ${cy} Z`}
              fill={arcColor}
              opacity="0.25"
            />
            {/* Outer arc track */}
            <path
              d={`M ${bgArcStart.x} ${bgArcStart.y} A ${R} ${R} 0 0 0 ${bgArcEnd.x} ${bgArcEnd.y}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth="18"
            />
            {/* Zone band outlines */}
            {zoneBands.map((b, i) => (
              <path
                key={i}
                d={arcPath(b.start, b.end, R, rInner)}
                fill="none"
                stroke={b.color}
                strokeWidth="0.5"
                opacity="0.4"
              />
            ))}
            {/* Needle */}
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              stroke={needleColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r="5" fill={needleColor} opacity="0.9" />
            <circle cx={cx} cy={cy} r="3" fill="#0f172a" />

            {/* Score label */}
            <text x={cx} y={cy - 22} textAnchor="middle" fill={arcColor} fontSize="20" fontFamily="monospace" fontWeight="700">
              {score}
            </text>

            {/* Zone label */}
            <text x={cx} y={cy - 6} textAnchor="middle" fill={arcColor} fontSize="8" fontFamily="monospace" letterSpacing="1">
              {zone}
            </text>

            {/* Axis labels */}
            <text x={cx - R - 4} y={cy + 12} fill="#374151" fontSize="7" textAnchor="end" fontFamily="monospace">bearish</text>
            <text x={cx + R + 4} y={cy + 12} fill="#374151" fontSize="7" textAnchor="start" fontFamily="monospace">bullish</text>
          </svg>
        </div>

        {/* Stats sidebar */}
        <div className="flex-1 pt-2 space-y-3">
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Theme Signals</div>
            <div className="flex flex-wrap gap-2">
              {buyCount > 0 && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  {buyCount} BUY
                </span>
              )}
              {watchCount > 0 && (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                  {watchCount} WATCH
                </span>
              )}
              {holdCount > 0 && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-700/40 border border-slate-600/30 px-1.5 py-0.5 rounded">
                  {holdCount} HOLD
                </span>
              )}
              {reduceCount > 0 && (
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                  {reduceCount} REDUCE
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Phase Breakdown</div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-emerald-400">{bullishPhases} bullish</span>
              {bearishPhases > 0 && <span className="text-red-400">{bearishPhases} fading</span>}
              <span className="text-slate-600">of {themes.length}</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Avg 5d Trend</div>
            <span className={`text-[10px] font-mono ${avgTrend > 0.003 ? "text-emerald-400" : avgTrend < -0.003 ? "text-red-400" : "text-slate-400"}`}>
              {avgTrend > 0 ? "+" : ""}{(avgTrend * 100).toFixed(2)}pt/d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
