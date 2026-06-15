import { PriorityAction, ActionVerb, Urgency, ConvictionTier } from "@/lib/prioritySynthesizer";

const VERB_CONFIG: Record<ActionVerb, { label: string; cls: string }> = {
  ENTRY: { label: "ENTRY",  cls: "bg-emerald-500/25 text-emerald-200 border-emerald-500/40" },
  ADD:   { label: "ADD",    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-600/30" },
  WATCH: { label: "WATCH",  cls: "bg-cyan-500/15 text-cyan-300 border-cyan-600/30"          },
  TRIM:  { label: "TRIM",   cls: "bg-amber-500/20 text-amber-300 border-amber-600/30"       },
  AVOID: { label: "AVOID",  cls: "bg-red-500/20 text-red-300 border-red-600/30"             },
};

const CONVICTION_CONFIG: Record<ConvictionTier, { cls: string }> = {
  HIGH:   { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  MEDIUM: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30"       },
  LOW:    { cls: "bg-slate-700/40 text-slate-500 border-slate-600/30"       },
};

const URGENCY_CONFIG: Record<Urgency, { label: string; dotCls: string }> = {
  NOW:         { label: "NOW",       dotCls: "bg-red-400 animate-pulse" },
  "THIS WEEK": { label: "THIS WEEK", dotCls: "bg-amber-400" },
  MONITOR:     { label: "MONITOR",   dotCls: "bg-slate-500" },
};

function ScoreSparkline({ scores, verb }: { scores: number[]; verb: ActionVerb }) {
  if (scores.length < 2) return null;

  const W = 56;
  const H = 20;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 0.001;
  const xs = scores.map((_, i) => (i / (scores.length - 1)) * W);
  const ys = scores.map(v => H - ((v - min) / range) * (H - 2) - 1);
  const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  const rising = scores[scores.length - 1] > scores[0];
  const strokeColor =
    (verb === "ENTRY" || verb === "ADD") && rising  ? "#34d399" :  // emerald
    (verb === "TRIM"  || verb === "AVOID") && !rising ? "#f87171" :  // red
    "#64748b";                                                         // slate

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 opacity-70"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={xs[xs.length - 1]}
        cy={ys[ys.length - 1]}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

type RowProps = {
  action: PriorityAction;
  scores: number[];
};

function PriorityRow({ action, scores }: RowProps) {
  const verb = VERB_CONFIG[action.verb];
  const urgency = URGENCY_CONFIG[action.urgency];

  return (
    <div className="py-3 border-b border-slate-800/60 last:border-0">
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className="shrink-0 w-5 text-center text-xs font-bold text-slate-600 mt-0.5">
          {action.rank}
        </span>

        {/* Verb badge */}
        <span
          className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded border mt-0.5 ${verb.cls}`}
        >
          {verb.label}
        </span>

        {/* ETF + name */}
        <div className="shrink-0 flex flex-col w-24 min-w-0">
          <span className="text-[11px] font-mono font-semibold text-slate-200">{action.etfTicker}</span>
          <span className="text-[9px] text-slate-500 truncate">{action.categoryName}</span>
        </div>

        {/* Rationale */}
        <p className="flex-1 text-[10px] text-slate-400 leading-relaxed min-w-0">
          {action.rationale}
          {action.winRatePct !== null && (
            <span className="ml-1.5 text-emerald-600/70">
              · {action.winRatePct}% win rate
            </span>
          )}
        </p>

        {/* 30-day sparkline */}
        {scores.length >= 2 && (
          <div className="shrink-0 mt-0.5" title="30-day composite score trend">
            <ScoreSparkline scores={scores} verb={action.verb} />
          </div>
        )}

        {/* Urgency */}
        <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${urgency.dotCls}`} />
          <span className="text-[9px] text-slate-500 font-mono">{urgency.label}</span>
        </div>
      </div>

      {/* Conviction tier + sizing hint + price context + risk note (secondary row) */}
      <div className="ml-8 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${CONVICTION_CONFIG[action.conviction].cls}`}
          title="Signal conviction: HIGH = all factors align (score percentile + macro + quadrant + win rate)"
        >
          {action.conviction}
        </span>
        <span className="text-[9px] text-slate-500">{action.sizingHint}</span>
        {action.priceContext && (
          <span className="text-[9px] text-slate-600 font-mono bg-slate-800/40 px-1.5 py-0.5 rounded">
            📍 {action.priceContext}
          </span>
        )}
        {action.riskNote && (
          <span className="text-[9px] text-amber-700/80 italic">
            ⚠ {action.riskNote}
          </span>
        )}
      </div>
    </div>
  );
}

type Props = {
  actions: PriorityAction[];
  scoreHistory: Record<string, number[]>;
};

export default function TodaysPriorityPanel({ actions, scoreHistory }: Props) {
  if (actions.length === 0) return null;

  const nowCount = actions.filter(a => a.urgency === "NOW").length;
  const entryCount = actions.filter(a => a.verb === "ENTRY").length;
  const trimCount = actions.filter(a => a.verb === "TRIM" || a.verb === "AVOID").length;

  return (
    <section className="bg-slate-800/60 border border-slate-600/40 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h2
            className="text-sm font-bold text-slate-100 tracking-wide"
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.04em" }}
          >
            Today&apos;s Priorities
          </h2>
          <span
            className="text-[10px] text-slate-600 cursor-help"
            title="Synthesis of approaching signal transitions, fresh crossovers, and momentum confirmations. Ranked by urgency and conviction. Sparkline = 30-day composite score."
          >
            (?)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {nowCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 font-semibold">
              {nowCount} NOW
            </span>
          )}
          {entryCount > 0 && (
            <span className="text-emerald-500/70">↑{entryCount} entry</span>
          )}
          {trimCount > 0 && (
            <span className="text-amber-500/70">↓{trimCount} exit</span>
          )}
        </div>
      </div>

      <div className="text-[9px] text-slate-600 mb-3">
        Rank · Verb · ETF / Sector · Rationale · Sparkline (30d) · Urgency
      </div>

      <div>
        {actions.map(a => (
          <PriorityRow
            key={a.categoryId}
            action={a}
            scores={scoreHistory[a.categoryId] ?? []}
          />
        ))}
      </div>

      <p className="mt-3 text-[9px] text-slate-700 leading-relaxed">
        Synthesized from signal transitions, momentum velocity, and RRG quadrant confirmation.
        Not financial advice — verify before acting.
      </p>
    </section>
  );
}
