package com.ftm.app.themes.scoring;

import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ThemeQualityScorer {

  private final List<QualityCriterion> criteria;

  public ThemeQualityScorer(List<QualityCriterion> criteria) {
    this.criteria = criteria;
  }

  public Double computeScore(ThemeScoreContext context) {
    if (context.compositeScore() == null) return null;
    return criteria.stream()
        .mapToDouble(criterion -> criterion.score(context) * criterion.weight())
        .sum();
  }
}
