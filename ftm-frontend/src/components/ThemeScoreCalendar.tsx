import { ThemeHistoryPoint } from "@/lib/api";

const WEEKS = 13;
const DAYS_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function scoreColor(score: number | null): string {
  if (score == null) return "rgba(30,41,59,0.8)";
  if (score >= 0.65) {
    const intensity = 0.25 + Math.min(1, (score - 0.65) / 0.35) * 0.75;
    return `rgba(52,211,153,${intensity.toFixed(2)})`;
  }
  if (score >= 0.50) {
    const intensity = 0.25 + ((score - 0.50) / 0.15) * 0.75;
    return `rgba(34,211,238,${intensity.toFixed(2)})`;
  }
  if (score >= 0.35) {
    const intensity = 0.25 + ((score - 0.35) / 0.15) * 0.75;
    return `rgba(251,191,36,${intensity.toFixed(2)})`;
  }
  const intensity = 0.2 + (score / 0.35) * 0.6;
  return `rgba(248,113,113,${intensity.toFixed(2)})`;
}

export default function ThemeScoreCalendar({ history }: { history: ThemeHistoryPoint[] }) {
  const total = WEEKS * 7;
  const padded: (ThemeHistoryPoint | null)[] = [
    ...Array(Math.max(0, total - history.length)).fill(null),
    ...history.slice(-total),
  ];

  return (
    <div
      data-testid="theme-score-calendar"
      className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Score Calendar — 13 Weeks</span>
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-600">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: "rgba(248,113,113,0.7)" }} />
          REDUCE
          <span className="w-2 h-2 rounded-sm inline-block ml-1" style={{ backgroundColor: "rgba(251,191,36,0.7)" }} />
          HOLD
          <span className="w-2 h-2 rounded-sm inline-block ml-1" style={{ backgroundColor: "rgba(34,211,238,0.7)" }} />
          WATCH
          <span className="w-2 h-2 rounded-sm inline-block ml-1" style={{ backgroundColor: "rgba(52,211,153,0.9)" }} />
          BUY
        </div>
      </div>

      <div className="flex gap-1">
        <div className="flex flex-col gap-0.5 mr-0.5 justify-around py-0.5">
          {DAYS_LABELS.map(d => (
            <span key={d} className="text-[7px] font-mono text-slate-600 leading-none w-6 text-right pr-0.5">
              {d}
            </span>
          ))}
        </div>

        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: WEEKS }).map((_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-0.5 flex-1">
              {Array.from({ length: 7 }).map((_, dayIdx) => {
                const point = padded[weekIdx * 7 + dayIdx];
                const score = point?.compositeScore ?? null;
                const pct = score != null ? Math.round(score * 100) : null;
                const tip = point ? `${point.date}: ${pct}` : "No data";
                return (
                  <div
                    key={dayIdx}
                    className="h-3 rounded-sm min-w-0"
                    style={{ backgroundColor: scoreColor(score) }}
                    title={tip}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-[7px] font-mono text-slate-700">
            {padded.find(p => p != null)?.date ?? ""}
          </span>
          <span className="text-[7px] font-mono text-slate-700">
            {padded[padded.length - 1]?.date ?? ""}
          </span>
        </div>
      )}
    </div>
  );
}
