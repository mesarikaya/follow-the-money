package com.ftm.app.themes.scoring;

import org.springframework.stereotype.Component;

@Component
public class ConvictionCriterion implements QualityCriterion {

  private static final int MAX_STREAK_DAYS = 20;

  @Override
  public double score(ThemeScoreContext context) {
    return Math.min(1.0, (double) context.signalStreakDays() / MAX_STREAK_DAYS);
  }

  @Override
  public double weight() {
    return 0.25;
  }
}
