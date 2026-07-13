package com.ftm.app.themes.transition;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class DistributionSignalTransitionRule implements PhaseTransitionRule {

  @Override
  public Optional<PhaseTransitionSignal> evaluate(PhaseTransitionContext context) {
    if (context.compositeScore() == null
        || context.flow20d() == null
        || context.compositeTrend20d() == null) {
      return Optional.empty();
    }
    boolean inHighZone = context.compositeScore() >= 0.65;
    boolean outflows = context.flow20d() < -0.5;
    boolean trendFading = context.compositeTrend20d() < 0;
    if (inHighZone && outflows && trendFading) {
      return Optional.of(PhaseTransitionSignal.DISTRIBUTION);
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 5;
  }
}
