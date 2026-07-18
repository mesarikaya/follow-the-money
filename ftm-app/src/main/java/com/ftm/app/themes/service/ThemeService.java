package com.ftm.app.themes.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.assembler.ThemeConstituentAssembler;
import com.ftm.app.themes.assembler.ThemeSummaryAssembler;
import com.ftm.app.themes.repository.ThemeRepository;
import com.ftm.app.themes.signal.ThemePhaseHistoryService;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Serves the theme views. It loads what a theme is made of — its constituents, their latest signals,
 * their recent history and alerts — and hands that to the assemblers, which turn it into the DTOs
 * the API returns.
 */
@Service
public class ThemeService {

  private static final int ALERT_LOOKBACK_DAYS = 30;
  private static final int HISTORY_DAYS = 30;
  private static final int TOP_CONSTITUENT_COUNT = 3;

  private static final List<SignalType> SIGNAL_TYPES =
      List.of(
          SignalType.COMPOSITE,
          SignalType.RS_60,
          SignalType.FLOW_20D,
          SignalType.COMPOSITE_TREND_20D,
          SignalType.RRG_QUADRANT,
          SignalType.MACRO_FIT,
          SignalType.RS_120,
          SignalType.COMPOSITE_TREND_5D);

  private final ThemeRepository themeRepository;
  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;
  private final ThemeConstituentAssembler constituentAssembler;
  private final ThemeSummaryAssembler summaryAssembler;
  private final ThemePhaseHistoryService themePhaseHistoryService;

  public ThemeService(
      ThemeRepository themeRepository,
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository,
      ThemeConstituentAssembler constituentAssembler,
      ThemeSummaryAssembler summaryAssembler,
      ThemePhaseHistoryService themePhaseHistoryService) {
    this.themeRepository = themeRepository;
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
    this.constituentAssembler = constituentAssembler;
    this.summaryAssembler = summaryAssembler;
    this.themePhaseHistoryService = themePhaseHistoryService;
  }

  /** The market-wide data every theme summary is built from — loaded once, reused for each theme. */
  private record MarketSnapshot(
      Map<String, List<String>> constituentIdsByTheme,
      Map<String, Category> categoriesById,
      Map<SignalType, Map<String, BigDecimal>> signals) {

    Map<String, BigDecimal> latest(SignalType type) {
      return signals.getOrDefault(type, Collections.emptyMap());
    }

    List<String> constituentIdsOf(String themeId) {
      return constituentIdsByTheme.getOrDefault(themeId, List.of());
    }
  }

  @Cacheable("themes-latest")
  public List<ThemeSummaryDto> getThemes() {
    MarketSnapshot snapshot = loadMarketSnapshot();
    return themeRepository.findAll().stream()
        .map(
            theme -> {
              List<ThemeConstituentDto> constituents = constituentsOf(theme.id(), snapshot);
              return summarize(theme, snapshot, constituents, topScoredConstituents(constituents));
            })
        .toList();
  }

  @Cacheable(value = "theme-history", key = "#themeId + '-' + #tradingDays")
  public List<ThemeHistoryPointDto> getThemeHistory(String themeId, int tradingDays) {
    assertThemeExists(themeId);
    List<String> constituentIds = themeRepository.findConstituentIds(themeId);
    return signalRepository.findAverageHistoryByDate(constituentIds, tradingDays).stream()
        .map(
            point ->
                new ThemeHistoryPointDto(
                    point.date().toString(),
                    point.averageComposite(),
                    point.averageTrend5d(),
                    point.averageTrend20d()))
        .toList();
  }

  @Cacheable(value = "theme-detail", key = "#themeId")
  public ThemeDetailDto getTheme(String themeId) {
    Theme theme =
        themeRepository.findAll().stream()
            .filter(candidate -> candidate.id().equals(themeId))
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Theme not found: " + themeId));

    MarketSnapshot snapshot = loadMarketSnapshot();
    List<ThemeConstituentDto> constituents = constituentsOf(themeId, snapshot);
    List<ThemeConstituentDto> ranked = byCompositeScoreDescending(constituents);

    ThemeSummaryDto summary =
        summarize(theme, snapshot, constituents, ranked.stream().limit(TOP_CONSTITUENT_COUNT).toList());
    List<String> phaseHistory30d =
        themePhaseHistoryService.computeHistory(recentHistory(snapshot.constituentIdsOf(themeId)));

    return toDetail(summary, ranked, phaseHistory30d);
  }

  private MarketSnapshot loadMarketSnapshot() {
    return new MarketSnapshot(
        themeRepository.findAllConstituentsByTheme(),
        buildCategoryIndex(),
        signalRepository.findLatestByTypes(SIGNAL_TYPES));
  }

  private List<ThemeConstituentDto> constituentsOf(String themeId, MarketSnapshot snapshot) {
    return constituentAssembler.assemble(
        snapshot.constituentIdsOf(themeId), snapshot.categoriesById(), snapshot.signals());
  }

  private ThemeSummaryDto summarize(
      Theme theme,
      MarketSnapshot snapshot,
      List<ThemeConstituentDto> constituents,
      List<ThemeConstituentDto> topConstituents) {
    List<String> constituentIds = snapshot.constituentIdsOf(theme.id());
    return summaryAssembler.assemble(
        theme,
        constituents,
        topConstituents,
        snapshot.categoriesById(),
        snapshot.latest(SignalType.COMPOSITE),
        snapshot.latest(SignalType.COMPOSITE_TREND_5D),
        countRecentAlerts(theme.id(), constituentIds),
        recentHistory(constituentIds));
  }

  /** The strongest few scored constituents, which is all the summary card shows. */
  private static List<ThemeConstituentDto> topScoredConstituents(
      List<ThemeConstituentDto> constituents) {
    return constituents.stream()
        .filter(constituent -> constituent.compositeScore() != null)
        .sorted(Comparator.comparing(ThemeConstituentDto::compositeScore, Comparator.reverseOrder()))
        .limit(TOP_CONSTITUENT_COUNT)
        .toList();
  }

  private static List<ThemeConstituentDto> byCompositeScoreDescending(
      List<ThemeConstituentDto> constituents) {
    return constituents.stream()
        .sorted(
            Comparator.comparing(
                constituent ->
                    constituent.compositeScore() != null
                        ? constituent.compositeScore()
                        : BigDecimal.ZERO,
                Comparator.<BigDecimal>reverseOrder()))
        .toList();
  }

  /** Alerts raised recently against the theme itself or against any of its constituents. */
  private int countRecentAlerts(String themeId, List<String> constituentIds) {
    return alertRepository.countRecentByCategoryIds(constituentIds, ALERT_LOOKBACK_DAYS)
        + alertRepository.countRecentByThemeId(themeId, ALERT_LOOKBACK_DAYS);
  }

  private List<DateHistory> recentHistory(List<String> constituentIds) {
    return constituentIds.isEmpty()
        ? List.of()
        : signalRepository.findAverageHistoryByDate(constituentIds, HISTORY_DAYS);
  }

  private void assertThemeExists(String themeId) {
    if (!themeRepository.existsById(themeId)) {
      throw new NoSuchElementException("Theme not found: " + themeId);
    }
  }

  private Map<String, Category> buildCategoryIndex() {
    return categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
        .collect(Collectors.toMap(category -> category.id().name(), category -> category));
  }

  /** The detail view is the summary plus every constituent and the theme's phase history. */
  private static ThemeDetailDto toDetail(
      ThemeSummaryDto summary,
      List<ThemeConstituentDto> constituents,
      List<String> phaseHistory30d) {
    return new ThemeDetailDto(
        summary.id(),
        summary.name(),
        summary.thesis(),
        summary.constituentCount(),
        summary.compositeScore(),
        summary.rs60(),
        summary.flow20d(),
        summary.compositeTrend5d(),
        summary.compositeTrend20d(),
        summary.bullishCount(),
        summary.dominantSignal(),
        summary.divergenceFromParentSectors(),
        summary.themePhase(),
        constituents,
        summary.alertCount30d(),
        summary.signalStreakDays(),
        summary.phaseStreakDays(),
        summary.volatility30d(),
        summary.scorePercentile30d(),
        summary.concentrationRisk(),
        summary.phaseTransitionSignal(),
        summary.riskLevel(),
        summary.entryAction(),
        summary.entryRationale(),
        summary.momentumAlignment(),
        summary.confluenceScore(),
        summary.confidenceLabel(),
        summary.persistenceScore(),
        summary.persistenceGrade(),
        summary.investmentQualityScore(),
        summary.investmentQualityGrade(),
        phaseHistory30d);
  }
}
