package com.ftm.app.themes.entry.rules;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.entry.EntryTimingRule;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class HighVolatilityScaleRule implements EntryTimingRule {

  private static final double BUY_THRESHOLD = 0.65;

  @Override
  public Optional<EntryRecommendation> evaluate(EntryTimingContext context) {
    if (context.compositeScore() == null) return Optional.empty();
    boolean inBuyZone = context.compositeScore() >= BUY_THRESHOLD;
    boolean highVolatility = "HIGH".equals(context.riskLevel());
    if (inBuyZone && highVolatility) {
      return Optional.of(
          new EntryRecommendation(
              EntryAction.SCALE_IN,
              "Elevated volatility — scale into position in weekly tranches"));
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 60;
  }

  @Override
  public String ruleName() {
    return "HIGH_VOLATILITY_SCALE";
  }
}
