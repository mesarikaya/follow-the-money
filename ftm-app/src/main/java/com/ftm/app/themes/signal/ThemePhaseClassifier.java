package com.ftm.app.themes.signal;

import org.springframework.stereotype.Component;

/**
 * Derives the lifecycle phase label for a theme from its composite score and trend signals.
 * Each condition is self-contained — no mutation, no shared state.
 */
@Component
public class ThemePhaseClassifier {

  public String classify(Double score, Double trend5d, Double trend20d, Double flow) {
    if (score == null) return "NEUTRAL";
    boolean accelerating = trend5d != null && trend20d != null && (trend5d - trend20d) > 0.005;
    boolean trending = trend20d != null && trend20d > 0.003;
    boolean fading = trend20d != null && trend20d < -0.003;
    boolean inflowing = flow != null && flow > 0.3;
    boolean outflowing = flow != null && flow < -0.5;
    if (score >= 0.65) {
      if (outflowing && !accelerating) return "DISTRIBUTE";
      if (accelerating) return "BREAKOUT";
      if (trending) return "MOMENTUM";
      return "HOLDING";
    }
    if (score >= 0.50) {
      if (accelerating && inflowing) return "SETUP";
      if (fading) return "FADING";
      return "BUILDING";
    }
    if (fading) return "FADING";
    if (score < 0.35) return "WEAK";
    return "NEUTRAL";
  }
}
