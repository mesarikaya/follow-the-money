"use client";

import { useState, ReactNode } from "react";

/**
 * Progressive-disclosure wrapper: a titled section whose body collapses behind a header toggle.
 * Lets the portfolio page lead with the overview + actions and keep heavier detail (allocation
 * editor, sector-exposure table) one click away instead of stacked on screen.
 */
type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const testId = `collapsible-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <section className="rounded-lg border border-slate-700/50 bg-slate-800/20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        data-testid={testId}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors rounded-lg"
      >
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          {subtitle && (
            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">{subtitle}</span>
          )}
        </span>
        <span
          className={`text-slate-400 text-[10px] shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}
