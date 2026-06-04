"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAlerts, acknowledgeAlert, bulkDismissAlerts, fetchAlertRules, setAlertRuleEnabled, AlertsResponse, AlertDto, AlertRuleDto } from "@/lib/api";

function parseSnapshot(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function SnapshotViewer({ raw }: { raw: string | null }) {
  const [open, setOpen] = useState(false);
  const data = parseSnapshot(raw);
  if (!data) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        {open ? "▲ hide details" : "▼ signal snapshot"}
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(data).map(([key, val]) => (
            <span key={key} className="text-[10px] font-mono">
              <span className="text-slate-600">{key}:</span>{" "}
              <span className="text-slate-300">{String(val)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, { badge: string; row: string }> = {
  URGENT:  { badge: "bg-red-800/90 text-red-200 border border-red-600/60",      row: "bg-red-950/30"    },
  ACTION:  { badge: "bg-red-900/80 text-red-300 border border-red-700/50",      row: "bg-red-950/20"    },
  WARNING: { badge: "bg-amber-900/80 text-amber-300 border border-amber-700/50", row: "bg-amber-950/15" },
  INFO:    { badge: "bg-blue-900/80 text-blue-300 border border-blue-700/50",   row: "bg-blue-950/10"   },
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:       "text-amber-400",
  ACKNOWLEDGED: "text-slate-400",
  RESOLVED:     "text-emerald-400",
};

const RULE_LABELS: Record<string, string> = {
  rrg_transition:      "RRG Transition",
  composite_breakout:  "Composite Breakout",
  composite_breakdown: "Composite Breakdown",
  macro_regime_shift:  "Macro Regime Shift",
  rs_accel_crossover:     "RS Accel Crossover",
  persistence_low:        "Persistence Low",
  breadth_velocity_accel: "Breadth Velocity ↑",
  breadth_velocity_decel: "Breadth Velocity ↓",
  trade_signal_buy:       "BUY Signal",
  trade_signal_reduce:    "REDUCE Signal",
  score_approaching_buy:    "Approaching BUY",
  score_approaching_reduce: "Approaching REDUCE",
  high_conviction_buy:            "High Conviction BUY",
  high_conviction_cluster:        "High Conviction Cluster",
  high_conviction_reduce_cluster: "RISK-OFF Cluster",
  signal_deterioration:           "BUY Momentum Reversal",
  rs_aligned_bull:                "RS Aligned ⊕",
  rs_aligned_bear:                "RS Aligned ⊖",
  rs_breadth_bull:                "RS Breadth ⊕",
  rs_breadth_bear:                "RS Breadth ⊖",
  pre_buy_flow_surge:             "Pre-BUY Flow Surge",
  flow_surge:                     "Flow Surge",
  rrg_rs_divergence:              "RRG/RS Divergence",
  score_percentile_extreme:       "Percentile Extreme",
  score_velocity:                 "Score Velocity",
  multi_alert_bull_confluence:    "Multi-Signal Confluence",
  cross_horizon_rs_divergence:    "Cross-Horizon RS Divergence",
  macro_sector_mismatch:          "Macro/Sector Mismatch",
  flow_inflow_5d:         "Flow Inflow (5d)",
  flow_inflow_10d:        "Flow Inflow (10d)",
  flow_inflow_20d:        "Flow Inflow (20d)",
  flow_outflow_5d:        "Flow Outflow (5d)",
  flow_outflow_10d:       "Flow Outflow (10d)",
  flow_outflow_20d:       "Flow Outflow (20d)",
};

const BUILTIN_RULES = [
  { id: "multi_alert_bull_confluence", label: "Multi-Signal Confluence", condition: "≥3 bullish alerts simultaneously active for one sector", severity: "ACTION", note: "Meta-alert: fires when a single sector has 3 or more bullish signals aligned at the same time — e.g., trade_signal_buy + high_conviction_buy + rs_aligned_bull together. Multiple concurrent signals rarely happen by coincidence; they indicate broad institutional agreement and a high-confidence rotation setup. Resolves when active bullish alert count drops below 3. (Checked last in each evaluation cycle so it captures alerts fired in the same day.)" },
  { id: "cross_horizon_rs_divergence", label: "Cross-Horizon RS Divergence", condition: "RS-20 vs RS-60 direction contradicts RS-60 vs RS-120 direction", severity: "WARNING", note: "Counter-trend / pullback identifier: fires when the short-term RS slope (RS-20 vs RS-60) contradicts the medium-term RS slope (RS-60 vs RS-120). Two patterns: COUNTER_TREND_BOUNCE — RS-20 > RS-60 but RS-60 < RS-120 (short-term strength embedded in a structurally weak sector — fade candidate); PULLBACK_IN_BULL — RS-20 < RS-60 but RS-60 > RS-120 (short-term weakness in a structurally strong sector — potential entry point on the dip). Resolves when both RS slopes agree in direction. Used as an early-turn detector before formal RRG quadrant changes appear." },
  { id: "macro_sector_mismatch", label: "Macro/Sector Mismatch", condition: "Cyclical sector in RRG Leading/Improving during RISK_OFF or STAGFLATION regime", severity: "WARNING", note: "Anomalous rotation alert: fires when a cyclical sector (TECH, DISR, FINL, INDU, ENRG, MATL) shows RRG Leading or Improving momentum while the macro regime is RISK_OFF_FLIGHT or STAGFLATION. This mismatch can signal: (1) the market is early-pricing an economic recovery before macro data confirms it — watch for follow-through; or (2) a false leader that will reverse once risk-off pressure intensifies. Use to tighten stop-losses or scale in cautiously. Resolves when the regime returns to risk-on, or the sector exits quadrant 3/4." },
  { id: "score_velocity", label: "Score Velocity", condition: "5d score change ≥ +12pts (SURGE) or ≤ -12pts (CRASH)", severity: "WARNING", note: "Rate-of-change alert: fires when a sector's composite score moves 12+ percentage points in either direction over 5 trading days. A SURGE (e.g. +14pts in 5d) signals unusual momentum acceleration — the sector is heating up fast regardless of absolute score level. A CRASH signals rapid deterioration — early warning before the formal REDUCE signal. Distinct from score_approaching_buy which tracks absolute score level. Resolves when trend moderates back inside ±5pts." },
  { id: "score_percentile_extreme", label: "Percentile Extreme", condition: "score ≥ 90th or ≤ 10th percentile (252d)", severity: "WARNING", note: "Historical extreme alert: fires when a sector's composite score is at its highest or lowest point in the past 252 trading days. A 90th-percentile HIGH signals potential mean reversion risk (sector may be overextended). A 10th-percentile LOW signals a historically depressed setup — watch for turnaround signals. Resolves when percentile returns to 20th–80th range." },
  { id: "rrg_rs_divergence", label: "RRG/RS Divergence", condition: "RRG quadrant contradicts RS-20 vs RS-60", severity: "WARNING", note: "Early turn signal: fires when a Leading/Improving sector already has RS-20 < RS-60 (momentum cracking before the chart shows it), or when a Lagging/Weakening sector has RS-20 > RS-60 (recovery emerging before the chart catches up). Resolves when the divergence closes." },
  { id: "rs_breadth_bull",   label: "RS Breadth ⊕",       condition: "≥60% of equity sectors have RS-20 > RS-60",  severity: "INFO",    note: "Broad market momentum: when 60%+ of GICS sectors show short-term RS above medium-term RS, it signals institutional rotation is broadly positive — a regime-level tailwind. Resolves below 45%." },
  { id: "rs_breadth_bear",   label: "RS Breadth ⊖",       condition: "≥60% of equity sectors have RS-20 < RS-60",  severity: "WARNING", note: "Broad market deterioration: when 60%+ of GICS sectors show short-term RS below medium-term RS, momentum is broadly deteriorating — market-wide risk-off pressure. Resolves below 45%." },
  { id: "rs_aligned_bull",   label: "RS Aligned ⊕",       condition: "RS-20 > RS-60 > RS-120 (all horizons aligned)", severity: "INFO",    note: "Multi-horizon RS confirmation: short, medium, and long-term RS all in alignment. The strongest RS momentum signal — all three timeframes agree on outperformance." },
  { id: "rs_aligned_bear",   label: "RS Aligned ⊖",       condition: "RS-20 < RS-60 < RS-120 (all horizons aligned)", severity: "WARNING", note: "Multi-horizon RS deterioration: all three RS timeframes confirm sustained underperformance. The most bearish RS configuration — avoid or reduce." },
  { id: "high_conviction_cluster", label: "High Conviction Cluster", condition: "≥3 sectors at conviction ≥75 simultaneously", severity: "ACTION", note: "Broad RISK-ON regime confirmation: when 3+ sectors simultaneously reach multi-factor conviction ≥75. Rarer than individual alerts — indicates a market-wide regime shift, not just one sector." },
  { id: "high_conviction_reduce_cluster", label: "RISK-OFF Cluster", condition: "≥3 sectors at REDUCE conviction ≥40", severity: "ACTION", note: "Broad RISK-OFF regime signal: when 3+ sectors simultaneously reach REDUCE conviction ≥40. Indicates systemic deterioration across the market — consider broad de-risking." },
  { id: "pre_buy_flow_surge", label: "Pre-BUY Flow Surge", condition: "score in [50,65) + flow ≥ +1.5σ",          severity: "WARNING", note: "Institutional positioning signal: score approaching BUY territory AND unusual inflow volume. Institutions often accumulate before price confirms — this leads the formal BUY by 1-3 days." },
  { id: "high_conviction_buy",    label: "High Conviction BUY",   condition: "conviction score ≥ 75",           severity: "ACTION",  note: "Multi-factor conviction ≥75: signal quality + macro fit + 252d percentile + momentum acceleration — the highest-quality BUY signals only" },
  { id: "trade_signal_buy",       label: "BUY Signal",            condition: "score ≥ 65, RRG 3/4, trend > 0",  severity: "ACTION",  note: "Full BUY signal: all 3 conditions align for the first time — most actionable alert" },
  { id: "score_approaching_buy",  label: "Approaching BUY",       condition: "score enters [55, 65)",           severity: "INFO",    note: "Early warning 1-5 days before a full BUY signal — prepare position" },
  { id: "trade_signal_reduce",      label: "REDUCE Signal",         condition: "score < 35, RRG 1/2",              severity: "WARNING", note: "REDUCE signal: score and RRG both deteriorating — consider trimming" },
  { id: "score_approaching_reduce", label: "Approaching REDUCE",    condition: "score drops into (35, 45]",        severity: "WARNING", note: "Early warning before full REDUCE — score entering deterioration zone" },
  { id: "signal_deterioration",     label: "BUY Momentum Reversal", condition: "score ≥ 65 but 5d trend < -5pts",  severity: "WARNING", note: "BUY position at risk: composite score still in BUY territory but declining sharply in 5 days. Monitor for signal exit — precedes a formal REDUCE alert by 3–7 days on average." },
  { id: "rrg_transition",         label: "RRG Transition",        condition: "RRG quadrant changes",            severity: "INFO",    note: "Category enters any new RRG quadrant (Leading/Improving/Weakening/Lagging)" },
  { id: "composite_breakout",     label: "Composite Breakout",    condition: "composite_score > 0.70",          severity: "ACTION",  note: "Score crosses above 0.70 — entering strong signal territory" },
  { id: "composite_breakdown",    label: "Composite Breakdown",   condition: "composite_score < 0.35",          severity: "WARNING", note: "Score falls below 0.35 — REDUCE threshold crossed" },
  { id: "macro_regime_shift",     label: "Macro Regime Shift",    condition: "regime changes",                  severity: "WARNING", note: "Macro regime changes on new data — re-evaluate macro-fit scores" },
  { id: "rs_accel_crossover",     label: "RS Accel Crossover",    condition: "rs_60 crosses rs_120",            severity: "INFO",    note: "Near-term RS crosses long-term baseline — momentum inflection" },
  { id: "breadth_velocity_accel", label: "Breadth Velocity ↑",   condition: "5d rate sharply above 15d rate", severity: "INFO",    note: "Hit-rate accelerating: sector outperforming benchmark at an increasing rate over recent 5 days" },
  { id: "breadth_velocity_decel", label: "Breadth Velocity ↓",   condition: "5d rate sharply below 15d rate", severity: "WARNING", note: "Hit-rate decelerating: sector outperformance fading vs recent baseline" },
  { id: "persistence_low",        label: "Persistence Low",       condition: "persistence_20d < threshold",     severity: "WARNING", note: "Sector beats its benchmark on fewer than 7 of the last 20 trading days" },
  { id: "flow_inflow_20d",        label: "Flow Inflow (20d)",     condition: "flow_20d > threshold",            severity: "INFO",    note: "Sustained 20-day inflow above baseline (not yet implemented — ETF flow data pending)" },
  { id: "flow_outflow_20d",       label: "Flow Outflow (20d)",    condition: "flow_20d < threshold",            severity: "WARNING", note: "Sustained 20-day outflow below baseline (not yet implemented — ETF flow data pending)" },
];

function formatAlertDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return isoString; }
}

function alertAgeBadge(isoString: string): { label: string; cls: string } | null {
  try {
    const ageMs = Date.now() - new Date(isoString).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    if (ageDays >= 7) return { label: `${ageDays}d`, cls: "text-amber-600/70 bg-amber-950/20 border border-amber-900/30" };
    if (ageDays >= 1) return { label: `${ageDays}d`, cls: "text-slate-600 bg-slate-700/30 border border-slate-700" };
    if (ageHours >= 1) return { label: `${ageHours}h`, cls: "text-slate-700 bg-slate-700/20 border border-slate-800" };
    return null; // brand new — no badge needed
  } catch { return null; }
}

function formatDateShort(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return isoString; }
}

const AUTO_REFRESH_SECS = 60;

export default function AlertsPage() {
  const [alertsResponse, setAlertsResponse] = useState<AlertsResponse | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRuleDto[] | null>(null);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [bulkDismissing, setBulkDismissing] = useState(false);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECS);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlertsResponse(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      const rules = await fetchAlertRules();
      setAlertRules(rules);
    } catch { /* rules are optional */ }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setCountdown(AUTO_REFRESH_SECS);
    await Promise.all([loadAlerts(), loadRules()]);
  }, [loadAlerts, loadRules]);

  useEffect(() => { loadAlerts(); loadRules(); }, [loadAlerts, loadRules]);

  // Auto-refresh countdown: reload alerts every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(s => {
        if (s <= 1) { loadAlerts(); return AUTO_REFRESH_SECS; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    setTogglingRule(ruleId);
    try {
      const updated = await setAlertRuleEnabled(ruleId, !currentEnabled);
      setAlertRules(prev => prev ? prev.map(r => r.ruleId === ruleId ? updated : r) : prev);
    } catch { /* ignore toggle errors silently */ } finally {
      setTogglingRule(null);
    }
  };

  const handleBulkDismiss = async () => {
    setBulkDismissing(true);
    setAcknowledgeError(null);
    try {
      await bulkDismissAlerts();
      await loadAlerts();
    } catch (error) {
      setAcknowledgeError(String(error));
    } finally {
      setBulkDismissing(false);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    setAcknowledging(alertId);
    setAcknowledgeError(null);
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (error) {
      setAcknowledgeError(String(error));
    } finally {
      setAcknowledging(null);
    }
  };

  const allAlerts = alertsResponse?.alerts ?? [];
  const activeAlerts  = allAlerts.filter(a => a.status === "ACTIVE").sort((a, b) => {
    const order: Record<string, number> = { URGENT: 0, ACTION: 1, WARNING: 2, INFO: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });
  const historyAlerts = allAlerts.filter(a => a.status !== "ACTIVE")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const activeCount  = alertsResponse?.activeCount ?? 0;
  const urgentCount  = activeAlerts.filter(a => a.severity === "URGENT").length;
  const actionCount  = activeAlerts.filter(a => a.severity === "ACTION").length;
  const warningCount = activeAlerts.filter(a => a.severity === "WARNING").length;

  const severityBadgeCls = (sev: string) => SEVERITY_STYLES[sev]?.badge ?? "bg-slate-700 text-slate-300 border border-slate-600";
  const rowBgCls         = (sev: string) => SEVERITY_STYLES[sev]?.row ?? "";

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Alerts
          </h1>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-semibold">{activeCount}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {urgentCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block animate-pulse" /> {urgentCount} Urgent</span>}
          {actionCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {actionCount} Action</span>}
          {warningCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {warningCount} Warning</span>}
          {alertRules && <span className="text-slate-600">· {alertRules.length} rules loaded</span>}
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition-colors"
            title="Refresh alerts now"
          >
            <span className="text-[11px]">⟳</span>
            <span className="tabular-nums text-[10px]">{countdown}s</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {(acknowledgeError || loadError) && (
          <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm flex items-center justify-between">
            <span>{acknowledgeError ? `Failed to acknowledge: ${acknowledgeError}` : `Failed to load alerts: ${loadError}`}</span>
            <button onClick={() => { setAcknowledgeError(null); setLoadError(null); }} className="ml-4 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">

          {/* Left 2/3: Alerts + History + Rules */}
          <div className="col-span-2 flex flex-col gap-5">

            {/* Active Alerts */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                <span className="text-sm font-semibold text-slate-200">Active Alerts</span>
                <span className="text-[10px] text-slate-500 ml-1" title="Alerts fire after each ingestion. Acknowledge to suppress until next trigger.">(?)
</span>
                {activeAlerts.length > 1 && (
                  <button
                    onClick={handleBulkDismiss}
                    disabled={bulkDismissing}
                    className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                  >
                    {bulkDismissing ? "Dismissing…" : `Dismiss all ${activeAlerts.length}`}
                  </button>
                )}
              </div>

              {!alertsResponse && !loadError && (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</div>
              )}
              {alertsResponse && activeAlerts.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No active alerts. Alerts fire after signal computation runs.
                </div>
              )}
              {activeAlerts.map((alert: AlertDto) => (
                <div key={alert.id} className={`px-4 py-3 border-b border-slate-700 last:border-0 flex items-start gap-3 ${rowBgCls(alert.severity)}`}>
                  <div className="mt-0.5 shrink-0">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {alert.categoryId && (
                        <span className="font-mono text-sm font-semibold text-slate-200">{alert.categoryId}</span>
                      )}
                      <span className="text-xs text-slate-500">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {(() => {
                          const age = alertAgeBadge(alert.createdAt);
                          if (!age) return null;
                          return (
                            <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${age.cls}`} title={`Alert has been active for ${age.label}`}>
                              {age.label}
                            </span>
                          );
                        })()}
                        <span className="text-xs text-slate-600">{formatAlertDate(alert.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">{alert.message}</p>
                    <SnapshotViewer raw={alert.triggerSnapshot} />
                  </div>
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                    className="shrink-0 text-xs text-slate-500 hover:text-slate-300 border border-slate-600 hover:border-slate-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {acknowledging === alert.id ? "…" : "Dismiss"}
                  </button>
                </div>
              ))}
            </div>

            {/* Alert History */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">Alert History</span>
                <span className="text-xs text-slate-500">— acknowledged &amp; resolved</span>
              </div>
              {historyAlerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">No history yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Category</th>
                      <th className="text-left px-4 py-2.5">Severity</th>
                      <th className="text-left px-4 py-2.5">Rule</th>
                      <th className="text-left px-4 py-2.5">Message</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {historyAlerts.map((alert: AlertDto) => (
                      <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors" title={alert.message}>
                        <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDateShort(alert.createdAt)}</td>
                        <td className="px-4 py-2 font-mono text-blue-300 font-medium text-xs">{alert.categoryId ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</td>
                        <td className="px-4 py-2 text-xs text-slate-500 max-w-[280px] truncate">{alert.message}</td>
                        <td className={`px-4 py-2 text-xs whitespace-nowrap ${STATUS_STYLES[alert.status] ?? "text-slate-500"}`}>{alert.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Alert Rules — live from DB */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">Alert Rules</span>
                <span className="text-[10px] text-slate-500 ml-1" title="Rules are evaluated after each ingestion. Toggle to enable or disable a rule.">(live · toggleable)</span>
              </div>
              {alertRules == null ? (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">Loading rules…</div>
              ) : alertRules.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">No alert rules configured.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Rule</th>
                      <th className="text-left px-4 py-2.5">Severity</th>
                      <th className="text-left px-4 py-2.5">Thresholds</th>
                      <th className="text-right px-4 py-2.5">Enabled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {alertRules.map((rule) => {
                      const staticMeta = BUILTIN_RULES.find(r => r.id === rule.ruleId);
                      const isToggling = togglingRule === rule.ruleId;
                      return (
                        <tr key={rule.ruleId} className={`hover:bg-slate-800/40 transition-colors ${!rule.enabled ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-200 text-sm">{staticMeta?.label ?? rule.ruleId}</div>
                            {staticMeta?.note && <div className="text-[10px] text-slate-600 mt-0.5">{staticMeta.note}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(rule.severity)}`}>
                              {rule.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {rule.compositeThreshold != null && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  score <span className="text-slate-400">{rule.compositeThreshold.toFixed(2)}</span>
                                </span>
                              )}
                              {rule.persistenceDays != null && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  persist &lt; <span className="text-slate-400">{rule.persistenceDays}d</span>
                                </span>
                              )}
                              {rule.compositeThreshold == null && rule.persistenceDays == null && (
                                <span className="text-[10px] text-slate-700">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleToggleRule(rule.ruleId, rule.enabled)}
                              disabled={isToggling}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${rule.enabled ? "bg-blue-600" : "bg-slate-600"}`}
                              title={rule.enabled ? "Click to disable" : "Click to enable"}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-1"}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right 1/3: Sector heatmap + Info panel */}
          <div className="flex flex-col gap-5">
            {/* Sector Alert Heatmap */}
            {(() => {
              const EQUITY_SECTORS = ["TECH", "FINL", "HLTH", "DISR", "INDU", "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM"];
              const SEV_ORDER: Record<string, number> = { URGENT: 4, ACTION: 3, WARNING: 2, INFO: 1 };
              const sectorWorstSev: Record<string, string> = {};
              activeAlerts.forEach(a => {
                if (!a.categoryId || !EQUITY_SECTORS.includes(a.categoryId)) return;
                const cur = sectorWorstSev[a.categoryId];
                if (!cur || (SEV_ORDER[a.severity] ?? 0) > (SEV_ORDER[cur] ?? 0)) {
                  sectorWorstSev[a.categoryId] = a.severity;
                }
              });
              const marketWideCount = activeAlerts.filter(a => !a.categoryId).length;
              return (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-300 mb-3">Sector Alert Status</div>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {EQUITY_SECTORS.map(sId => {
                      const sev = sectorWorstSev[sId];
                      const dotClass = sev === "URGENT" ? "bg-red-500 shadow-[0_0_5px_1px_rgba(239,68,68,0.5)]"
                        : sev === "ACTION" ? "bg-red-700"
                        : sev === "WARNING" ? "bg-amber-500"
                        : sev === "INFO" ? "bg-blue-500"
                        : "bg-slate-700";
                      const textClass = sev ? "text-slate-200" : "text-slate-600";
                      return (
                        <div
                          key={sId}
                          className="flex flex-col items-center gap-1 py-1.5 px-1 rounded bg-slate-900/40 border border-slate-700/40"
                          title={sev ? `${sId}: ${sev} active alert` : `${sId}: no active alerts`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                          <span className={`text-[9px] font-mono ${textClass}`}>{sId}</span>
                        </div>
                      );
                    })}
                  </div>
                  {marketWideCount > 0 && (
                    <div className="text-[10px] text-amber-400/70 border-t border-slate-700/40 pt-2">
                      +{marketWideCount} market-wide alert{marketWideCount > 1 ? "s" : ""} (no specific sector)
                    </div>
                  )}
                  {Object.keys(sectorWorstSev).length === 0 && marketWideCount === 0 && (
                    <p className="text-[10px] text-slate-600">All clear — no active sector alerts</p>
                  )}
                </div>
              );
            })()}

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sticky top-0">
              <div className="text-sm font-semibold text-slate-200 mb-4">About Alerts</div>
              <div className="space-y-4 text-xs text-slate-400">
                <div>
                  <p className="font-medium text-slate-300 mb-1">How alerts fire</p>
                  <p>Rules are evaluated after each data ingestion. An alert fires when a condition transitions from false to true — not on every ingestion while the condition holds.</p>
                </div>
                <div>
                  <p className="font-medium text-slate-300 mb-1">Severity levels</p>
                  <div className="space-y-1.5 mt-2">
                    {(["URGENT", "ACTION", "WARNING", "INFO"] as const).map((sev) => (
                      <div key={sev} className="flex items-center gap-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${severityBadgeCls(sev)}`}>{sev}</span>
                        <span>{
                          sev === "URGENT"  ? "Immediate attention — critical regime or risk event" :
                          sev === "ACTION"  ? "Strong signal — consider acting" :
                          sev === "WARNING" ? "Potential concern — monitor closely" :
                                             "Informational — rotation event detected"
                        }</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-slate-300 mb-1">Dismiss vs. Resolve</p>
                  <p>Dismissing an alert acknowledges it and suppresses re-display. It auto-resolves on the next ingestion if the condition no longer holds.</p>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-slate-600 text-[10px]">Rule management (custom thresholds, per-category rules) is configured in the backend. Refresh the page after triggering ingestion to see new alerts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
