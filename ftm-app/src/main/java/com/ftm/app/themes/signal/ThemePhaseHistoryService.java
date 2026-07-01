package com.ftm.app.themes.signal;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ThemePhaseHistoryService {

  private final ThemePhaseClassifier themePhaseClassifier;

  public ThemePhaseHistoryService(ThemePhaseClassifier themePhaseClassifier) {
    this.themePhaseClassifier = themePhaseClassifier;
  }

  public List<String> computeHistory(List<DateHistory> history) {
    return history.stream()
        .map(
            h ->
                themePhaseClassifier.classify(
                    h.averageComposite(), h.averageTrend5d(), h.averageTrend20d(), null))
        .toList();
  }

  public int computePhaseStreak(List<DateHistory> history, String currentPhase) {
    if (history.isEmpty() || currentPhase == null) return 0;
    List<String> phases = computeHistory(history);
    int streak = 0;
    for (int i = phases.size() - 1; i >= 0; i--) {
      if (phases.get(i).equals(currentPhase)) streak++;
      else break;
    }
    return streak;
  }
}
