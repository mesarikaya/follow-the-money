import { CategorySummary } from "@/lib/api";

const PHASE_MAP: Record<string, { phase: string; label: string; description: string; colorClass: string; borderClass: string }> = {
  EARLY_BULL:   { phase: "Phase 1", label: "Early Bull",   description: "Growth sectors leading — risk appetite rising", colorClass: "text-emerald-300", borderClass: "border-emerald-700/40" },
  LATE_BULL:    { phase: "Phase 2", label: "Late Bull",    description: "Cyclical sectors leading — expansion maturing",  colorClass: "text-blue-300",    borderClass: "border-blue-700/40"    },
  EARLY_BEAR:   { phase: "Phase 3", label: "Early Bear",   description: "Defensive sectors rotating in — caution rising",  colorClass: "text-orange-300",  borderClass: "border-orange-700/40"  },
  LATE_BEAR:    { phase: "Phase 4", label: "Late Bear",    description: "Flight-to-quality in force — risk-off dominant",  colorClass: "text-red-300",     borderClass: "border-red-700/40"     },
  TRANSITION:   { phase: "Mixed",   label: "Rotation",     description: "No dominant phase — sectors rotating",           colorClass: "text-slate-300",   borderClass: "border-slate-600/40"   },
};

const GROWTH_SECTORS  = new Set(["TECH", "FINL", "DISR"]);
const CYCLICAL_SECTORS = new Set(["INDU", "ENRG", "MATL", "COMM"]);
const DEFENSIVE_SECTORS = new Set(["HLTH", "STPL", "UTIL"]);
const REAL_ASSET_SECTORS = new Set(["REIT"]);

function detectPhase(leadingIds: string[]): keyof typeof PHASE_MAP {
  if (leadingIds.length === 0) return "TRANSITION";

  const growthCount    = leadingIds.filter(id => GROWTH_SECTORS.has(id)).length;
  const cyclicalCount  = leadingIds.filter(id => CYCLICAL_SECTORS.has(id)).length;
  const defensiveCount = leadingIds.filter(id => DEFENSIVE_SECTORS.has(id) || REAL_ASSET_SECTORS.has(id)).length;
  const total = leadingIds.length;

  const growthShare    = growthCount    / total;
  const cyclicalShare  = cyclicalCount  / total;
  const defensiveShare = defensiveCount / total;

  if (growthShare >= 0.5) return "EARLY_BULL";
  if (cyclicalShare >= 0.4) return "LATE_BULL";
  if (defensiveShare >= 0.4) return "EARLY_BEAR";
  if (defensiveShare > growthShare && defensiveShare > cyclicalShare) return "LATE_BEAR";
  return "TRANSITION";
}

export default function RotationPhaseIndicator({ categories }: { categories: CategorySummary[] }) {
  const equitySectors = categories.filter(c => c.type === "EQUITY_SECTOR");
  if (equitySectors.length === 0) return null;

  const leading = equitySectors.filter(c => c.rrgQuadrant === "4");
  const improving = equitySectors.filter(c => c.rrgQuadrant === "3");

  if (leading.length === 0 && improving.length === 0) return null;

  const phaseKey = detectPhase(leading.map(c => c.id));
  const phaseConfig = PHASE_MAP[phaseKey];

  const totalEquity = equitySectors.length;
  const leadingPct = Math.round((leading.length / totalEquity) * 100);
  const improvingPct = Math.round((improving.length / totalEquity) * 100);

  return (
    <div
      className={`bg-slate-800/40 border ${phaseConfig.borderClass} rounded-xl px-4 py-3 flex items-center gap-6`}
      title={phaseConfig.description}
    >
      <div className="shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5"
          style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.1em" }}>
          Rotation Phase
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-slate-600"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {phaseConfig.phase}
          </span>
          <span className={`text-sm font-bold ${phaseConfig.colorClass}`}
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}>
            {phaseConfig.label}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 max-w-[180px]">{phaseConfig.description}</div>
      </div>

      <div className="h-8 w-px bg-slate-700 shrink-0" />

      <div className="flex items-start gap-6 flex-1 flex-wrap">
        {leading.length > 0 && (
          <div className="shrink-0">
            <div className="text-[10px] text-green-500 uppercase mb-1"
              style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>
              ↗ Leading ({leadingPct}%)
            </div>
            <div className="flex flex-wrap gap-1">
              {leading.map(c => (
                <span key={c.id}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 border border-green-700/30 text-green-300"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  title={c.name}>
                  {c.etfTicker}
                </span>
              ))}
            </div>
          </div>
        )}
        {improving.length > 0 && (
          <div className="shrink-0">
            <div className="text-[10px] text-cyan-500 uppercase mb-1"
              style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>
              ↖ Improving ({improvingPct}%)
            </div>
            <div className="flex flex-wrap gap-1">
              {improving.map(c => (
                <span key={c.id}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 border border-cyan-700/30 text-cyan-300"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  title={c.name}>
                  {c.etfTicker}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
