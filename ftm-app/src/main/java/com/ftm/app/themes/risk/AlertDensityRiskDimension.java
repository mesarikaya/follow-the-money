package com.ftm.app.themes.risk;

import org.springframework.stereotype.Component;

@Component
public class AlertDensityRiskDimension implements ThemeRiskDimension {

  @Override
  public ThemeRiskLevel evaluate(ThemeRiskContext context) {
    int alerts = context.alertCount30d();
    if (alerts >= 15) return ThemeRiskLevel.EXTREME;
    if (alerts >= 8) return ThemeRiskLevel.HIGH;
    if (alerts >= 3) return ThemeRiskLevel.MEDIUM;
    return ThemeRiskLevel.LOW;
  }

  @Override
  public String dimensionName() {
    return "ALERT_DENSITY";
  }
}
