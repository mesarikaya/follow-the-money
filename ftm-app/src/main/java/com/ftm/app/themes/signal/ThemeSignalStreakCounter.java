package com.ftm.app.themes.signal;

import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Counts how many consecutive history points share the same signal as the current dominant signal.
 * Walks backward from the most recent history entry.
 */
@Component
public class ThemeSignalStreakCounter {

  public int count(List<DateHistory> history, String currentSignal) {
    if (history.isEmpty()) return 0;
    List<DateHistory> reversed = history.reversed();
    int streak = 0;
    for (DateHistory point : reversed) {
      if (inferSignal(point.averageComposite()).equals(currentSignal)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private static String inferSignal(double score) {
    if (score >= 0.65) return "BUY";
    if (score >= 0.50) return "WATCH";
    if (score >= 0.35) return "HOLD";
    return "REDUCE";
  }
}
