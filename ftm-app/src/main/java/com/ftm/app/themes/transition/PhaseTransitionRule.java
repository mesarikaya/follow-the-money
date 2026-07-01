package com.ftm.app.themes.transition;

import java.util.Optional;

public interface PhaseTransitionRule {
  Optional<String> evaluate(PhaseTransitionContext context);

  int priority();
}
