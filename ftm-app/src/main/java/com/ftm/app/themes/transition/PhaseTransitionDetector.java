package com.ftm.app.themes.transition;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class PhaseTransitionDetector {

  private final List<PhaseTransitionRule> rules;

  public PhaseTransitionDetector(List<PhaseTransitionRule> rules) {
    this.rules = rules;
  }

  public Optional<PhaseTransitionSignal> detect(PhaseTransitionContext context) {
    return rules.stream()
        .sorted(Comparator.comparingInt(PhaseTransitionRule::priority).reversed())
        .map(rule -> rule.evaluate(context))
        .filter(Optional::isPresent)
        .map(Optional::get)
        .findFirst();
  }
}
