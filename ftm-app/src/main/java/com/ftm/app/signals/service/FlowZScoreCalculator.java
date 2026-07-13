package com.ftm.app.signals.service;

import com.ftm.app.signals.repository.PriceHistoryRepository.DatePrice;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * How unusual today's dollar volume is against the recent norm — our proxy for money flowing into a
 * category. Expressed as a z-score: +1 means a standard deviation above the period's average.
 */
@Component
public class FlowZScoreCalculator {

  private static final int SCALE = 6;

  /**
   * A near-flat volume series would divide by ~0 and blow the z-score up, so anything below a dollar
   * of deviation is reported as no flow at all.
   */
  private static final double MIN_MEANINGFUL_DEVIATION = 1.0;

  /** Null when the window has fewer than {@code period} usable days. */
  public BigDecimal computeDollarVolumeZScore(List<DatePrice> window, int period) {
    if (window.size() < period) return null;

    double[] dollarVolumes = dollarVolumesOf(window.subList(window.size() - period, window.size()));
    if (dollarVolumes.length < period) return null;

    double mean = Arrays.stream(dollarVolumes).average().orElse(0);
    double standardDeviation = Math.sqrt(varianceOf(dollarVolumes, mean));
    if (standardDeviation < MIN_MEANINGFUL_DEVIATION) return BigDecimal.ZERO;

    double latest = dollarVolumes[dollarVolumes.length - 1];
    return BigDecimal.valueOf((latest - mean) / standardDeviation)
        .setScale(SCALE, RoundingMode.HALF_UP);
  }

  private static double[] dollarVolumesOf(List<DatePrice> window) {
    return window.stream()
        .filter(day -> day.price() != null && day.volume() != null && day.volume() > 0)
        .mapToDouble(day -> day.price().doubleValue() * day.volume())
        .toArray();
  }

  private static double varianceOf(double[] values, double mean) {
    return Arrays.stream(values).map(value -> Math.pow(value - mean, 2)).average().orElse(0);
  }
}
