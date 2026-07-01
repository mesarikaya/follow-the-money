package com.ftm.app.themes.signal;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Computes the standard deviation of daily composite score changes over the history window. Returns
 * null when history has fewer than 3 points (insufficient data).
 */
@Component
public class ThemeVolatilityCalculator {

  public Double calculate(List<DateHistory> history) {
    if (history.size() < 3) return null;
    double[] scores = history.stream().mapToDouble(DateHistory::averageComposite).toArray();
    double[] changes = new double[scores.length - 1];
    for (int i = 0; i < changes.length; i++) {
      changes[i] = scores[i + 1] - scores[i];
    }
    double mean = 0;
    for (double change : changes) mean += change;
    mean /= changes.length;
    double variance = 0;
    for (double change : changes) variance += Math.pow(change - mean, 2);
    variance /= changes.length;
    return Math.sqrt(variance);
  }
}
