package com.ftm.app.themes.transition;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class ApproachingBuyTransitionRule implements PhaseTransitionRule {

  @Override
  public Optional<PhaseTransitionSignal> evaluate(PhaseTransitionContext context) {
    if (context.compositeScore() == null || context.compositeTrend5d() == null) {
      return Optional.empty();
    }
    boolean scoreInApproachZone =
        context.compositeScore() >= 0.55 && context.compositeScore() < 0.65;
    boolean accelerating = context.compositeTrend5d() > 0.005;
    boolean hasConviction = context.signalStreakDays() >= 5;
    if (scoreInApproachZone && accelerating && hasConviction) {
      return Optional.of(PhaseTransitionSignal.APPROACHING_BUY);
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 4;
  }
}
