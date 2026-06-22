package com.ftm.app.api.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeHistoryPointDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.repository.ThemeRepository;
import com.ftm.app.themes.confluence.ConfluenceInput;
import com.ftm.app.themes.confluence.ConfluenceResult;
import com.ftm.app.themes.confluence.ConfluenceScoreService;
import com.ftm.app.themes.entry.EntryTimingAdvisor;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.momentum.MomentumDivergenceClassifier;
import com.ftm.app.themes.risk.ThemeRiskAggregator;
import com.ftm.app.themes.risk.ThemeRiskContext;
import com.ftm.app.themes.signal.ThemeConcentrationRiskCalculator;
import com.ftm.app.themes.signal.ThemePhaseClassifier;
import com.ftm.app.themes.signal.ThemePhaseHistoryService;
import com.ftm.app.themes.signal.ThemePersistenceService;
import com.ftm.app.themes.signal.ThemeScorePercentileCalculator;
import com.ftm.app.themes.quality.ThemeInvestmentQualityService;
import com.ftm.app.themes.quality.ThemeQualityContext;
import com.ftm.app.themes.signal.ThemeSignalStreakCounter;
import com.ftm.app.themes.signal.ThemeVolatilityCalculator;
import com.ftm.app.themes.transition.PhaseTransitionContext;
import com.ftm.app.themes.transition.PhaseTransitionDetector;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ThemeService {

  private final ThemeRepository themeRepository;
  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;
  private final PhaseTransitionDetector phaseTransitionDetector;
  private final ThemeRiskAggregator themeRiskAggregator;
  private final EntryTimingAdvisor entryTimingAdvisor;
  private final MomentumDivergenceClassifier momentumDivergenceClassifier;
  private final ConfluenceScoreService confluenceScoreService;
  private final ThemePhaseClassifier themePhaseClassifier;
  private final ThemeSignalStreakCounter themeSignalStreakCounter;
  private final ThemeVolatilityCalculator themeVolatilityCalculator;
  private final ThemeScorePercentileCalculator themeScorePercentileCalculator;
  private final ThemeConcentrationRiskCalculator themeConcentrationRiskCalculator;
  private final ThemePhaseHistoryService themePhaseHistoryService;
  private final ThemePersistenceService themePersistenceService;
  private final ThemeInvestmentQualityService themeInvestmentQualityService;

  public ThemeService(
      ThemeRepository themeRepository,
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository,
      PhaseTransitionDetector phaseTransitionDetector,
      ThemeRiskAggregator themeRiskAggregator,
      EntryTimingAdvisor entryTimingAdvisor,
      MomentumDivergenceClassifier momentumDivergenceClassifier,
      ConfluenceScoreService confluenceScoreService,
      ThemePhaseClassifier themePhaseClassifier,
      ThemeSignalStreakCounter themeSignalStreakCounter,
      ThemeVolatilityCalculator themeVolatilityCalculator,
      ThemeScorePercentileCalculator themeScorePercentileCalculator,
      ThemeConcentrationRiskCalculator themeConcentrationRiskCalculator,
      ThemePhaseHistoryService themePhaseHistoryService,
      ThemePersistenceService themePersistenceService,
      ThemeInvestmentQualityService themeInvestmentQualityService) {
    this.themeRepository = themeRepository;
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
    this.phaseTransitionDetector = phaseTransitionDetector;
    this.themeRiskAggregator = themeRiskAggregator;
    this.entryTimingAdvisor = entryTimingAdvisor;
    this.momentumDivergenceClassifier = momentumDivergenceClassifier;
    this.confluenceScoreService = confluenceScoreService;
    this.themePhaseClassifier = themePhaseClassifier;
    this.themeSignalStreakCounter = themeSignalStreakCounter;
    this.themeVolatilityCalculator = themeVolatilityCalculator;
    this.themeScorePercentileCalculator = themeScorePercentileCalculator;
    this.themeConcentrationRiskCalculator = themeConcentrationRiskCalculator;
    this.themePhaseHistoryService = themePhaseHistoryService;
    this.themePersistenceService = themePersistenceService;
    this.themeInvestmentQualityService = themeInvestmentQualityService;
  }

  @Cacheable("themes-latest")
  public List<ThemeSummaryDto> getThemes() {
    List<Theme> themes = themeRepository.findAll();
    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    Map<String, Category> categoriesById = buildCategoryIndex();
    Map<SignalType, Map<String, BigDecimal>> signals = fetchSignals();

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> trend5dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());

    return themes.stream()
        .map(
            theme -> {
              List<String> ids = constituentsByTheme.getOrDefault(theme.id(), List.of());
              List<ThemeConstituentDto> allConstituents =
                  buildConstituents(ids, categoriesById, signals);
              List<ThemeConstituentDto> top3 =
                  allConstituents.stream()
                      .filter(c -> c.compositeScore() != null)
                      .sorted(
                          Comparator.comparing(
                              ThemeConstituentDto::compositeScore, Comparator.reverseOrder()))
                      .limit(3)
                      .toList();
              int alertCount =
                  alertRepository.countRecentByCategoryIds(ids, 30)
                      + alertRepository.countRecentByThemeId(theme.id(), 30);
              List<DateHistory> history =
                  ids.isEmpty() ? List.of() : signalRepository.findAverageHistoryByDate(ids, 30);
              return toSummary(
                  theme,
                  allConstituents,
                  top3,
                  categoriesById,
                  compositeMap,
                  trend5dMap,
                  alertCount,
                  history);
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
    List<Theme> themes = themeRepository.findAll();
    Theme theme =
        themes.stream()
            .filter(t -> t.id().equals(themeId))
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("Theme not found: " + themeId));

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    List<String> ids = constituentsByTheme.getOrDefault(themeId, List.of());
    Map<String, Category> categoriesById = buildCategoryIndex();
    Map<SignalType, Map<String, BigDecimal>> signals = fetchSignals();

    List<ThemeConstituentDto> constituents = buildConstituents(ids, categoriesById, signals);
    List<ThemeConstituentDto> sorted =
        constituents.stream()
            .sorted(
                Comparator.comparing(
                    c -> c.compositeScore() != null ? c.compositeScore() : BigDecimal.ZERO,
                    Comparator.<BigDecimal>reverseOrder()))
            .toList();

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> trend5dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());
    int alertCount =
        alertRepository.countRecentByCategoryIds(ids, 30)
            + alertRepository.countRecentByThemeId(themeId, 30);
    List<DateHistory> history =
        ids.isEmpty() ? List.of() : signalRepository.findAverageHistoryByDate(ids, 30);
    ThemeSummaryDto summary =
        toSummary(
            theme,
            constituents,
            sorted.stream().limit(3).toList(),
            categoriesById,
            compositeMap,
            trend5dMap,
            alertCount,
            history);
    List<String> phaseHistory30d = themePhaseHistoryService.computeHistory(history);
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
        sorted,
        alertCount,
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

  private void assertThemeExists(String themeId) {
    if (!themeRepository.existsById(themeId)) {
      throw new NoSuchElementException("Theme not found: " + themeId);
    }
  }

  private Map<String, Category> buildCategoryIndex() {
    return categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
        .collect(Collectors.toMap(c -> c.id().name(), c -> c));
  }

  private Map<SignalType, Map<String, BigDecimal>> fetchSignals() {
    return signalRepository.findLatestByTypes(
        List.of(
            SignalType.COMPOSITE,
            SignalType.RS_60,
            SignalType.FLOW_20D,
            SignalType.COMPOSITE_TREND_20D,
            SignalType.RRG_QUADRANT,
            SignalType.MACRO_FIT,
            SignalType.RS_120,
            SignalType.COMPOSITE_TREND_5D));
  }

  private List<ThemeConstituentDto> buildConstituents(
      List<String> categoryIds,
      Map<String, Category> categoriesById,
      Map<SignalType, Map<String, BigDecimal>> signals) {

    Map<String, BigDecimal> compositeMap =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> rs60Map =
        signals.getOrDefault(SignalType.RS_60, Collections.emptyMap());
    Map<String, BigDecimal> flow20dMap =
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap());
    Map<String, BigDecimal> trend20dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap());
    Map<String, BigDecimal> rrgMap =
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap());
    Map<String, BigDecimal> macroFitMap =
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap());
    Map<String, BigDecimal> rs120Map =
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap());
    Map<String, BigDecimal> trend5dMap =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());

    return categoryIds.stream()
        .map(
            id -> {
              Category cat = categoriesById.get(id);
              String name = cat != null ? cat.name() : id;
              String ticker = cat != null ? cat.etfTicker() : "";
              String parentId = cat != null && cat.parentId() != null ? cat.parentId() : id;
              BigDecimal composite = compositeMap.get(id);
              BigDecimal rs60 = rs60Map.get(id);
              BigDecimal flow20d = flow20dMap.get(id);
              BigDecimal trend20d = trend20dMap.get(id);
              BigDecimal rrgRaw = rrgMap.get(id);
              String rrg = rrgRaw != null ? String.valueOf(rrgRaw.intValue()) : null;
              int conviction =
                  TradeSignalDeriver.convictionScore(
                      composite,
                      rrg,
                      trend20d,
                      macroFitMap.get(id),
                      null,
                      trend5dMap.get(id),
                      rs60,
                      rs120Map.get(id),
                      flow20d,
                      null);
              return new ThemeConstituentDto(
                  id,
                  parentId,
                  name,
                  ticker,
                  composite,
                  rs60,
                  flow20d,
                  trend5dMap.get(id),
                  trend20d,
                  TradeSignalDeriver.derive(composite, rrg, trend20d),
                  conviction > 0 ? conviction : null);
            })
        .toList();
  }

  private ThemeSummaryDto toSummary(
      Theme theme,
      List<ThemeConstituentDto> allConstituents,
      List<ThemeConstituentDto> topConstituents,
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> compositeByCategory,
      Map<String, BigDecimal> trend5dByCategory,
      int alertCount30d,
      List<DateHistory> history) {

    OptionalDouble avgComposite =
        allConstituents.stream()
            .filter(c -> c.compositeScore() != null)
            .mapToDouble(c -> c.compositeScore().doubleValue())
            .average();
    OptionalDouble avgRs60 =
        allConstituents.stream()
            .filter(c -> c.rs60() != null)
            .mapToDouble(c -> c.rs60().doubleValue())
            .average();
    OptionalDouble avgFlow =
        allConstituents.stream()
            .filter(c -> c.flow20d() != null)
            .mapToDouble(c -> c.flow20d().doubleValue())
            .average();
    OptionalDouble avgTrend5d =
        allConstituents.stream()
            .filter(c -> trend5dByCategory.containsKey(c.categoryId()))
            .mapToDouble(c -> trend5dByCategory.get(c.categoryId()).doubleValue())
            .average();
    OptionalDouble avgTrend =
        allConstituents.stream()
            .filter(c -> c.compositeTrend20d() != null)
            .mapToDouble(c -> c.compositeTrend20d().doubleValue())
            .average();

    long buyCount = allConstituents.stream().filter(c -> "BUY".equals(c.tradeSignal())).count();
    long watchCount = allConstituents.stream().filter(c -> "WATCH".equals(c.tradeSignal())).count();
    long reduceCount =
        allConstituents.stream().filter(c -> "REDUCE".equals(c.tradeSignal())).count();
    int bullishCount = (int) (buyCount + watchCount);
    int total = allConstituents.size();

    String dominantSignal;
    if (total > 0 && buyCount * 2 >= total) dominantSignal = "BUY";
    else if (total > 0 && (buyCount + watchCount) * 2 >= total) dominantSignal = "WATCH";
    else if (total > 0 && reduceCount * 2 > total) dominantSignal = "REDUCE";
    else dominantSignal = "HOLD";

    // Divergence: theme composite − average composite of constituent parent sectors.
    // Positive = theme sub-sectors outpacing their sectors → early rotation signal.
    Double divergence = null;
    if (avgComposite.isPresent()) {
      OptionalDouble parentAvg =
          allConstituents.stream()
              .map(
                  c -> {
                    Category cat = categoriesById.get(c.categoryId());
                    if (cat == null) return null;
                    String parentId = cat.parentId();
                    if (parentId == null) parentId = c.categoryId();
                    BigDecimal parentScore = compositeByCategory.get(parentId);
                    return parentScore != null ? parentScore.doubleValue() : null;
                  })
              .filter(Objects::nonNull)
              .mapToDouble(Double::doubleValue)
              .average();
      if (parentAvg.isPresent()) {
        divergence = avgComposite.getAsDouble() - parentAvg.getAsDouble();
      }
    }

    Double scoreVal = avgComposite.isPresent() ? avgComposite.getAsDouble() : null;
    Double trend5dVal = avgTrend5d.isPresent() ? avgTrend5d.getAsDouble() : null;
    Double trend20dVal = avgTrend.isPresent() ? avgTrend.getAsDouble() : null;
    Double flowVal = avgFlow.isPresent() ? avgFlow.getAsDouble() : null;
    String themePhase = themePhaseClassifier.classify(scoreVal, trend5dVal, trend20dVal, flowVal);
    int signalStreakDays = themeSignalStreakCounter.count(history, dominantSignal);
    int phaseStreakDays = themePhaseHistoryService.computePhaseStreak(history, themePhase);
    Double volatility30d = themeVolatilityCalculator.calculate(history);
    Double scorePercentile30d = themeScorePercentileCalculator.calculate(history, scoreVal);
    Double concentrationRisk = themeConcentrationRiskCalculator.calculate(allConstituents);
    PhaseTransitionContext transitionContext =
        new PhaseTransitionContext(
            themePhase,
            scoreVal,
            signalStreakDays,
            trend5dVal,
            trend20dVal,
            flowVal,
            volatility30d,
            alertCount30d);
    String phaseTransitionSignal = phaseTransitionDetector.detect(transitionContext).orElse(null);
    ThemeRiskContext riskContext =
        new ThemeRiskContext(
            themePhase, scoreVal, volatility30d, trend5dVal, trend20dVal, alertCount30d,
            signalStreakDays);
    String riskLevel = themeRiskAggregator.aggregate(riskContext).name();
    EntryTimingContext entryContext =
        new EntryTimingContext(themePhase, scoreVal, riskLevel, trend5dVal, trend20dVal);
    var entryRecommendation = entryTimingAdvisor.advise(entryContext);
    String entryAction = entryRecommendation.map(r -> r.action().name()).orElse(null);
    String entryRationale = entryRecommendation.map(r -> r.rationale()).orElse(null);
    String momentumAlignment =
        momentumDivergenceClassifier.classify(trend5dVal, trend20dVal).map(Enum::name).orElse(null);
    ConfluenceResult confluence =
        confluenceScoreService.compute(
            new ConfluenceInput(entryAction, riskLevel, momentumAlignment, phaseTransitionSignal));
    ThemePersistenceService.ThemePersistence persistence =
        themePersistenceService.computePersistence(history);
    ThemeInvestmentQualityService.ThemeQuality quality =
        themeInvestmentQualityService.computeQuality(
            new ThemeQualityContext(
                confluence.confluenceScore(),
                persistence.persistenceScore(),
                signalStreakDays,
                volatility30d,
                concentrationRisk,
                scorePercentile30d));

    return new ThemeSummaryDto(
        theme.id(),
        theme.name(),
        theme.thesis(),
        total,
        scoreVal,
        avgRs60.isPresent() ? avgRs60.getAsDouble() : null,
        flowVal,
        trend5dVal,
        trend20dVal,
        bullishCount,
        dominantSignal,
        divergence,
        themePhase,
        topConstituents,
        alertCount30d,
        signalStreakDays,
        phaseStreakDays,
        volatility30d,
        scorePercentile30d,
        concentrationRisk,
        phaseTransitionSignal,
        riskLevel,
        entryAction,
        entryRationale,
        momentumAlignment,
        confluence.confluenceScore(),
        confluence.confidenceLabel(),
        persistence.persistenceScore(),
        persistence.persistenceGrade(),
        quality.investmentQualityScore(),
        quality.investmentQualityGrade());
  }

}
