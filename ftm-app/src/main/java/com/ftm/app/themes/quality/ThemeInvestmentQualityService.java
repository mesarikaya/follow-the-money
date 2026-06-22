package com.ftm.app.themes.quality;

import org.springframework.stereotype.Component;

/**
 * Computes a single Investment Quality Score (IQS) — a 0-100 composite that combines signal
 * quality (confluence + persistence + streak) with portfolio attributes (value vs recent history,
 * diversification, low volatility). Distinct from confluenceScore, which focuses solely on entry
 * timing signals.
 *
 * <p>Weights: signal quality 50 %, value 20 %, diversification 15 %, volatility 15 %.
 */
@Component
public class ThemeInvestmentQualityService {

  private static final double MAX_VOLATILITY = 0.10;
  private static final int MAX_STREAK_CONTRIBUTION = 30;

  public ThemeQuality computeQuality(ThemeQualityContext ctx) {
    double signalQuality = computeSignalQuality(ctx);
    double volatilityScore = computeVolatilityScore(ctx.volatility30d());
    double diversificationScore = computeDiversificationScore(ctx.concentrationRisk());
    double valueScore = computeValueScore(ctx.scorePercentile30d());

    int score = (int) Math.round(
        signalQuality * 0.50
        + valueScore * 0.20
        + diversificationScore * 0.15
        + volatilityScore * 0.15);

    return new ThemeQuality(score, gradeFor(score));
  }

  private double computeSignalQuality(ThemeQualityContext ctx) {
    double streakContribution = Math.min(100, ctx.signalStreakDays() * (100.0 / MAX_STREAK_CONTRIBUTION));
    return ctx.confluenceScore() * 0.50 + ctx.persistenceScore() * 0.30 + streakContribution * 0.20;
  }

  private double computeVolatilityScore(Double volatility30d) {
    if (volatility30d == null) return 50.0;
    return Math.max(0, Math.min(100, (1.0 - volatility30d / MAX_VOLATILITY) * 100));
  }

  private double computeDiversificationScore(Double concentrationRisk) {
    if (concentrationRisk == null) return 50.0;
    return Math.max(0, Math.min(100, (1.0 - concentrationRisk) * 100));
  }

  private double computeValueScore(Double scorePercentile30d) {
    if (scorePercentile30d == null) return 50.0;
    return Math.max(0, Math.min(100, (1.0 - scorePercentile30d) * 100));
  }

  private String gradeFor(int score) {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
  }

  public record ThemeQuality(int investmentQualityScore, String investmentQualityGrade) {}
}
