package com.ftm.app.themes.assembler;

import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.confluence.ConfluenceInput;
import com.ftm.app.themes.confluence.ConfluenceResult;
import com.ftm.app.themes.confluence.ConfluenceScoreService;
import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingAdvisor;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.momentum.MomentumDivergenceClassifier;
import com.ftm.app.themes.quality.ThemeInvestmentQualityService;
import com.ftm.app.themes.quality.ThemeQualityContext;
import com.ftm.app.themes.risk.ThemeRiskAggregator;
import com.ftm.app.themes.risk.ThemeRiskContext;
import com.ftm.app.themes.signal.ThemeConcentrationRiskCalculator;
import com.ftm.app.themes.signal.ThemePersistenceService;
import com.ftm.app.themes.signal.ThemePhaseClassifier;
import com.ftm.app.themes.signal.ThemePhaseHistoryService;
import com.ftm.app.themes.signal.ThemeScorePercentileCalculator;
import com.ftm.app.themes.signal.ThemeSignalStreakCounter;
import com.ftm.app.themes.signal.ThemeVolatilityCalculator;
import com.ftm.app.themes.transition.PhaseTransitionContext;
import com.ftm.app.themes.transition.PhaseTransitionDetector;
import com.ftm.app.themes.transition.PhaseTransitionSignal;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import org.springframework.stereotype.Component;

/**
 * Turns a theme's constituents into the one summary a user reads: the averaged signals, the dominant
 * trade signal, how far the theme has diverged from its parent sectors, and the lifecycle read-outs
 * (phase, risk, entry timing, confluence, persistence, quality) that the calculators supply.
 */
@Component
public class ThemeSummaryAssembler {

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

  public ThemeSummaryAssembler(
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

  /** Everything a theme's constituents say when averaged together. */
  private record ThemeAverages(
      Double compositeScore, Double rs60, Double flow20d, Double trend5d, Double trend20d) {}

  public ThemeSummaryDto assemble(
      Theme theme,
      List<ThemeConstituentDto> allConstituents,
      List<ThemeConstituentDto> topConstituents,
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> compositeByCategory,
      Map<String, BigDecimal> trend5dByCategory,
      int alertCount30d,
      List<DateHistory> history) {

    ThemeAverages averages = averageSignals(allConstituents, trend5dByCategory);
    String dominantSignal = dominantSignal(allConstituents);
    Double divergence =
        divergenceFromParentSectors(
            allConstituents, categoriesById, compositeByCategory, averages.compositeScore());

    String themePhase =
        themePhaseClassifier.classify(
            averages.compositeScore(), averages.trend5d(), averages.trend20d(), averages.flow20d());
    int signalStreakDays = themeSignalStreakCounter.count(history, dominantSignal);
    int phaseStreakDays = themePhaseHistoryService.computePhaseStreak(history, themePhase);
    Double volatility30d = themeVolatilityCalculator.calculate(history);
    Double scorePercentile30d =
        themeScorePercentileCalculator.calculate(history, averages.compositeScore());
    Double concentrationRisk = themeConcentrationRiskCalculator.calculate(allConstituents);

    PhaseTransitionSignal phaseTransitionSignal =
        phaseTransitionDetector
            .detect(
                new PhaseTransitionContext(
                    themePhase,
                    averages.compositeScore(),
                    signalStreakDays,
                    averages.trend5d(),
                    averages.trend20d(),
                    averages.flow20d(),
                    volatility30d,
                    alertCount30d))
            .orElse(null);

    String riskLevel =
        themeRiskAggregator
            .aggregate(
                new ThemeRiskContext(
                    themePhase,
                    averages.compositeScore(),
                    volatility30d,
                    averages.trend5d(),
                    averages.trend20d(),
                    alertCount30d,
                    signalStreakDays))
            .name();

    Optional<EntryRecommendation> entry =
        entryTimingAdvisor.advise(
            new EntryTimingContext(
                themePhase,
                averages.compositeScore(),
                riskLevel,
                averages.trend5d(),
                averages.trend20d()));
    EntryAction entryAction = entry.map(EntryRecommendation::action).orElse(null);
    String entryRationale = entry.map(EntryRecommendation::rationale).orElse(null);

    String momentumAlignment =
        momentumDivergenceClassifier
            .classify(averages.trend5d(), averages.trend20d())
            .map(Enum::name)
            .orElse(null);

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
        allConstituents.size(),
        averages.compositeScore(),
        averages.rs60(),
        averages.flow20d(),
        averages.trend5d(),
        averages.trend20d(),
        bullishCount(allConstituents),
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
        nameOf(phaseTransitionSignal),
        riskLevel,
        nameOf(entryAction),
        entryRationale,
        momentumAlignment,
        confluence.confluenceScore(),
        confluence.confidenceLabel(),
        persistence.persistenceScore(),
        persistence.persistenceGrade(),
        quality.investmentQualityScore(),
        quality.investmentQualityGrade());
  }

  /** The DTO carries these as plain strings; null stays null. */
  private static String nameOf(Enum<?> value) {
    return value != null ? value.name() : null;
  }

  private ThemeAverages averageSignals(
      List<ThemeConstituentDto> constituents, Map<String, BigDecimal> trend5dByCategory) {
    return new ThemeAverages(
        average(constituents, ThemeConstituentDto::compositeScore),
        average(constituents, ThemeConstituentDto::rs60),
        average(constituents, ThemeConstituentDto::flow20d),
        averageOfLookup(constituents, trend5dByCategory),
        average(constituents, ThemeConstituentDto::compositeTrend20d));
  }

  private static Double average(
      List<ThemeConstituentDto> constituents,
      java.util.function.Function<ThemeConstituentDto, BigDecimal> signal) {
    return orNull(
        constituents.stream()
            .map(signal)
            .filter(Objects::nonNull)
            .mapToDouble(BigDecimal::doubleValue)
            .average());
  }

  /** The 5-day trend is not carried on the DTO, so it is averaged from the signal map instead. */
  private static Double averageOfLookup(
      List<ThemeConstituentDto> constituents, Map<String, BigDecimal> trend5dByCategory) {
    return orNull(
        constituents.stream()
            .map(constituent -> trend5dByCategory.get(constituent.categoryId()))
            .filter(Objects::nonNull)
            .mapToDouble(BigDecimal::doubleValue)
            .average());
  }

  private static Double orNull(OptionalDouble value) {
    return value.isPresent() ? value.getAsDouble() : null;
  }

  private static long countSignal(List<ThemeConstituentDto> constituents, String signal) {
    return constituents.stream().filter(c -> signal.equals(c.tradeSignal())).count();
  }

  private static int bullishCount(List<ThemeConstituentDto> constituents) {
    return (int) (countSignal(constituents, "BUY") + countSignal(constituents, "WATCH"));
  }

  /** The signal a majority of the theme's constituents agree on; HOLD when none does. */
  private static String dominantSignal(List<ThemeConstituentDto> constituents) {
    int total = constituents.size();
    if (total == 0) return "HOLD";
    long buyCount = countSignal(constituents, "BUY");
    long watchCount = countSignal(constituents, "WATCH");
    long reduceCount = countSignal(constituents, "REDUCE");

    if (buyCount * 2 >= total) return "BUY";
    if ((buyCount + watchCount) * 2 >= total) return "WATCH";
    if (reduceCount * 2 > total) return "REDUCE";
    return "HOLD";
  }

  /**
   * Theme composite minus the average composite of its constituents' parent sectors. Positive means
   * the theme's sub-sectors are outpacing their sectors — an early rotation signal.
   */
  private static Double divergenceFromParentSectors(
      List<ThemeConstituentDto> constituents,
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> compositeByCategory,
      Double themeComposite) {
    if (themeComposite == null) return null;

    OptionalDouble parentAverage =
        constituents.stream()
            .map(constituent -> parentComposite(constituent, categoriesById, compositeByCategory))
            .filter(Objects::nonNull)
            .mapToDouble(Double::doubleValue)
            .average();
    return parentAverage.isPresent() ? themeComposite - parentAverage.getAsDouble() : null;
  }

  private static Double parentComposite(
      ThemeConstituentDto constituent,
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> compositeByCategory) {
    Category category = categoriesById.get(constituent.categoryId());
    if (category == null) return null;
    String parentId =
        category.parentId() != null ? category.parentId() : constituent.categoryId();
    BigDecimal parentScore = compositeByCategory.get(parentId);
    return parentScore != null ? parentScore.doubleValue() : null;
  }
}
