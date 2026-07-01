package com.ftm.app.themes.correlation;

/**
 * Computes Pearson correlation between two double arrays.
 * Returns 0.0 when either series has zero variance (constant series).
 */
public final class PearsonCorrelation {

  private PearsonCorrelation() {}

  public static double compute(double[] x, double[] y) {
    if (x.length != y.length || x.length < 2) return 0.0;
    int n = x.length;
    double sumX = 0, sumY = 0;
    for (int i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
    }
    double meanX = sumX / n;
    double meanY = sumY / n;
    double numerator = 0, denomX = 0, denomY = 0;
    for (int i = 0; i < n; i++) {
      double dx = x[i] - meanX;
      double dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    double denom = Math.sqrt(denomX * denomY);
    return denom == 0.0 ? 0.0 : numerator / denom;
  }
}
