package com.ftm.app.themes.signal;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class ThemePersistenceService {

  private static final Set<String> STRONG_PHASES = Set.of("BREAKOUT", "MOMENTUM", "SETUP");

  private final ThemePhaseHistoryService themePhaseHistoryService;

  public ThemePersistenceService(ThemePhaseHistoryService themePhaseHistoryService) {
    this.themePhaseHistoryService = themePhaseHistoryService;
  }

  public ThemePersistence computePersistence(List<DateHistory> history) {
    if (history.isEmpty()) return new ThemePersistence(0, "F");
    List<String> phases = themePhaseHistoryService.computeHistory(history);
    long strongDays = phases.stream().filter(STRONG_PHASES::contains).count();
    int score = (int) Math.round((double) strongDays / phases.size() * 100);
    return new ThemePersistence(score, gradeFor(score));
  }

  private String gradeFor(int score) {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
  }

  public record ThemePersistence(int persistenceScore, String persistenceGrade) {}
}
