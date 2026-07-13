package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.SignalType;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.confluence.ConfluenceInput;
import com.ftm.app.themes.confluence.ConfluenceResult;
import com.ftm.app.themes.confluence.ConfluenceScoreService;
import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingAdvisor;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.momentum.MomentumAlignment;
import com.ftm.app.themes.momentum.MomentumDivergenceClassifier;
import com.ftm.app.themes.quality.ThemeInvestmentQualityService;
import com.ftm.app.themes.quality.ThemeInvestmentQualityService.ThemeQuality;
import com.ftm.app.themes.assembler.ThemeConstituentAssembler;
import com.ftm.app.themes.assembler.ThemeSummaryAssembler;
import com.ftm.app.themes.repository.ThemeRepository;
import com.ftm.app.themes.risk.ThemeRiskAggregator;
import com.ftm.app.themes.risk.ThemeRiskContext;
import com.ftm.app.themes.risk.ThemeRiskLevel;
import com.ftm.app.themes.signal.ThemeConcentrationRiskCalculator;
import com.ftm.app.themes.signal.ThemePersistenceService;
import com.ftm.app.themes.signal.ThemePersistenceService.ThemePersistence;
import com.ftm.app.themes.signal.ThemePhaseClassifier;
import com.ftm.app.themes.signal.ThemePhaseHistoryService;
import com.ftm.app.themes.signal.ThemeScorePercentileCalculator;
import com.ftm.app.themes.signal.ThemeSignalStreakCounter;
import com.ftm.app.themes.signal.ThemeVolatilityCalculator;
import com.ftm.app.themes.transition.PhaseTransitionContext;
import com.ftm.app.themes.transition.PhaseTransitionDetector;
import com.ftm.app.themes.transition.PhaseTransitionSignal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThemeServiceTest {

  @Mock ThemeRepository themeRepository;
  @Mock CategoryRepository categoryRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;
  @Mock PhaseTransitionDetector phaseTransitionDetector;
  @Mock ThemeRiskAggregator themeRiskAggregator;
  @Mock EntryTimingAdvisor entryTimingAdvisor;
  @Mock MomentumDivergenceClassifier momentumDivergenceClassifier;
  @Mock ConfluenceScoreService confluenceScoreService;
  @Mock ThemePhaseClassifier themePhaseClassifier;
  @Mock ThemeSignalStreakCounter themeSignalStreakCounter;
  @Mock ThemeVolatilityCalculator themeVolatilityCalculator;
  @Mock ThemeScorePercentileCalculator themeScorePercentileCalculator;
  @Mock ThemeConcentrationRiskCalculator themeConcentrationRiskCalculator;
  @Mock ThemePhaseHistoryService themePhaseHistoryService;
  @Mock ThemePersistenceService themePersistenceService;
  @Mock ThemeInvestmentQualityService themeInvestmentQualityService;

  ThemeService themeService;

  @BeforeEach
  void buildService() {
    // The assemblers are real; they run on the same mocked calculators the tests stub below.
    themeService =
        new ThemeService(
            themeRepository,
            categoryRepository,
            signalRepository,
            alertRepository,
            new ThemeConstituentAssembler(),
            new ThemeSummaryAssembler(
                phaseTransitionDetector,
                themeRiskAggregator,
                entryTimingAdvisor,
                momentumDivergenceClassifier,
                confluenceScoreService,
                themePhaseClassifier,
                themeSignalStreakCounter,
                themeVolatilityCalculator,
                themeScorePercentileCalculator,
                themeConcentrationRiskCalculator,
                themePhaseHistoryService,
                themePersistenceService,
                themeInvestmentQualityService),
            themePhaseHistoryService);
  }

  @BeforeEach
  void defaultStubs() {
    lenient()
        .when(themeRiskAggregator.aggregate(any(ThemeRiskContext.class)))
        .thenReturn(ThemeRiskLevel.MEDIUM);
    lenient()
        .when(entryTimingAdvisor.advise(any(EntryTimingContext.class)))
        .thenReturn(Optional.empty());
    lenient()
        .when(momentumDivergenceClassifier.classify(any(), any()))
        .thenReturn(Optional.empty());
    lenient()
        .when(confluenceScoreService.compute(any(ConfluenceInput.class)))
        .thenReturn(new ConfluenceResult(50, "MODERATE"));
    lenient().when(themePhaseClassifier.classify(any(), any(), any(), any())).thenReturn("NEUTRAL");
    lenient().when(themeSignalStreakCounter.count(any(), any())).thenReturn(0);
    lenient().when(themeVolatilityCalculator.calculate(any())).thenReturn(null);
    lenient().when(themeScorePercentileCalculator.calculate(any(), any())).thenReturn(null);
    lenient().when(themeConcentrationRiskCalculator.calculate(any())).thenReturn(null);
    lenient().when(themePhaseHistoryService.computePhaseStreak(any(), any())).thenReturn(0);
    lenient().when(themePhaseHistoryService.computeHistory(any())).thenReturn(List.of());
    lenient()
        .when(themePersistenceService.computePersistence(any()))
        .thenReturn(new ThemePersistence(50, "C"));
    lenient()
        .when(themeInvestmentQualityService.computeQuality(any()))
        .thenReturn(new ThemeQuality(50, "C"));
  }

  private Theme theme(String id, String name) {
    return new Theme(id, name, "Test thesis", 1);
  }

  private Category category(CategoryId id, String name, String ticker) {
    return new Category(id, name, CategoryType.EQUITY_SECTOR, ticker, "XLK", 101, true, "TECH");
  }

  @Test
  @DisplayName("getThemes returns empty list when no themes exist")
  void shouldReturnEmptyWhenNoThemes() {
    when(themeRepository.findAll()).thenReturn(List.of());
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of());
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of());
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(Collections.emptyMap());

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).isEmpty();
  }

  private void stubHistoryEmpty() {
    when(signalRepository.findAverageHistoryByDate(anyCollection(), anyInt()))
        .thenReturn(List.of());
  }

  @Test
  @DisplayName("getThemes aggregates composite score as average of constituent scores")
  void shouldAggregateCompositeScoreAsAverage() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.60")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    ThemeSummaryDto ai = result.get(0);
    assertThat(ai.id()).isEqualTo("AI_INFRA");
    assertThat(ai.constituentCount()).isEqualTo(2);
    assertThat(ai.compositeScore()).isCloseTo(0.70, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes computes BUY dominant signal when majority constituents are bullish")
  void shouldComputeBuyDominantSignalWhenMajorityBullish() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.78")),
                SignalType.RRG_QUADRANT,
                    Map.of("SEMI", new BigDecimal("4"), "AIRO", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("SEMI", new BigDecimal("0.02"), "AIRO", new BigDecimal("0.01")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).dominantSignal()).isEqualTo("BUY");
    assertThat(result.get(0).bullishCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("getTheme throws NoSuchElementException for unknown theme")
  void shouldThrowForUnknownTheme() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));

    assertThatThrownBy(() -> themeService.getTheme("UNKNOWN_THEME"))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("UNKNOWN_THEME");
  }

  @Test
  @DisplayName("getThemeHistory returns empty list when theme has no signal data")
  void shouldReturnEmptyHistoryWhenNoSignalsExist() {
    when(themeRepository.existsById("AI_INFRA")).thenReturn(true);
    when(themeRepository.findConstituentIds("AI_INFRA")).thenReturn(List.of("SEMI", "AIRO"));
    when(signalRepository.findAverageHistoryByDate(List.of("SEMI", "AIRO"), 30))
        .thenReturn(List.of());

    List<ThemeHistoryPointDto> result = themeService.getThemeHistory("AI_INFRA", 30);

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName(
      "getThemeHistory returns daily composite averages with trend data in chronological order")
  void shouldReturnChronologicalDailyAverages() {
    LocalDate day1 = LocalDate.of(2025, 1, 2);
    LocalDate day2 = LocalDate.of(2025, 1, 3);
    when(themeRepository.existsById("AI_INFRA")).thenReturn(true);
    when(themeRepository.findConstituentIds("AI_INFRA")).thenReturn(List.of("SEMI", "AIRO"));
    when(signalRepository.findAverageHistoryByDate(List.of("SEMI", "AIRO"), 30))
        .thenReturn(
            List.of(
                new SignalRepository.DateHistory(day1, 0.60, 0.005, 0.003),
                new SignalRepository.DateHistory(day2, 0.70, 0.012, 0.006)));

    List<ThemeHistoryPointDto> result = themeService.getThemeHistory("AI_INFRA", 30);

    assertThat(result).hasSize(2);
    assertThat(result.get(0).date()).isEqualTo("2025-01-02");
    assertThat(result.get(0).compositeScore()).isEqualTo(0.60);
    assertThat(result.get(0).trend5d()).isEqualTo(0.005);
    assertThat(result.get(1).date()).isEqualTo("2025-01-03");
    assertThat(result.get(1).compositeScore()).isEqualTo(0.70);
    assertThat(result.get(1).trend20d()).isEqualTo(0.006);
  }

  @Test
  @DisplayName("getThemeHistory throws NoSuchElementException for unknown theme")
  void shouldThrowForUnknownThemeHistory() {
    when(themeRepository.existsById("UNKNOWN")).thenReturn(false);

    assertThatThrownBy(() -> themeService.getThemeHistory("UNKNOWN", 30))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("UNKNOWN");
  }

  @Test
  @DisplayName("getTheme returns detail with all constituents sorted by composite score")
  void shouldReturnThemeDetailWithConstituentsSortedByScore() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.60"), "AIRO", new BigDecimal("0.80")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    ThemeDetailDto detail = themeService.getTheme("AI_INFRA");

    assertThat(detail.constituents()).hasSize(2);
    assertThat(detail.constituents().get(0).categoryId()).isEqualTo("AIRO");
    assertThat(detail.constituents().get(1).categoryId()).isEqualTo("SEMI");
  }

  @Test
  @DisplayName("getThemes computes compositeTrend5d as average of constituent 5d trend signals")
  void shouldAggregateCompositeTrend5d() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.60")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of("SEMI", new BigDecimal("0.030"), "AIRO", new BigDecimal("0.010"))));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).compositeTrend5d())
        .isNotNull()
        .isCloseTo(0.020, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes sets parentCategoryId from category.parentId on each constituent")
  void shouldSetParentCategoryIdOnConstituents() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.80")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).topConstituents()).hasSize(1);
    assertThat(result.get(0).topConstituents().get(0).parentCategoryId()).isEqualTo("TECH");
  }

  @Test
  @DisplayName("getThemes delegates signalStreakDays computation to ThemeSignalStreakCounter")
  void shouldDelegateSignalStreakToCounter() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.78")),
                SignalType.RRG_QUADRANT,
                    Map.of("SEMI", new BigDecimal("4"), "AIRO", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("SEMI", new BigDecimal("0.02"), "AIRO", new BigDecimal("0.01")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themeSignalStreakCounter.count(any(), any())).thenReturn(7);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).signalStreakDays()).isEqualTo(7);
  }

  @Test
  @DisplayName("getThemes delegates volatility30d computation to ThemeVolatilityCalculator")
  void shouldDelegateVolatilityToCalculator() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.70")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themeVolatilityCalculator.calculate(any())).thenReturn(0.030);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).volatility30d())
        .isCloseTo(0.030, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes sets signalStreakDays to 0 when history is empty")
  void shouldSetZeroStreakWhenNoHistory() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.70")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).signalStreakDays()).isEqualTo(0);
    assertThat(result.get(0).volatility30d()).isNull();
    assertThat(result.get(0).scorePercentile30d()).isNull();
  }

  @Test
  @DisplayName(
      "getThemes delegates scorePercentile30d computation to ThemeScorePercentileCalculator")
  void shouldDelegateScorePercentileToCalculator() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.75")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themeScorePercentileCalculator.calculate(any(), any())).thenReturn(0.75);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).scorePercentile30d())
        .isCloseTo(0.75, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName(
      "getThemes delegates concentrationRisk computation to ThemeConcentrationRiskCalculator")
  void shouldDelegateConcentrationRiskToCalculator() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI", "AIRO")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(
            List.of(
                category(CategoryId.SEMI, "Semiconductors", "SMH"),
                category(CategoryId.AIRO, "AI & Robotics", "BOTZ")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("SEMI", new BigDecimal("0.80"), "AIRO", new BigDecimal("0.75")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themeConcentrationRiskCalculator.calculate(any())).thenReturn(1.0);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).concentrationRisk())
        .isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.001));
  }

  @Test
  @DisplayName("getThemes delegates phase transition detection to PhaseTransitionDetector")
  void shouldDelegatePhaseTransitionToDetector() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.60")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(phaseTransitionDetector.detect(
            org.mockito.ArgumentMatchers.any(PhaseTransitionContext.class)))
        .thenReturn(Optional.of(PhaseTransitionSignal.APPROACHING_BUY));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).phaseTransitionSignal()).isEqualTo("APPROACHING_BUY");
  }

  @Test
  @DisplayName("getThemes delegates risk scoring to ThemeRiskAggregator and maps level to string")
  void shouldDelegateRiskScoringToAggregator() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.72")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themeRiskAggregator.aggregate(any(ThemeRiskContext.class)))
        .thenReturn(ThemeRiskLevel.HIGH);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).riskLevel()).isEqualTo("HIGH");
  }

  @Test
  @DisplayName("getThemes delegates entry timing to advisor and exposes action + rationale")
  void shouldDelegateEntryTimingToAdvisor() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.72")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(entryTimingAdvisor.advise(any(EntryTimingContext.class)))
        .thenReturn(
            Optional.of(new EntryRecommendation(EntryAction.ENTER, "Breakout momentum confirmed")));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).entryAction()).isEqualTo("ENTER");
    assertThat(result.get(0).entryRationale()).isEqualTo("Breakout momentum confirmed");
  }

  @Test
  @DisplayName("getThemes returns null entry fields when advisor has no recommendation")
  void shouldReturnNullEntryFieldsWhenAdvisorEmpty() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.45")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).entryAction()).isNull();
    assertThat(result.get(0).entryRationale()).isNull();
  }

  @Test
  @DisplayName("getThemes delegates momentum alignment to MomentumDivergenceClassifier")
  void shouldDelegateMomentumAlignmentToClassifier() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.70")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(momentumDivergenceClassifier.classify(any(), any()))
        .thenReturn(Optional.of(MomentumAlignment.ALIGNED_BULLISH));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).momentumAlignment()).isEqualTo("ALIGNED_BULLISH");
  }

  @Test
  @DisplayName("getThemes returns null momentumAlignment when classifier has no data")
  void shouldReturnNullMomentumAlignmentWhenClassifierEmpty() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.50")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).momentumAlignment()).isNull();
  }

  @Test
  @DisplayName("getThemes delegates confluence scoring to ConfluenceScoreService")
  void shouldDelegateConfluenceScoringToService() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.75")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(confluenceScoreService.compute(any(ConfluenceInput.class)))
        .thenReturn(new ConfluenceResult(82, "HIGH_CONFIDENCE"));

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).confluenceScore()).isEqualTo(82);
    assertThat(result.get(0).confidenceLabel()).isEqualTo("HIGH_CONFIDENCE");
  }

  @Test
  @DisplayName("getThemes populates confluenceScore from service default when no explicit signals")
  void shouldPopulateDefaultConfluenceScoreFromService() {
    when(themeRepository.findAll())
        .thenReturn(List.of(theme("CHIP_COMPUTE", "Semiconductor Supercycle")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.55")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();

    List<ThemeSummaryDto> result = themeService.getThemes();

    // confluenceScoreService returns ConfluenceResult(50, "MODERATE") by default stub
    assertThat(result.get(0).confluenceScore()).isEqualTo(50);
    assertThat(result.get(0).confidenceLabel()).isEqualTo("MODERATE");
  }

  @Test
  @DisplayName("getThemes delegates phaseStreakDays computation to ThemePhaseHistoryService")
  void shouldDelegatePhaseStreakToHistoryService() {
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.70")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themePhaseHistoryService.computePhaseStreak(any(), any())).thenReturn(12);

    List<ThemeSummaryDto> result = themeService.getThemes();

    assertThat(result.get(0).phaseStreakDays()).isEqualTo(12);
  }

  @Test
  @DisplayName("getTheme includes phaseHistory30d from ThemePhaseHistoryService in detail response")
  void shouldIncludePhaseHistoryInDetail() {
    List<String> expectedHistory = List.of("MOMENTUM", "MOMENTUM", "HOLDING");
    when(themeRepository.findAll()).thenReturn(List.of(theme("AI_INFRA", "AI Infrastructure")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("SEMI")));
    when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
        .thenReturn(List.of(category(CategoryId.SEMI, "Semiconductors", "SMH")));
    when(signalRepository.findLatestByTypes(org.mockito.ArgumentMatchers.anyList()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("SEMI", new BigDecimal("0.70")),
                SignalType.RS_60, Collections.emptyMap(),
                SignalType.FLOW_20D, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_20D, Collections.emptyMap(),
                SignalType.RRG_QUADRANT, Collections.emptyMap(),
                SignalType.MACRO_FIT, Collections.emptyMap(),
                SignalType.RS_120, Collections.emptyMap(),
                SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()));
    stubHistoryEmpty();
    when(themePhaseHistoryService.computeHistory(any())).thenReturn(expectedHistory);

    ThemeDetailDto detail = themeService.getTheme("AI_INFRA");

    assertThat(detail.phaseHistory30d()).isEqualTo(expectedHistory);
  }
}
