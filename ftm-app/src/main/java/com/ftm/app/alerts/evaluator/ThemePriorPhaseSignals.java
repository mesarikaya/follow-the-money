package com.ftm.app.alerts.evaluator;

import static com.ftm.app.alerts.evaluator.ThemeSignalReader.PHASE_LOOKBACK_DAYS;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.average;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.averageOrNull;

import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;

/**
 * Where the themes stood a trading week ago. Reading it costs three queries, so a phase rule only
 * pays for them once it has actually found a theme in the phase it cares about — which on most days
 * is never. Loaded at most once per evaluation.
 */
final class ThemePriorPhaseSignals {

  static final String UNKNOWN_PHASE = "UNKNOWN";

  private final ThemeSignalReader reader;
  private final LocalDate signalDate;

  private boolean loaded;
  private Map<String, BigDecimal> composites = Map.of();
  private Map<String, BigDecimal> trends5d = Map.of();
  private Map<String, BigDecimal> trends20d = Map.of();

  ThemePriorPhaseSignals(ThemeSignalReader reader, LocalDate signalDate) {
    this.reader = reader;
    this.signalDate = signalDate;
  }

  /** The phase a theme was in a week ago, or UNKNOWN when it had no score then. */
  String phaseOf(List<String> categoryIds) {
    load();
    OptionalDouble score = average(categoryIds, composites);
    if (score.isEmpty()) return UNKNOWN_PHASE;
    return ThemeSignalReader.phaseOf(
        score.getAsDouble(),
        averageOrNull(categoryIds, trends5d),
        averageOrNull(categoryIds, trends20d));
  }

  /** True when the theme had a score a week ago at all — the phase is only meaningful if it did. */
  boolean hasScoreFor(List<String> categoryIds) {
    load();
    return average(categoryIds, composites).isPresent();
  }

  private void load() {
    if (loaded) return;
    loaded = true;
    LocalDate priorDate =
        reader.nthPreviousSignalDate(SignalType.COMPOSITE, signalDate, PHASE_LOOKBACK_DAYS);
    if (priorDate == null) return;
    composites = reader.signalsAt(SignalType.COMPOSITE, priorDate);
    trends5d = reader.signalsAt(SignalType.COMPOSITE_TREND_5D, priorDate);
    trends20d = reader.signalsAt(SignalType.COMPOSITE_TREND_20D, priorDate);
  }
}
