package com.ftm.app.themes.entry.rules;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.entry.EntryRecommendation;
import com.ftm.app.themes.entry.EntryTimingContext;
import com.ftm.app.themes.entry.EntryTimingRule;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class AvoidExtremeRiskRule implements EntryTimingRule {

  private static final Set<String> HIGH_RISK_PHASES = Set.of("WEAK", "DISTRIBUTE", "FADING");

  @Override
  public Optional<EntryRecommendation> evaluate(EntryTimingContext context) {
    boolean extremeRisk = "EXTREME".equals(context.riskLevel());
    boolean dangerousPhase = HIGH_RISK_PHASES.contains(context.themePhase());
    if (extremeRisk || dangerousPhase) {
      return Optional.of(
          new EntryRecommendation(EntryAction.AVOID, "Risk dimensions or phase signal distribution/weakness"));
    }
    return Optional.empty();
  }

  @Override
  public int priority() {
    return 100;
  }

  @Override
  public String ruleName() {
    return "AVOID_EXTREME_RISK";
  }
}
