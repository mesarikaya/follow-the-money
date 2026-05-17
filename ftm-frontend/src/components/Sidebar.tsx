"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ANALYSIS_ITEMS = [
  { href: "/",             label: "Sector Rotation", icon: "🔄" },
  { href: "/rrg",          label: "RRG Chart",       icon: "🎯" },
  { href: "/sub-sectors",  label: "Tech Sub-Sectors", icon: "🔬" },
  { href: "/factors",      label: "Factor Flows",    icon: "⚖️" },
  { href: "/flows",        label: "Capital Flows",   icon: "💰" },
  { href: "/macro",        label: "Macro Regime",    icon: "🌍" },
];

const MANAGEMENT_ITEMS = [
  { href: "/portfolio", label: "Portfolio",  icon: "📁" },
  { href: "/alerts",    label: "Alerts",     icon: "🔔" },
  { href: "/backtest",  label: "Backtester", icon: "📈" },
];

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
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
      <span className="hidden md:block">{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-14 md:w-52 min-h-screen bg-slate-800 border-r border-slate-700 text-slate-100 shrink-0">
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="hidden md:block">
          <div className="text-blue-400 text-base font-bold tracking-tight">📈 Follow the Money</div>
          <div className="text-slate-500 text-xs mt-0.5">local · single-user</div>
        </div>
        <div className="md:hidden text-blue-400 text-lg font-bold">📈</div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-3 mb-1.5 hidden md:block">
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Analysis</span>
        </div>
        {ANALYSIS_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="px-3 mt-4 mb-1.5 hidden md:block">
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Management</span>
        </div>
        {MANAGEMENT_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
