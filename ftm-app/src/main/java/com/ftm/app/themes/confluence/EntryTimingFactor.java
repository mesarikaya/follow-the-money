package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

@Component
public class EntryTimingFactor implements ConfluenceFactor {

  @Override
  public String factorName() {
    return "ENTRY_TIMING";
  }

  @Override
  public double weight() {
    return 0.35;
  }

  @Override
  public int score(ConfluenceInput input) {
    if (input.entryAction() == null) return 0;
    return switch (input.entryAction()) {
      case "ENTER" -> 3;
      case "WAIT" -> 0;
      case "AVOID" -> -3;
      default -> 0;
    };
  }
}
