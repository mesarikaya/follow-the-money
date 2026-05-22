import { CategorySummary } from "@/lib/api";

type ExtremeEntry = {
  id: string;
  name: string;
  etfTicker: string;
  score: number;
  delta: number; // distance from extreme as fraction (0 = exactly at extreme)
};

export default function ScoreExtremesPanel({
  categories,
  scoreHistory,
}: {
  categories: CategorySummary[];
  scoreHistory: Record<string, number[]>;
}) {
  const atHighs: ExtremeEntry[] = [];
  const atLows: ExtremeEntry[] = [];

  for (const cat of categories) {
    if (cat.compositeScore == null) continue;
    const history = scoreHistory[cat.id];
    if (!history || history.length < 5) continue;

    const max30d = Math.max(...history);
    const min30d = Math.min(...history);
    const range = max30d - min30d;
    if (range < 0.05) continue; // too flat to be meaningful

    const current = cat.compositeScore;
    const fromHigh = (max30d - current) / range;
    const fromLow = (current - min30d) / range;

    if (fromHigh <= 0.08) {
      atHighs.push({ id: cat.id, name: cat.name, etfTicker: cat.etfTicker, score: current, delta: fromHigh });
    } else if (fromLow <= 0.08) {
      atLows.push({ id: cat.id, name: cat.name, etfTicker: cat.etfTicker, score: current, delta: fromLow });
    }
  }

  if (atHighs.length === 0 && atLows.length === 0) return null;

  atHighs.sort((a, b) => a.delta - b.delta);
  atLows.sort((a, b) => a.delta - b.delta);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-800/40 border border-green-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            30d Score High
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">near 30-day peak</span>
        </div>
        {atHighs.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">None near 30d high</p>
        ) : (
          atHighs.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 py-1.5 ${i < atHighs.length - 1 ? "border-b border-slate-700/40" : ""}`}
            >
              <span className="font-mono text-xs text-blue-300 w-9 shrink-0">{entry.etfTicker}</span>
              <span className="flex-1 text-xs text-slate-300 truncate">{entry.name}</span>
              <span className="text-xs tabular-nums text-green-400 shrink-0">
                {Math.round(entry.score * 100)}
              </span>
              {entry.delta === 0 ? (
                <span className="text-[9px] text-green-500 font-semibold shrink-0">▲ HIGH</span>
              ) : (
                <span className="text-[9px] text-slate-500 shrink-0">≈ high</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-slate-800/40 border border-red-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            30d Score Low
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">near 30-day trough</span>
        </div>
        {atLows.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">None near 30d low</p>
        ) : (
          atLows.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 py-1.5 ${i < atLows.length - 1 ? "border-b border-slate-700/40" : ""}`}
            >
              <span className="font-mono text-xs text-blue-300 w-9 shrink-0">{entry.etfTicker}</span>
              <span className="flex-1 text-xs text-slate-300 truncate">{entry.name}</span>
              <span className="text-xs tabular-nums text-red-400 shrink-0">
                {Math.round(entry.score * 100)}
              </span>
              {entry.delta === 0 ? (
                <span className="text-[9px] text-red-500 font-semibold shrink-0">▼ LOW</span>
              ) : (
                <span className="text-[9px] text-slate-500 shrink-0">≈ low</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
