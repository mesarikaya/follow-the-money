package com.ftm.app.themes.entry.rules;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.entry.EntryTimingRule;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DipBuyRule implements EntryTimingRule {

  private static final Set<String> SAFE_RISK_LEVELS = Set.of("LOW", "MEDIUM");
  private static final double BUY_THRESHOLD = 0.65;

  @Override
  public Optional<EntryRecommendation> evaluate(EntryTimingContext context) {
    if (context.compositeScore() == null) return Optional.empty();
    Double trend5d = context.compositeTrend5d();
    Double trend20d = context.compositeTrend20d();
    boolean inBuyZone = context.compositeScore() >= BUY_THRESHOLD;
    boolean shortTermDip = trend5d != null && trend5d < -0.005;
    boolean longerTermPositive = trend20d != null && trend20d > 0;
    boolean safeRisk = SAFE_RISK_LEVELS.contains(context.riskLevel());
    if (inBuyZone && shortTermDip && longerTermPositive && safeRisk) {
      return Optional.of(
          new EntryRecommendation(EntryAction.SCALE_IN, "Short-term pullback within uptrend — staged entry at current dip"));
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 70;
  }

  @Override
  public String ruleName() {
    return "DIP_BUY";
  }
}
