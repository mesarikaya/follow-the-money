package com.ftm.app.themes.risk;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ThemeRiskAggregator {

  private final List<ThemeRiskDimension> dimensions;

  public ThemeRiskAggregator(List<ThemeRiskDimension> dimensions) {
    this.dimensions = dimensions;
  }

  public ThemeRiskLevel aggregate(ThemeRiskContext context) {
    return dimensions.stream()
        .map(dimension -> dimension.evaluate(context))
        .max(Comparator.naturalOrder())
        .orElse(ThemeRiskLevel.MEDIUM);
  }
}
