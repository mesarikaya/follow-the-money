package com.ftm.app.themes.correlation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PearsonCorrelationTest {

  @Test
  @DisplayName("identical series returns 1.0")
  void identicalSeriesReturnsOne() {
    double[] x = {0.01, 0.02, -0.01, 0.03, -0.02};
    assertThat(PearsonCorrelation.compute(x, x.clone())).isCloseTo(1.0, within(1e-9));
  }

  @Test
  @DisplayName("perfectly inverse series returns -1.0")
  void inverseSeriesReturnsNegativeOne() {
    double[] x = {0.01, 0.02, -0.01, 0.03};
    double[] negX = {-0.01, -0.02, 0.01, -0.03};
    assertThat(PearsonCorrelation.compute(x, negX)).isCloseTo(-1.0, within(1e-9));
  }

  @Test
  @DisplayName("uncorrelated series returns value near 0")
  void uncorrelatedSeriesReturnsNearZero() {
    double[] x = {1, -1, 1, -1, 1};
    double[] y = {0, 0, 0, 0, 0};
    assertThat(PearsonCorrelation.compute(x, y)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("constant series (zero variance) returns 0.0 not NaN")
  void constantSeriesReturnsZero() {
    double[] x = {0.5, 0.5, 0.5};
    double[] y = {0.1, 0.2, 0.3};
    assertThat(PearsonCorrelation.compute(x, y)).isEqualTo(0.0);
    assertThat(PearsonCorrelation.compute(x, x.clone())).isEqualTo(0.0);
  }

  @Test
  @DisplayName("series shorter than 2 returns 0.0")
  void tooShortReturnsZero() {
    assertThat(PearsonCorrelation.compute(new double[]{0.5}, new double[]{0.5})).isEqualTo(0.0);
    assertThat(PearsonCorrelation.compute(new double[0], new double[0])).isEqualTo(0.0);
  }

  @Test
  @DisplayName("known values produce correct correlation")
  void knownValuesProduceCorrectCorrelation() {
    double[] x = {1, 2, 3, 4, 5};
    double[] y = {2, 4, 5, 4, 5};
    // Precomputed: r = 6/√60 ≈ 0.7746
    assertThat(PearsonCorrelation.compute(x, y)).isCloseTo(0.7746, within(0.001));
  }
}
