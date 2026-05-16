import Link from "next/link";

const navigationItems = [
  { href: "/",         label: "Sector Rotation",  icon: "⬡" },
  { href: "/rrg",      label: "Rotation Graph",   icon: "◎" },
  { href: "/flows",    label: "Capital Flows",    icon: "↑↓" },
  { href: "/macro",    label: "Macro Regime",     icon: "M" },
  { href: "/portfolio",label: "Portfolio",        icon: "◫" },
  { href: "/alerts",   label: "Alerts",           icon: "⚑" },
  { href: "/backtest", label: "Backtester",       icon: "⧖" },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-16 md:w-52 min-h-screen bg-zinc-900 text-zinc-100 shrink-0">
      <div className="px-4 py-5 border-b border-zinc-700">
        <span className="hidden md:block text-sm font-semibold tracking-wide text-zinc-300">
          Follow the Money
        </span>
        <span className="md:hidden text-lg font-bold text-zinc-300">FTM</span>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md mx-2 transition-colors"
              >
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                <span className="hidden md:block">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
