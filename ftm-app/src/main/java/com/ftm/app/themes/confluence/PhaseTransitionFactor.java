package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

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
      case "WATCH_FOR_ENTRY" -> 2;
      case "CYCLE_RESET" -> 1;
      case "APPROACHING_EXIT" -> -2;
      default -> 0;
    };
  }
}
