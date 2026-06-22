package com.ftm.app.themes.scoring;

import org.springframework.stereotype.Component;

@Component
public class MomentumCriterion implements QualityCriterion {

  private static final double TREND_HALF_RANGE = 0.04;

  @Override
  public double score(ThemeScoreContext context) {
    if (context.compositeTrend20d() == null) return 0.5;
    return Math.max(
        0.0,
        Math.min(
            1.0, (context.compositeTrend20d() + TREND_HALF_RANGE) / (2.0 * TREND_HALF_RANGE)));
  }

  @Override
  public double weight() {
    return 0.10;
  }
}
