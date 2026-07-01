package com.ftm.app.themes.confluence;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Computes a 0-100 confluence score by summing weighted factor contributions. Each factor scores
 * [-3, +3]; the weighted average is normalised to [0, 100]. Labels: HIGH_CONFIDENCE (≥70), MODERATE
 * (≥50), CAUTIOUS (≥35), AVOID (<35).
 */
@Component
public class ConfluenceScoreService {

  private final List<ConfluenceFactor> factors;

  public ConfluenceScoreService(List<ConfluenceFactor> factors) {
    this.factors = factors;
  }

  public ConfluenceResult compute(ConfluenceInput input) {
    if (factors.isEmpty()) {
      return new ConfluenceResult(50, "MODERATE");
    }

    double weightedSum = 0.0;
    double totalWeight = 0.0;
    for (ConfluenceFactor factor : factors) {
      weightedSum += factor.score(input) * factor.weight();
      totalWeight += factor.weight();
    }

    double weightedAverage = weightedSum / totalWeight;
    int confluenceScore = (int) Math.round(((weightedAverage + 3.0) / 6.0) * 100.0);
    confluenceScore = Math.max(0, Math.min(100, confluenceScore));

    String label = labelFor(confluenceScore);
    return new ConfluenceResult(confluenceScore, label);
  }

  private static String labelFor(int score) {
    if (score >= 70) return "HIGH_CONFIDENCE";
    if (score >= 50) return "MODERATE";
    if (score >= 35) return "CAUTIOUS";
    return "AVOID";
  }
}
