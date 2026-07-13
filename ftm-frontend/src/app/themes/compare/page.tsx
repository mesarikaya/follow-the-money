import Link from "next/link";
import { ThemeHistoryPoint, fetchTheme, fetchThemeHistory, fetchThemes } from "@/lib/api";
import { ComparisonView } from "@/components/themes/compare/ComparisonView";
import { ThemePickerPage } from "@/components/themes/compare/ThemePicker";

const HISTORY_DAYS = 30;

const ThemeNotFound = () => (
  <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-6">
    <div className="max-w-lg mx-auto text-center py-16">
      <p className="text-slate-400 mb-4">One or both themes not found.</p>
      <Link href="/themes/compare" className="text-cyan-500 text-sm hover:text-cyan-400">
        ← Start over
      </Link>
    </div>
  </main>
);

export default async function ThemeComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  // Until both themes are chosen, the page is a picker — seeded with the first one if it is known.
  if (!a || !b) {
    const [allThemes, firstTheme] = await Promise.all([
      fetchThemes().catch(() => []),
      a ? fetchTheme(a).catch(() => null) : Promise.resolve(null),
    ]);
    return <ThemePickerPage themes={allThemes} firstTheme={firstTheme ?? undefined} />;
  }

  const [themeA, themeB, historyA, historyB] = await Promise.all([
    fetchTheme(a).catch(() => null),
    fetchTheme(b).catch(() => null),
    fetchThemeHistory(a, HISTORY_DAYS).catch(() => [] as ThemeHistoryPoint[]),
    fetchThemeHistory(b, HISTORY_DAYS).catch(() => [] as ThemeHistoryPoint[]),
  ]);

  if (!themeA || !themeB) return <ThemeNotFound />;

  return (
    <ComparisonView themeA={themeA} themeB={themeB} historyA={historyA} historyB={historyB} />
  );
}
