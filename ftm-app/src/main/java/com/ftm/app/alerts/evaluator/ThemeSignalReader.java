package com.ftm.app.alerts.evaluator;

import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import org.springframework.stereotype.Component;

/**
 * What the theme-phase alert rules all need to ask: which categories make up each theme, what a
 * signal read on a given day, how a theme's constituents average out, and which phase that average
 * puts the theme in.
 */
@Component
public class ThemeSignalReader {

  /** A theme's phase is compared against where it stood a trading week earlier. */
  public static final int PHASE_LOOKBACK_DAYS = 5;

  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;

  public ThemeSignalReader(ThemeRepository themeRepository, SignalRepository signalRepository) {
    this.themeRepository = themeRepository;
    this.signalRepository = signalRepository;
  }

  public Map<String, List<String>> constituentsByTheme() {
    return themeRepository.findAllConstituentsByTheme();
  }

  public Map<String, BigDecimal> signalsAt(SignalType type, LocalDate date) {
    return signalRepository.findByTypeAndDate(type, date);
  }

  /** The signal date {@code n} trading days back, or null if the history does not reach. */
  public LocalDate nthPreviousSignalDate(SignalType type, LocalDate date, int lookbackDays) {
    LocalDate result = date;
    for (int i = 0; i < lookbackDays; i++) {
      result = signalRepository.findPreviousSignalDate(type, result);
      if (result == null) return null;
    }
    return result;
  }

  /** The mean signal across a theme's constituents, ignoring the ones with no reading. */
  public static OptionalDouble average(List<String> categoryIds, Map<String, BigDecimal> signals) {
    return categoryIds.stream()
        .map(signals::get)
        .filter(Objects::nonNull)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  public static Double averageOrNull(List<String> categoryIds, Map<String, BigDecimal> signals) {
    OptionalDouble average = average(categoryIds, signals);
    return average.isPresent() ? average.getAsDouble() : null;
  }

  /**
   * The lifecycle phase a theme's averages put it in: BREAKOUT / MOMENTUM / HOLDING when the score
   * is strong, SETUP / BUILDING / FADING while it is building, WEAK / NEUTRAL below that.
   */
  public static String phaseOf(double score, Double trend5d, Double trend20d) {
    boolean accelerating = trend5d != null && trend20d != null && (trend5d - trend20d) > 0.005;
    boolean trending = trend20d != null && trend20d > 0.003;
    boolean fading = trend20d != null && trend20d < -0.003;

    if (score >= 0.65) {
      if (accelerating) return "BREAKOUT";
      if (trending) return "MOMENTUM";
      return "HOLDING";
    }
    if (score >= 0.50) {
      if (accelerating) return "SETUP";
      if (fading) return "FADING";
      return "BUILDING";
    }
    if (fading) return "FADING";
    if (score < 0.35) return "WEAK";
    return "NEUTRAL";
  }
}
