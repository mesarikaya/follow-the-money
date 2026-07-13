/** One headline number of a backtest run, with the tooltip that explains what it means. */
export function MetricCard({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="space-y-0.5" title={tooltip}>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help text-slate-600">(?)</span>}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
