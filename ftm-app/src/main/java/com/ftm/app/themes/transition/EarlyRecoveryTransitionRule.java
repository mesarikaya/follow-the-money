package com.ftm.app.themes.transition;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class EarlyRecoveryTransitionRule implements PhaseTransitionRule {

  @Override
  public Optional<String> evaluate(PhaseTransitionContext context) {
    if (context.compositeScore() == null || context.compositeTrend5d() == null) {
      return Optional.empty();
    }
    boolean inRecoveryZone = context.compositeScore() >= 0.35 && context.compositeScore() < 0.50;
    boolean strongUptrend = context.compositeTrend5d() > 0.010;
    boolean buildingMomentum = context.signalStreakDays() >= 3;
    if (inRecoveryZone && strongUptrend && buildingMomentum) {
      return Optional.of("EARLY_RECOVERY");
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 3;
  }
}
