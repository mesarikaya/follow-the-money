package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

@Component
public class MomentumAlignmentFactor implements ConfluenceFactor {

  @Override
  public String factorName() {
    return "MOMENTUM_ALIGNMENT";
  }

  @Override
  public double weight() {
    return 0.25;
  }

  @Override
  public int score(ConfluenceInput input) {
    if (input.momentumAlignment() == null) return 0;
    return switch (input.momentumAlignment()) {
      case "ALIGNED_BULLISH" -> 2;
      case "RECOVERING" -> 1;
      case "NEUTRAL" -> 0;
      case "FADING" -> -1;
      case "ALIGNED_BEARISH" -> -2;
      default -> 0;
    };
  }
}
