package com.ftm.app.signals.service;

import com.ftm.app.api.dto.SignalTransitionDto;
import com.ftm.app.domain.Category;
import com.ftm.app.signals.repository.SignalAnalyticsRepository.SignalSnapshotPair;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Finds the categories whose trade signal has actually changed between two snapshots, and describes
 * each change. Categories whose signal is the same on both dates are dropped — a transition list is
 * only interesting where something moved.
 */
@Component
public class SignalTransitionAssembler {

  /** Everything known about a category besides the two snapshots themselves. */
  public record TransitionContext(
      Map<String, Category> categoriesById,
      Map<String, BigDecimal> scorePercentile252d,
      Map<String, BigDecimal> macroFitByCategory,
      Map<String, Integer> signalDaysActive,
      int lookbackDays) {}

  public List<SignalTransitionDto> assemble(
      List<SignalSnapshotPair> snapshotPairs, TransitionContext context) {
    return snapshotPairs.stream()
        .map(pair -> toTransition(pair, context))
        .filter(Objects::nonNull)
        .sorted(Comparator.comparingInt(t -> signalPriority(t.currentSignal())))
        .toList();
  }

  private SignalTransitionDto toTransition(SignalSnapshotPair pair, TransitionContext context) {
    String currentQuadrant = quadrantOf(pair.currentRrg());
    String previousQuadrant = quadrantOf(pair.previousRrg());
    String currentSignal =
        TradeSignalDeriver.derive(pair.currentScore(), currentQuadrant, pair.currentTrend());
    String previousSignal =
        TradeSignalDeriver.derive(pair.previousScore(), previousQuadrant, pair.previousTrend());
    if (Objects.equals(currentSignal, previousSignal)) return null;

    Category category = context.categoriesById().get(pair.categoryId());
    BigDecimal percentile = context.scorePercentile252d().get(pair.categoryId());
    BigDecimal macroFit = context.macroFitByCategory().get(pair.categoryId());
    Integer daysActive = context.signalDaysActive().get(pair.categoryId());

    // Simplified conviction: trend5d, RS acceleration, flow and RS-20 are not fetched here.
    int conviction =
        TradeSignalDeriver.convictionScore(
            pair.currentScore(),
            currentQuadrant,
            pair.currentTrend(),
            macroFit,
            percentile,
            null,
            null,
            null,
            null,
            null);

    return new SignalTransitionDto(
        pair.categoryId(),
        category != null ? category.name() : pair.categoryId(),
        category != null ? category.etfTicker() : "",
        previousSignal,
        currentSignal,
        pair.currentScore().doubleValue(),
        pair.comparisonDate(),
        daysAgo(pair.comparisonDate(), context.lookbackDays()),
        percentile != null ? percentile.doubleValue() : null,
        macroFit != null ? macroFit.doubleValue() : null,
        daysActive,
        conviction > 0 ? conviction : null);
  }

  private static int daysAgo(LocalDate comparisonDate, int lookbackDays) {
    return comparisonDate != null
        ? (int) ChronoUnit.DAYS.between(comparisonDate, LocalDate.now())
        : lookbackDays;
  }

  private static String quadrantOf(BigDecimal quadrant) {
    return quadrant != null ? String.valueOf(quadrant.intValue()) : null;
  }

  /** Buys first — a transition into BUY is the one a user most wants to see. */
  private static int signalPriority(String signal) {
    return switch (signal == null ? "" : signal) {
      case "BUY" -> 0;
      case "WATCH" -> 1;
      case "REDUCE" -> 2;
      default -> 3;
    };
  }
}
