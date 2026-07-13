import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAlerts, fetchTheme, fetchThemeAlertHistory, fetchThemeHistory, fetchThemes } from "@/lib/api";
import { resolveHistoryDays } from "@/lib/themes/themeDetail";
import ThemeScoreCalendar from "@/components/ThemeScoreCalendar";
import { ConstituentTable } from "@/components/themes/detailCells";
import { ThemeHeaderCard } from "@/components/themes/detailHeader";
import {
  HistoryChartSection,
  IntelligencePanel,
  PhaseTimelineStrip,
  RelatedThemesPanel,
  ThemeAlertHistory,
  ThemeDetailAlerts,
} from "@/components/themes/detailPanels";

const CALENDAR_DAYS = 91;

const PageNav = ({ themeId }: { themeId: string }) => (
  <div className="mb-1 flex items-center justify-between">
    <Link href="/themes" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">
      ← Themes
    </Link>
    <Link
      href={`/themes/compare?a=${themeId}`}
      className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors border border-slate-700/40 hover:border-slate-600/60 px-2 py-0.5 rounded"
      data-testid="theme-detail-compare-link"
    >
      ↔ Compare
    </Link>
  </div>
);

export default async function ThemeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const { days: daysParam } = await searchParams;
  const days = resolveHistoryDays(daysParam);
  const themeId = id.toUpperCase();

  let theme;
  try {
    theme = await fetchTheme(themeId);
  } catch {
    notFound();
  }

  const [history, calendarHistory, allThemes, alertsResponse, alertHistory] = await Promise.all([
    fetchThemeHistory(themeId, days).catch(() => []),
    fetchThemeHistory(themeId, CALENDAR_DAYS).catch(() => []),
    fetchThemes().catch(() => []),
    fetchAlerts().catch(() => ({ activeCount: 0, alerts: [] })),
    fetchThemeAlertHistory(themeId).catch(() => []),
  ]);

  const activeAlerts = alertsResponse.alerts.filter(
    alert => alert.themeId === themeId && alert.status === "ACTIVE",
  );

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <PageNav themeId={theme.id} />

        <ThemeHeaderCard theme={theme} />
        <IntelligencePanel theme={theme} />

        <ThemeDetailAlerts alerts={activeAlerts} />
        <ThemeAlertHistory alerts={alertHistory} />

        <HistoryChartSection history={history} days={days} themeId={themeId} />
        <PhaseTimelineStrip history={history} backendPhases={theme.phaseHistory30d} />
        <ThemeScoreCalendar history={calendarHistory} />

        {allThemes.length > 1 && (
          <RelatedThemesPanel
            currentThemeId={themeId}
            currentConstituents={theme.constituents}
            allThemes={allThemes}
          />
        )}

        <ConstituentTable constituents={theme.constituents} />
      </div>
    </main>
  );
}
