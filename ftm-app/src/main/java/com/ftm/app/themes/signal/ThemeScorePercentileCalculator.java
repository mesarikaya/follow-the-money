package com.ftm.app.themes.signal;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Computes the percentile rank of the current composite score within the history window. A value of
 * 0.80 means the current score is above 80% of recent history.
 */
@Component
public class ThemeScorePercentileCalculator {

  public Double calculate(List<DateHistory> history, Double currentScore) {
    if (history.isEmpty() || currentScore == null) return null;
    long belowCount =
        history.stream()
            .mapToDouble(DateHistory::averageComposite)
            .filter(s -> s < currentScore)
            .count();
    return (double) belowCount / history.size();
  }
}
