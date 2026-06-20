package com.ftm.app.themes.rotation;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class TrendAlignmentMetric implements CapitalRotationMetric {

  private static final double SCORE_MIDPOINT = 0.5;
  private static final double TREND_THRESHOLD = 0.002;

  @Override
  public double compute(List<ThemeSummaryDto> themes) {
    long eligible = 0;
    long aligned = 0;
    for (ThemeSummaryDto theme : themes) {
      if (theme.compositeScore() == null || theme.compositeTrend20d() == null) continue;
      eligible++;
      boolean aboveMidpoint = theme.compositeScore() > SCORE_MIDPOINT;
      boolean trendingUp = theme.compositeTrend20d() > TREND_THRESHOLD;
      boolean trendingDown = theme.compositeTrend20d() < -TREND_THRESHOLD;
      if ((aboveMidpoint && trendingUp) || (!aboveMidpoint && trendingDown)) {
        aligned++;
      }
    }
    return eligible == 0 ? 0.0 : (double) aligned / eligible;
  }

  @Override
  public String metricName() {
    return "TREND_ALIGNMENT";
  }

  @Override
  public double weight() {
    return 0.40;
  }
}
