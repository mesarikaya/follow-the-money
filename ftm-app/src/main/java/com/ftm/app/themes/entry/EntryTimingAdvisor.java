package com.ftm.app.themes.entry;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class EntryTimingAdvisor {

  private final List<EntryTimingRule> rules;

  public EntryTimingAdvisor(List<EntryTimingRule> rules) {
    this.rules =
        rules.stream()
            .sorted(Comparator.comparingInt(EntryTimingRule::priority).reversed())
            .toList();
  }

  public Optional<EntryRecommendation> advise(EntryTimingContext context) {
    return rules.stream()
        .map(rule -> rule.evaluate(context))
        .filter(Optional::isPresent)
        .map(Optional::get)
        .findFirst();
  }
}
