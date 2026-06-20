package com.ftm.app.themes.entry;

import java.util.Optional;

public interface EntryTimingRule {
  Optional<EntryRecommendation> evaluate(EntryTimingContext context);

  int priority();

  String ruleName();
}
