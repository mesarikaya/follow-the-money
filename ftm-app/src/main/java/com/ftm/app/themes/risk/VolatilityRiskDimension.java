package com.ftm.app.themes.risk;

import org.springframework.stereotype.Component;

@Component
public class VolatilityRiskDimension implements ThemeRiskDimension {

  @Override
  public ThemeRiskLevel evaluate(ThemeRiskContext context) {
    Double volatility = context.volatility30d();
    if (volatility == null) return ThemeRiskLevel.MEDIUM;
    if (volatility >= 0.04) return ThemeRiskLevel.EXTREME;
    if (volatility >= 0.025) return ThemeRiskLevel.HIGH;
    if (volatility >= 0.01) return ThemeRiskLevel.MEDIUM;
    return ThemeRiskLevel.LOW;
  }

  @Override
  public String dimensionName() {
    return "VOLATILITY";
  }
}
