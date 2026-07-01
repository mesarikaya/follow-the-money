package com.ftm.app.themes.rotation;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CapitalRotationScoreService {

  private final List<CapitalRotationMetric> metrics;

  public CapitalRotationScoreService(List<CapitalRotationMetric> metrics) {
    this.metrics = metrics;
  }

  public CapitalRotationResult compute(List<ThemeSummaryDto> themes) {
    if (themes.isEmpty()) {
      return new CapitalRotationResult(0.0, "CONSOLIDATING", 0.0, 0.0, List.of(), List.of());
    }

    double totalWeight = metrics.stream().mapToDouble(CapitalRotationMetric::weight).sum();
    double[] metricValues = metrics.stream().mapToDouble(m -> m.compute(themes)).toArray();

    double weightedScore = 0.0;
    for (int i = 0; i < metrics.size(); i++) {
      weightedScore += metricValues[i] * metrics.get(i).weight();
    }
    double rotationScore = totalWeight > 0 ? weightedScore / totalWeight : 0.0;

    double dispersion = metricValueFor("SCORE_DISPERSION", metricValues);
    double trendAlignment = metricValueFor("TREND_ALIGNMENT", metricValues);

    List<ThemeSummaryDto> scored =
        themes.stream()
            .filter(t -> t.compositeScore() != null)
            .sorted(Comparator.comparingDouble(ThemeSummaryDto::compositeScore).reversed())
            .toList();
    List<String> leaders = scored.stream().limit(3).map(ThemeSummaryDto::name).toList();
    List<String> laggers = scored.reversed().stream().limit(3).map(ThemeSummaryDto::name).toList();

    return new CapitalRotationResult(
        rotationScore, intensityLabel(rotationScore), dispersion, trendAlignment, leaders, laggers);
  }

  private double metricValueFor(String name, double[] values) {
    for (int i = 0; i < metrics.size(); i++) {
      if (metrics.get(i).metricName().equals(name)) return values[i];
    }
    return 0.0;
  }

  private static String intensityLabel(double score) {
    if (score >= 0.70) return "STRONG";
    if (score >= 0.45) return "MODERATE";
    if (score >= 0.25) return "LOW";
    return "CONSOLIDATING";
  }
}
