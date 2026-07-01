package com.ftm.app.themes.rotation;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ScoreDispersionMetric implements CapitalRotationMetric {

  private static final double NORMALIZATION_FACTOR = 0.5;

  @Override
  public double compute(List<ThemeSummaryDto> themes) {
    List<Double> scores =
        themes.stream()
            .map(ThemeSummaryDto::compositeScore)
            .filter(s -> s != null)
            .sorted()
            .toList();
    if (scores.size() < 4) return 0.0;
    double q1 = scores.get(scores.size() / 4);
    double q3 = scores.get((3 * scores.size()) / 4);
    double interquartileRange = q3 - q1;
    return Math.min(1.0, interquartileRange / NORMALIZATION_FACTOR);
  }

  @Override
  public String metricName() {
    return "SCORE_DISPERSION";
  }

  @Override
  public double weight() {
    return 0.60;
  }
}
