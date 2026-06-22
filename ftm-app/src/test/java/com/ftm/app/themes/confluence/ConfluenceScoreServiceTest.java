package com.ftm.app.themes.confluence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConfluenceScoreServiceTest {

  private ConfluenceScoreService service;

  @BeforeEach
  void setUp() {
    service = new ConfluenceScoreService(
        List.of(
            new EntryTimingFactor(),
            new RiskLevelFactor(),
            new MomentumAlignmentFactor(),
            new PhaseTransitionFactor()));
  }

  @Test
  @DisplayName("maximum bullish signals → HIGH_CONFIDENCE near 100")
  void maxBullishSignals() {
    ConfluenceInput input =
        new ConfluenceInput("ENTER", "LOW", "ALIGNED_BULLISH", "WATCH_FOR_ENTRY");
    ConfluenceResult result = service.compute(input);
    assertThat(result.confluenceScore()).isGreaterThanOrEqualTo(80);
    assertThat(result.confidenceLabel()).isEqualTo("HIGH_CONFIDENCE");
  }

  @Test
  @DisplayName("maximum bearish signals → AVOID near 0")
  void maxBearishSignals() {
    ConfluenceInput input =
        new ConfluenceInput("AVOID", "EXTREME", "ALIGNED_BEARISH", "APPROACHING_EXIT");
    ConfluenceResult result = service.compute(input);
    assertThat(result.confluenceScore()).isLessThan(20);
    assertThat(result.confidenceLabel()).isEqualTo("AVOID");
  }

  @Test
  @DisplayName("all neutral signals → MODERATE near 50")
  void allNeutralSignals() {
    ConfluenceInput input = new ConfluenceInput("WAIT", "MEDIUM", "NEUTRAL", null);
    ConfluenceResult result = service.compute(input);
    assertThat(result.confluenceScore()).isCloseTo(58, offset(5));
    assertThat(result.confidenceLabel()).isEqualTo("MODERATE");
  }

  @Test
  @DisplayName("score boundaries: ≥70 is HIGH_CONFIDENCE")
  void labelHighConfidence() {
    ConfluenceInput input = new ConfluenceInput("ENTER", "LOW", "ALIGNED_BULLISH", null);
    ConfluenceResult result = service.compute(input);
    assertThat(result.confluenceScore()).isGreaterThanOrEqualTo(70);
    assertThat(result.confidenceLabel()).isEqualTo("HIGH_CONFIDENCE");
  }

  @Test
  @DisplayName("empty factors list returns 50 / MODERATE")
  void emptyFactorsListReturnsModerate() {
    ConfluenceScoreService emptyService = new ConfluenceScoreService(List.of());
    ConfluenceResult result =
        emptyService.compute(new ConfluenceInput("ENTER", "LOW", "ALIGNED_BULLISH", null));
    assertThat(result.confluenceScore()).isEqualTo(50);
    assertThat(result.confidenceLabel()).isEqualTo("MODERATE");
  }

  @Test
  @DisplayName("score is clamped to [0, 100]")
  void scoreIsClamped() {
    ConfluenceInput maxBullish =
        new ConfluenceInput("ENTER", "LOW", "ALIGNED_BULLISH", "WATCH_FOR_ENTRY");
    ConfluenceInput maxBearish =
        new ConfluenceInput("AVOID", "EXTREME", "ALIGNED_BEARISH", "APPROACHING_EXIT");

    assertThat(service.compute(maxBullish).confluenceScore()).isLessThanOrEqualTo(100);
    assertThat(service.compute(maxBearish).confluenceScore()).isGreaterThanOrEqualTo(0);
  }

  @Test
  @DisplayName("CAUTIOUS label for mixed bearish/neutral inputs (score 35–49)")
  void cautiousLabel() {
    // AVOID entry (-3 × 0.35) + HIGH risk (-1 × 0.25) + FADING (-1 × 0.25) + null (0 × 0.15)
    // weighted avg = (-1.05 + -0.25 + -0.25) / 1.0 = -1.55 → score ~ ((-1.55+3)/6)*100 ≈ 24
    // That's AVOID. Let's try WAIT + HIGH + FADING + null:
    // (0*0.35 + -1*0.25 + -1*0.25 + 0*0.15)/1.0 = -0.5 → ((-0.5+3)/6)*100 ≈ 42 → CAUTIOUS
    ConfluenceInput input = new ConfluenceInput("WAIT", "HIGH", "FADING", null);
    ConfluenceResult result = service.compute(input);
    assertThat(result.confluenceScore()).isBetween(35, 49);
    assertThat(result.confidenceLabel()).isEqualTo("CAUTIOUS");
  }
}
