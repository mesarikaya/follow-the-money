package com.ftm.app.themes.scoring;

import org.springframework.stereotype.Component;

@Component
public class StabilityCriterion implements QualityCriterion {

  private static final double VOLATILITY_SCALE = 10.0;

  @Override
  public double score(ThemeScoreContext context) {
    if (context.volatility30d() == null) return 0.5;
    return Math.max(0.0, 1.0 - context.volatility30d() * VOLATILITY_SCALE);
  }

  @Override
  public double weight() {
    return 0.20;
  }
}
