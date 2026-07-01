package com.ftm.app.themes.transition;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class BreakoutAtRiskTransitionRule implements PhaseTransitionRule {

  @Override
  public Optional<String> evaluate(PhaseTransitionContext context) {
    if (context.compositeScore() == null || context.compositeTrend5d() == null) {
      return Optional.empty();
    }
    boolean inBuyZone = context.compositeScore() >= 0.65;
    boolean trendDecelerating = context.compositeTrend5d() < -0.005;
    boolean alertPressure = context.alertCount30d() >= 5;
    if (inBuyZone && trendDecelerating && alertPressure) {
      return Optional.of("BREAKOUT_AT_RISK");
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 5;
  }
}
