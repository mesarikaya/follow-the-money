package com.ftm.app.themes.momentum;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class MomentumDivergenceClassifier {

  private static final double NEAR_ZERO_THRESHOLD = 0.003;

  public Optional<MomentumAlignment> classify(Double trend5d, Double trend20d) {
    if (trend5d == null || trend20d == null) return Optional.empty();
    boolean shortTermBullish = trend5d >= NEAR_ZERO_THRESHOLD;
    boolean shortTermBearish = trend5d <= -NEAR_ZERO_THRESHOLD;
    boolean longTermBullish = trend20d >= NEAR_ZERO_THRESHOLD;
    boolean longTermBearish = trend20d <= -NEAR_ZERO_THRESHOLD;

    if (shortTermBullish && longTermBullish) return Optional.of(MomentumAlignment.ALIGNED_BULLISH);
    if (shortTermBearish && longTermBullish) return Optional.of(MomentumAlignment.RECOVERING);
    if (shortTermBullish && longTermBearish) return Optional.of(MomentumAlignment.FADING);
    if (shortTermBearish && longTermBearish) return Optional.of(MomentumAlignment.ALIGNED_BEARISH);
    return Optional.of(MomentumAlignment.NEUTRAL);
  }
}
