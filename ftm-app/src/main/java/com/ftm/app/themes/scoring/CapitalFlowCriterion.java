package com.ftm.app.themes.scoring;

import org.springframework.stereotype.Component;

@Component
public class CapitalFlowCriterion implements QualityCriterion {

  private static final double FLOW_HALF_RANGE = 2.0;

  @Override
  public double score(ThemeScoreContext context) {
    if (context.flow20d() == null) return 0.5;
    return Math.max(
        0.0,
        Math.min(
            1.0, (context.flow20d() + FLOW_HALF_RANGE) / (2.0 * FLOW_HALF_RANGE)));
  }

  @Override
  public double weight() {
    return 0.05;
  }
}
