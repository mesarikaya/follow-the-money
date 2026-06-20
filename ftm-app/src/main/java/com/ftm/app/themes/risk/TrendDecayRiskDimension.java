package com.ftm.app.themes.risk;

import org.springframework.stereotype.Component;

@Component
public class TrendDecayRiskDimension implements ThemeRiskDimension {

  @Override
  public ThemeRiskLevel evaluate(ThemeRiskContext context) {
    Double trend5d = context.compositeTrend5d();
    Double trend20d = context.compositeTrend20d();
    if (trend5d == null && trend20d == null) return ThemeRiskLevel.MEDIUM;
    if (trend5d != null && trend5d < -0.015 && trend20d != null && trend20d < -0.01)
      return ThemeRiskLevel.EXTREME;
    boolean bothNegative =
        (trend5d == null || trend5d < 0) && (trend20d == null || trend20d < 0);
    if (bothNegative) return ThemeRiskLevel.HIGH;
    boolean bothPositive =
        (trend5d == null || trend5d >= 0.005) && (trend20d == null || trend20d >= 0);
    if (bothPositive) return ThemeRiskLevel.LOW;
    return ThemeRiskLevel.MEDIUM;
  }

  @Override
  public String dimensionName() {
    return "TREND_DECAY";
  }
}
