package com.ftm.app.themes.risk;

import org.springframework.stereotype.Component;

@Component
public class PhaseRiskDimension implements ThemeRiskDimension {

  @Override
  public ThemeRiskLevel evaluate(ThemeRiskContext context) {
    return switch (context.themePhase()) {
      case "BREAKOUT", "MOMENTUM" -> ThemeRiskLevel.LOW;
      case "SETUP", "BUILDING", "HOLDING" -> ThemeRiskLevel.MEDIUM;
      case "FADING", "DISTRIBUTE" -> ThemeRiskLevel.HIGH;
      case "WEAK" -> ThemeRiskLevel.EXTREME;
      default -> ThemeRiskLevel.MEDIUM;
    };
  }

  @Override
  public String dimensionName() {
    return "PHASE";
  }
}
