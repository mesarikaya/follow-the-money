package com.ftm.app.themes.scoring;

public interface QualityCriterion {
  double score(ThemeScoreContext context);

  double weight();
}
