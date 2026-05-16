import ComingSoonPage from "@/components/ComingSoonPage";

const MOCK_ALERTS = [
  {
    id: 1,
    severity: "ACTION",
    categoryName: "Technology",
    message: "Composite score breakout: 0.82 crossed 0.70 threshold",
    triggeredAt: "2026-05-16 14:30",
    status: "ACTIVE",
  },
  {
    id: 2,
    severity: "WARNING",
    categoryName: "Capital Flows",
    message: "Technology inflow z-score: +2.4σ over 20-day period",
    triggeredAt: "2026-05-16 09:15",
    status: "ACTIVE",
  },
  {
    id: 3,
    severity: "INFO",
    categoryName: "Macro",
    message: "Regime shift detected: RISK_ON_DEFENSIVE → RISK_ON_GROWTH",
    triggeredAt: "2026-05-14 16:00",
    status: "ACKNOWLEDGED",
  },
  {
    id: 4,
    severity: "WARNING",
    categoryName: "Energy",
    message: "RRG quadrant transition: Lagging → Improving",
    triggeredAt: "2026-05-13 16:00",
    status: "RESOLVED",
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  ACTION:  "bg-red-500/10 border-red-500/40 text-red-400",
  WARNING: "bg-amber-500/10 border-amber-500/40 text-amber-400",
  INFO:    "bg-blue-500/10 border-blue-500/40 text-blue-400",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:       "bg-red-500/20 text-red-300",
  ACKNOWLEDGED: "bg-zinc-500/20 text-zinc-400",
  RESOLVED:     "bg-emerald-500/20 text-emerald-400",
};

export default function AlertsPage() {
  return (
    <ComingSoonPage
      title="Alerts"
      milestone="M5"
      description="Rule-based alerts for flow surges, RRG transitions, composite breakouts, and macro regime shifts."
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 1 Action
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 1 Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" /> 2 Resolved / Acknowledged
          </span>
        </div>

        {MOCK_ALERTS.map((alert) => (
          <div
            key={alert.id}
            className={`border rounded-md px-4 py-3 ${SEVERITY_STYLES[alert.severity] ?? "border-zinc-700"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wide`}>{alert.severity}</span>
                  <span className="text-xs text-zinc-500">·</span>
                  <span className="text-xs text-zinc-500">{alert.categoryName}</span>
                </div>
                <p className="text-sm text-zinc-300">{alert.message}</p>
                <p className="text-xs text-zinc-600 mt-1">{alert.triggeredAt}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[alert.status] ?? ""}`}>
                {alert.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ComingSoonPage>
  );
}
