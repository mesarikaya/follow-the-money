package com.ftm.app.themes.scoring;

import org.springframework.stereotype.Component;

@Component
public class SignalStrengthCriterion implements QualityCriterion {

  @Override
  public double score(ThemeScoreContext context) {
    if (context.compositeScore() == null) return 0.0;
    return context.compositeScore();
  }

  @Override
  public double weight() {
    return 0.40;
  }
}
