"use client";

import { useEffect, useState } from "react";
import { fetchAlertSeverityHistory, AlertSeverityDayDto } from "@/lib/api";

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

export default function AlertSeverityTimeline({ days = 30 }: { days?: number }) {
  const [history, setHistory] = useState<AlertSeverityDayDto[] | null>(null);

  useEffect(() => {
    fetchAlertSeverityHistory(days)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [days]);

  if (history === null) {
    return (
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="h-4 bg-slate-700/40 rounded w-40 animate-pulse" />
      </section>
    );
  }

  if (history.length === 0) return null;

  const maxTotal = Math.max(
    1,
    ...history.map(d => d.urgentCount + d.actionCount + d.warningCount + d.infoCount)
  );

  return (
    <section data-testid="alert-severity-timeline" className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-200 mb-1">Alert Activity</h2>
      <p className="text-[10px] text-slate-500 mb-3">Daily alert fires by severity — last {days} days</p>

      <div className="flex items-end gap-[2px] h-16">
        {history.map((day) => {
          const total = day.urgentCount + day.actionCount + day.warningCount + day.infoCount;
          const heightPct = Math.round((total / maxTotal) * 100);
          const urgentPct  = total > 0 ? Math.round((day.urgentCount / total) * 100) : 0;
          const actionPct  = total > 0 ? Math.round((day.actionCount / total) * 100) : 0;
          const warningPct = total > 0 ? Math.round((day.warningCount / total) * 100) : 0;
          const infoPct    = 100 - urgentPct - actionPct - warningPct;
          const label = formatDate(day.date);
          const tooltip = `${label}: ${total} fires (${day.urgentCount} URGENT, ${day.actionCount} ACTION, ${day.warningCount} WARNING, ${day.infoCount} INFO)`;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end"
              style={{ height: "100%" }}
              title={tooltip}
            >
              <div className="w-full overflow-hidden rounded-sm" style={{ height: `${heightPct}%` }}>
                {infoPct > 0 && (
                  <div className="w-full bg-blue-600/60" style={{ height: `${infoPct}%` }} />
                )}
                {warningPct > 0 && (
                  <div className="w-full bg-amber-500/70" style={{ height: `${warningPct}%` }} />
                )}
                {actionPct > 0 && (
                  <div className="w-full bg-red-700/70" style={{ height: `${actionPct}%` }} />
                )}
                {urgentPct > 0 && (
                  <div className="w-full bg-red-500 shadow-[0_0_4px_1px_rgba(239,68,68,0.4)]" style={{ height: `${urgentPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />URGENT
        </span>
        <span className="text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-700/70 mr-1" />ACTION
        </span>
        <span className="text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70 mr-1" />WARNING
        </span>
        <span className="text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-600/60 mr-1" />INFO
        </span>
      </div>
    </section>
  );
}
