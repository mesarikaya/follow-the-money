package com.ftm.app.themes.correlation;

import com.ftm.app.api.dto.ThemeCorrelationDto;
import com.ftm.app.domain.Theme;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import com.ftm.app.themes.repository.ThemeRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Computes pairwise Pearson correlation of daily score deltas across all themes.
 *
 * Score deltas (day-over-day changes) are used instead of raw score levels to avoid
 * spurious correlation caused by shared macro trends or regime drift.
 */
@Service
public class ThemeSignalCorrelationService {

  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;

  public ThemeSignalCorrelationService(
      ThemeRepository themeRepository, SignalRepository signalRepository) {
    this.themeRepository = themeRepository;
    this.signalRepository = signalRepository;
  }

  public ThemeCorrelationDto compute(int days) {
    List<Theme> themes = themeRepository.findAll();
    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();

    List<String> themeIds = themes.stream().map(Theme::id).toList();
    List<String> themeNames = themes.stream().map(Theme::name).toList();

    List<double[]> deltaSeriesList = new ArrayList<>();
    for (Theme theme : themes) {
      List<String> constituentIds = constituentsByTheme.getOrDefault(theme.id(), List.of());
      List<DateHistory> history = signalRepository.findAverageHistoryByDate(constituentIds, days);
      deltaSeriesList.add(toDeltas(history));
    }

    int n = themes.size();
    double[][] matrix = new double[n][n];
    for (int i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (int j = i + 1; j < n; j++) {
        double[] aligned1 = alignedDeltas(deltaSeriesList.get(i), deltaSeriesList.get(j));
        double[] aligned2 = alignedDeltas(deltaSeriesList.get(j), deltaSeriesList.get(i));
        double r = PearsonCorrelation.compute(aligned1, aligned2);
        matrix[i][j] = r;
        matrix[j][i] = r;
      }
    }

    return new ThemeCorrelationDto(themeIds, themeNames, matrix);
  }

  private static double[] toDeltas(List<DateHistory> history) {
    if (history.size() < 2) return new double[0];
    double[] deltas = new double[history.size() - 1];
    for (int i = 1; i < history.size(); i++) {
      deltas[i - 1] = history.get(i).averageComposite() - history.get(i - 1).averageComposite();
    }
    return deltas;
  }

  private static double[] alignedDeltas(double[] primary, double[] other) {
    int len = Math.min(primary.length, other.length);
    if (len == 0) return new double[0];
    double[] result = new double[len];
    System.arraycopy(primary, primary.length - len, result, 0, len);
    return result;
  }
}
