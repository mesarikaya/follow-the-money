import { RotationResponse } from "@/lib/api";

const QUADRANT_LABELS: Record<number, string> = {
  1: "Lagging",
  2: "Weakening",
  3: "Improving",
  4: "Leading",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  ENTERING_IMPROVING:  "Entered Improving",
  ENTERING_LEADING:    "Entered Leading",
  COMPOSITE_BREAKOUT:  "Composite Breakout",
  FLOW_SURGE:          "Flow Surge",
};

function compositeScoreBar(score: number | null) {
  if (score === null) return null;
  const percent = Math.round(score * 100);
  const colorClass =
    percent >= 70 ? "bg-emerald-500" :
    percent >= 50 ? "bg-blue-500" :
    percent >= 30 ? "bg-amber-500" :
    "bg-red-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right">{percent}</span>
    </div>
  );
}

type Props = { rotation: RotationResponse };

export default function RotationPanel({ rotation }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
          Top Leaders
        </h3>
        <ul className="space-y-2">
          {rotation.topLeaders.length === 0 && (
            <li className="text-xs text-slate-500">No data yet</li>
          )}
          {rotation.topLeaders.map((leader) => (
            <li key={leader.categoryId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{leader.categoryName}</span>
                <span className="text-xs text-slate-500">{leader.categoryId}</span>
              </div>
              <div className="flex items-center gap-2">
                {compositeScoreBar(leader.compositeScore)}
                {leader.relativeRotationGraphQuadrant != null && (
                  <span className="text-xs text-slate-500 shrink-0">
                    {QUADRANT_LABELS[leader.relativeRotationGraphQuadrant] ?? "—"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
          Bottom Laggards
        </h3>
        <ul className="space-y-2">
          {rotation.bottomLaggards.length === 0 && (
            <li className="text-xs text-slate-500">No data yet</li>
          )}
          {rotation.bottomLaggards.map((laggard) => (
            <li key={laggard.categoryId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{laggard.categoryName}</span>
                <span className="text-xs text-slate-500">{laggard.categoryId}</span>
              </div>
              <div className="flex items-center gap-2">
                {compositeScoreBar(laggard.compositeScore)}
                {laggard.relativeRotationGraphQuadrant != null && (
                  <span className="text-xs text-slate-500 shrink-0">
                    {QUADRANT_LABELS[laggard.relativeRotationGraphQuadrant] ?? "—"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Recent Events
        </h3>
        <ul className="space-y-2">
          {rotation.recentEvents.length === 0 && (
            <li className="text-xs text-slate-500">No rotation events in the last 90 days</li>
          )}
          {rotation.recentEvents.slice(0, 6).map((event, index) => (
            <li key={index} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">
                  {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                </span>
                <span className="text-xs text-slate-600 font-mono">
                  {String(event.detectedDate)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{event.categoryName}</span>
                <span className="text-xs text-slate-600">
                  {Math.round(Number(event.confidence) * 100)}% confidence
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
