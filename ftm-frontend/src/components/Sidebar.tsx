"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ANALYSIS_ITEMS = [
  { href: "/brief",        label: "Daily Brief",     icon: "📋" },
  { href: "/",             label: "Sector Rotation", icon: "🔄" },
  { href: "/rrg",          label: "RRG Chart",       icon: "🎯" },
  { href: "/themes",       label: "Themes",          icon: "🧩" },
  { href: "/sectors",      label: "Sub-Sectors",     icon: "🔬" },
  { href: "/factors",      label: "Factor Flows",    icon: "⚖️" },
  { href: "/flows",        label: "Capital Flows",   icon: "💰" },
  { href: "/macro",        label: "Macro Regime",    icon: "🌍" },
];

const MANAGEMENT_ITEMS = [
  { href: "/portfolio",               label: "Portfolio",       icon: "📁" },
  { href: "/alerts",                  label: "Alerts",          icon: "🔔" },
  { href: "/backtest",                label: "Backtester",      icon: "📈" },
  { href: "/admin/ticker-mappings",   label: "Ticker Mappings", icon: "🗂️" },
];

/**
 * Counts what needs action, not every active alert. A badge reading the full count is the wall the
 * alerts page was redesigned to stop opening with — showing it on every route undoes that before
 * you even click. Falls back to the total if an older backend has no needsAction field.
 */
function useAlertsNeedingActionCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    fetch("/api/v1/alerts/active/count")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCount(data.needsAction ?? data.active ?? 0); })
      .catch(() => {});
  }, []);
  return count;
}

function NavItem({ href, label, icon, badge }: { href: string; label: string; icon: string; badge?: number }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
        isActive
          ? "bg-blue-950/60 border-l-[3px] border-blue-500 text-white pl-[13px]"
          : "text-slate-400 hover:text-white hover:bg-slate-800 border-l-[3px] border-transparent pl-[13px]"
      }`}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="hidden md:block flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="hidden md:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const alertsNeedingActionCount = useAlertsNeedingActionCount();
  return (
    <aside className="flex flex-col w-14 md:w-52 bg-slate-800 border-r border-slate-700 text-slate-100 shrink-0">
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-3 mb-1.5 hidden md:block">
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}>Analysis</span>
        </div>
        {ANALYSIS_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="px-3 mt-4 mb-1.5 hidden md:block">
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}>Management</span>
        </div>
        {MANAGEMENT_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            badge={item.href === "/alerts" ? alertsNeedingActionCount : undefined}
          />
        ))}
      </nav>
    </aside>
  );
}
