package com.ftm.app.themes.momentum;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class MomentumDivergenceClassifierTest {

  private final MomentumDivergenceClassifier classifier = new MomentumDivergenceClassifier();

  @Nested
  class AlignedBullish {

    @Test
    @DisplayName("both trends positive → ALIGNED_BULLISH")
    void bothPositive() {
      assertThat(classifier.classify(0.008, 0.005))
          .hasValue(MomentumAlignment.ALIGNED_BULLISH);
    }

    @Test
    @DisplayName("both trends exactly at threshold → ALIGNED_BULLISH")
    void atThreshold() {
      assertThat(classifier.classify(0.003, 0.003))
          .hasValue(MomentumAlignment.ALIGNED_BULLISH);
    }
  }

  @Nested
  class Recovering {

    @Test
    @DisplayName("5d negative, 20d positive → RECOVERING (healthy pullback)")
    void shortTermDipInLongTermUptrend() {
      assertThat(classifier.classify(-0.005, 0.006))
          .hasValue(MomentumAlignment.RECOVERING);
    }
  }

  @Nested
  class Fading {

    @Test
    @DisplayName("5d positive, 20d negative → FADING (short bounce in downtrend)")
    void shortBounceinDowntrend() {
      assertThat(classifier.classify(0.006, -0.004))
          .hasValue(MomentumAlignment.FADING);
    }
  }

  @Nested
  class AlignedBearish {

    @Test
    @DisplayName("both trends negative → ALIGNED_BEARISH")
    void bothNegative() {
      assertThat(classifier.classify(-0.007, -0.005))
          .hasValue(MomentumAlignment.ALIGNED_BEARISH);
    }
  }

  @Nested
  class Neutral {

    @Test
    @DisplayName("5d below threshold, 20d positive → NEUTRAL")
    void shortTermFlat() {
      assertThat(classifier.classify(0.001, 0.006))
          .hasValue(MomentumAlignment.NEUTRAL);
    }

    @Test
    @DisplayName("5d positive, 20d below threshold → NEUTRAL")
    void longTermFlat() {
      assertThat(classifier.classify(0.006, 0.001))
          .hasValue(MomentumAlignment.NEUTRAL);
    }

    @Test
    @DisplayName("both near zero → NEUTRAL")
    void bothFlat() {
      assertThat(classifier.classify(0.001, -0.001))
          .hasValue(MomentumAlignment.NEUTRAL);
    }
  }

  @Nested
  class InsufficientData {

    @Test
    @DisplayName("null trend5d → empty")
    void nullTrend5d() {
      assertThat(classifier.classify(null, 0.006)).isEmpty();
    }

    @Test
    @DisplayName("null trend20d → empty")
    void nullTrend20d() {
      assertThat(classifier.classify(0.006, null)).isEmpty();
    }

    @Test
    @DisplayName("both null → empty")
    void bothNull() {
      assertThat(classifier.classify(null, null)).isEmpty();
    }
  }
}
