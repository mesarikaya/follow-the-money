package com.ftm.app.themes.entry.rules;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.entry.EntryTimingRule;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class BreakoutEntryRule implements EntryTimingRule {

  private static final Set<String> SAFE_RISK_LEVELS = Set.of("LOW", "MEDIUM");
  private static final double BUY_THRESHOLD = 0.65;

  @Override
  public Optional<EntryRecommendation> evaluate(EntryTimingContext context) {
    if (context.compositeScore() == null) return Optional.empty();
    Double trend5d = context.compositeTrend5d();
    Double trend20d = context.compositeTrend20d();
    boolean inBuyZone = context.compositeScore() >= BUY_THRESHOLD;
    boolean momentumStrong = trend5d != null && trend5d > 0.010 && trend20d != null && trend20d > 0.005;
    boolean safeRisk = SAFE_RISK_LEVELS.contains(context.riskLevel());
    if (inBuyZone && momentumStrong && safeRisk) {
      return Optional.of(
          new EntryRecommendation(EntryAction.ENTER, "Breakout momentum confirmed across 5d and 20d — full position entry"));
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 80;
  }

  @Override
  public String ruleName() {
    return "BREAKOUT_ENTRY";
  }
}
