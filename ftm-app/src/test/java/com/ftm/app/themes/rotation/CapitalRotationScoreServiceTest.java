package com.ftm.app.themes.rotation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CapitalRotationScoreServiceTest {

  private CapitalRotationScoreService service;

  @BeforeEach
  void setUp() {
    service = new CapitalRotationScoreService(
        List.of(new ScoreDispersionMetric(), new TrendAlignmentMetric()));
  }

  private ThemeSummaryDto theme(String id, String name, Double score, Double trend20d) {
    return new ThemeSummaryDto(
        id, name, "Thesis", 3, score, null, null, null, trend20d,
        0, "BUY", null, "MOMENTUM", List.of(), 0, 0, 0, null, null, null,
        null, "MEDIUM", null, null, null, 50, "MODERATE", 0, "F", 0, "F");
  }

  @Test
  @DisplayName("empty theme list returns CONSOLIDATING with zero scores")
  void emptyListReturnsConsolidating() {
    CapitalRotationResult result = service.compute(List.of());
    assertThat(result.rotationScore()).isCloseTo(0.0, offset(0.001));
    assertThat(result.intensityLabel()).isEqualTo("CONSOLIDATING");
    assertThat(result.leadingThemeNames()).isEmpty();
    assertThat(result.laggingThemeNames()).isEmpty();
  }

  @Test
  @DisplayName("high dispersion + perfect alignment → STRONG rotation")
  void strongRotation() {
    List<ThemeSummaryDto> themes = List.of(
        theme("A", "AI Infrastructure",    0.90, 0.015),
        theme("B", "Clean Energy",          0.75, 0.010),
        theme("C", "Traditional Energy",   0.25, -0.010),
        theme("D", "Real Estate",          0.10, -0.015)
    );
    CapitalRotationResult result = service.compute(themes);
    assertThat(result.rotationScore()).isGreaterThan(0.70);
    assertThat(result.intensityLabel()).isEqualTo("STRONG");
    assertThat(result.leadingThemeNames()).contains("AI Infrastructure");
    assertThat(result.laggingThemeNames()).contains("Real Estate");
  }

  @Test
  @DisplayName("flat, tightly clustered scores → CONSOLIDATING rotation")
  void consolidating() {
    List<ThemeSummaryDto> themes = List.of(
        theme("A", "Theme A", 0.55, 0.001),
        theme("B", "Theme B", 0.57, 0.001),
        theme("C", "Theme C", 0.53, -0.001),
        theme("D", "Theme D", 0.56, 0.001)
    );
    CapitalRotationResult result = service.compute(themes);
    assertThat(result.rotationScore()).isLessThan(0.25);
    assertThat(result.intensityLabel()).isEqualTo("CONSOLIDATING");
  }

  @Test
  @DisplayName("leading themes are top-3 by composite score")
  void leadingThemesTopThreeByScore() {
    List<ThemeSummaryDto> themes = List.of(
        theme("A", "First",  0.90, 0.01),
        theme("B", "Second", 0.80, 0.01),
        theme("C", "Third",  0.70, 0.01),
        theme("D", "Fourth", 0.30, -0.01)
    );
    CapitalRotationResult result = service.compute(themes);
    assertThat(result.leadingThemeNames()).containsExactly("First", "Second", "Third");
  }

  @Test
  @DisplayName("lagging themes are bottom-3 by composite score")
  void laggingThemesBottomThreeByScore() {
    List<ThemeSummaryDto> themes = List.of(
        theme("A", "First",  0.90, 0.01),
        theme("B", "Last",   0.10, -0.01),
        theme("C", "Second Last", 0.20, -0.01),
        theme("D", "Third Last",  0.30, -0.01)
    );
    CapitalRotationResult result = service.compute(themes);
    assertThat(result.laggingThemeNames()).containsExactly("Last", "Second Last", "Third Last");
  }

  @Test
  @DisplayName("weighted score is dispersion*0.6 + alignment*0.4")
  void weightedScoreFormula() {
    // Perfect alignment (1.0) + high dispersion (1.0) → score = 1.0
    List<ThemeSummaryDto> themes = List.of(
        theme("A", "High A", 0.90, 0.015),
        theme("B", "High B", 0.80, 0.010),
        theme("C", "Low C",  0.10, -0.010),
        theme("D", "Low D",  0.05, -0.015)
    );
    CapitalRotationResult result = service.compute(themes);
    assertThat(result.rotationScore()).isCloseTo(1.0, offset(0.05));
  }
}
