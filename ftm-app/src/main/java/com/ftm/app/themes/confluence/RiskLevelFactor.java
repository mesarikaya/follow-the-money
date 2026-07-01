package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

@Component
public class RiskLevelFactor implements ConfluenceFactor {

  @Override
  public String factorName() {
    return "RISK_LEVEL";
  }

  @Override
  public double weight() {
    return 0.25;
  }

  @Override
  public int score(ConfluenceInput input) {
    if (input.riskLevel() == null) return 0;
    return switch (input.riskLevel()) {
      case "LOW" -> 2;
      case "MEDIUM" -> 1;
      case "HIGH" -> -1;
      case "EXTREME" -> -3;
      default -> 0;
    };
  }
}
