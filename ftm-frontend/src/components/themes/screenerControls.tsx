import Link from "next/link";
import { ScreenerParams, ViewPreset, buildScreenerUrl } from "@/lib/themes/themeScreener";

/** The screener's controls: the column-sort links, the filter chips, and the view switcher. */

export const SortLink = ({
  label, sortKey, currentSort, title, allParams,
}: {
  label: string; sortKey: string; currentSort: string; title?: string;
  allParams: ScreenerParams;
}) => {
  const isActive = currentSort === sortKey;
  return (
    <Link
      href={buildScreenerUrl(allParams, { sort: sortKey })}
      className={`hover:text-slate-300 transition-colors ${isActive ? "text-cyan-400" : "text-slate-600"}`}
      title={title}
    >
      {label}{isActive ? " ↓" : ""}
    </Link>
  );
}

export const FilterChip = ({
  label, paramKey, value, activeValue, allParams,
}: {
  label: string; paramKey: keyof ScreenerParams; value: string;
  activeValue: string | undefined; allParams: ScreenerParams;
}) => {
  const isActive = activeValue === value;
  const href = buildScreenerUrl(allParams, { [paramKey]: isActive ? undefined : value });
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
        isActive
          ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
          : "bg-slate-700/40 text-slate-500 border border-slate-600/30 hover:text-slate-300 hover:border-slate-500/50"
      }`}
    >
      {isActive && <span className="mr-0.5 text-cyan-400">✕</span>}
      {label}
    </Link>
  );
}

export const ViewSwitcher = ({ view, allParams }: { view: ViewPreset; allParams: ScreenerParams }) => {
  const colCount = view === "full" ? 23 : view === "standard" ? 17 : 11;
  return (
    <div className="flex items-center gap-1.5" data-testid="view-switcher">
      <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mr-0.5">Cols:</span>
      {(["essential", "standard", "full"] as ViewPreset[]).map(v => (
        <Link
          key={v}
          data-testid={`view-${v}`}
          href={buildScreenerUrl(allParams, { view: v === "standard" ? undefined : v })}
          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
            view === v
              ? "bg-slate-700/60 text-slate-300 border-slate-600/50"
              : "text-slate-600 border-transparent hover:text-slate-400 hover:border-slate-700/40"
          }`}
        >
          {v}
        </Link>
      ))}
      <span className="text-[9px] font-mono text-slate-700">{colCount}c</span>
    </div>
  );
}

export const ThemeScreenerFilterBar = ({
  allParams, totalCount, filteredCount,
}: {
  allParams: ScreenerParams; totalCount: number; filteredCount: number;
}) => {
  const hasActiveFilter = allParams.signal != null || allParams.phase != null || allParams.entry != null || allParams.confidence != null;
  const filterGroups: { label: string; paramKey: keyof ScreenerParams; options: { label: string; value: string }[] }[] = [
    {
      label: "Signal",
      paramKey: "signal",
      options: [
        { label: "BUY", value: "BUY" },
        { label: "WATCH", value: "WATCH" },
        { label: "HOLD", value: "HOLD" },
        { label: "REDUCE", value: "REDUCE" },
      ],
    },
    {
      label: "Phase",
      paramKey: "phase",
      options: [
        { label: "Breakout", value: "BREAKOUT" },
        { label: "Momentum", value: "MOMENTUM" },
        { label: "Setup", value: "SETUP" },
        { label: "Building", value: "BUILDING" },
        { label: "Fading", value: "FADING" },
        { label: "Distribute", value: "DISTRIBUTE" },
        { label: "Weak", value: "WEAK" },
      ],
    },
    {
      label: "Entry",
      paramKey: "entry",
      options: [
        { label: "Enter", value: "ENTER" },
        { label: "Scale In", value: "SCALE_IN" },
        { label: "Watch", value: "WATCH" },
        { label: "Avoid", value: "AVOID" },
      ],
    },
    {
      label: "Confidence",
      paramKey: "confidence",
      options: [
        { label: "High", value: "HIGH_CONFIDENCE" },
        { label: "Moderate", value: "MODERATE" },
        { label: "Cautious", value: "CAUTIOUS" },
        { label: "Avoid", value: "AVOID" },
      ],
    },
  ];
  return (
    <div className="px-3 py-2 border-b border-slate-700/40 bg-slate-800/20 flex flex-wrap items-center gap-3">
      {filterGroups.map(group => (
        <div key={group.paramKey} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider shrink-0">{group.label}:</span>
          {group.options.map(opt => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              paramKey={group.paramKey}
              value={opt.value}
              activeValue={allParams[group.paramKey]}
              allParams={allParams}
            />
          ))}
        </div>
      ))}
      {hasActiveFilter && (
        <Link
          href={buildScreenerUrl(allParams, { signal: undefined, phase: undefined, entry: undefined, confidence: undefined })}
          className="ml-auto text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear filters · {filteredCount}/{totalCount}
        </Link>
      )}
      {!hasActiveFilter && (
        <span className="ml-auto text-[10px] font-mono text-slate-600">{totalCount} themes</span>
      )}
    </div>
  );
}
