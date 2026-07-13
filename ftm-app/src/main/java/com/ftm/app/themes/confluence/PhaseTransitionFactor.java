package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

/**
 * How much the theme's turning point argues for or against entering now. Scores the four signals the
 * detector emits; before the enum existed this factor switched on three names nothing ever produced,
 * so it always scored 0 and its weight was dead.
 */
@Component
public class PhaseTransitionFactor implements ConfluenceFactor {

  @Override
  public String factorName() {
    return "PHASE_TRANSITION";
  }

  @Override
  public double weight() {
    return 0.15;
  }

  @Override
  public int score(ConfluenceInput input) {
    if (input.phaseTransitionSignal() == null) return 0;
    return switch (input.phaseTransitionSignal()) {
      case APPROACHING_BUY -> 2;
      case EARLY_RECOVERY -> 1;
      case BREAKOUT_AT_RISK -> -2;
      case DISTRIBUTION -> -2;
    };
  }
}
