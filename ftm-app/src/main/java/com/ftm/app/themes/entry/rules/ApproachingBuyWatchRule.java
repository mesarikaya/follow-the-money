package com.ftm.app.themes.entry.rules;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.entry.EntryTimingRule;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ApproachingBuyWatchRule implements EntryTimingRule {

  private static final double WATCH_LOWER = 0.55;
  private static final double BUY_THRESHOLD = 0.65;

  @Override
  public Optional<EntryRecommendation> evaluate(EntryTimingContext context) {
    if (context.compositeScore() == null) return Optional.empty();
    Double trend5d = context.compositeTrend5d();
    boolean approachingBuy =
        context.compositeScore() >= WATCH_LOWER && context.compositeScore() < BUY_THRESHOLD;
    boolean positiveShortTermMomentum = trend5d != null && trend5d > 0;
    if (approachingBuy && positiveShortTermMomentum) {
      return Optional.of(
          new EntryRecommendation(
              EntryAction.WATCH,
              "Score approaching BUY zone with positive momentum — add to watchlist"));
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 40;
  }

  @Override
  public String ruleName() {
    return "APPROACHING_BUY_WATCH";
  }
}
