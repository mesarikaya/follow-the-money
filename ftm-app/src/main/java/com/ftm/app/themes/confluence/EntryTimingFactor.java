package com.ftm.app.themes.confluence;

import org.springframework.stereotype.Component;

/**
 * How strongly the entry advisor wants us in this theme. A scale-in is genuinely constructive, just
 * less so than a full entry; a watch is neutral. Before the enum, this factor only knew ENTER / WAIT
 * / AVOID, so SCALE_IN and WATCH — two of the four actions the advisor emits — scored 0.
 */
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
      case ENTER -> 3;
      case SCALE_IN -> 2;
      case WATCH -> 0;
      case AVOID -> -3;
    };
  }
}
