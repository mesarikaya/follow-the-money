package com.ftm.app.themes.confluence;

public interface ConfluenceFactor {
  String factorName();

  double weight();

  /**
   * Returns a raw score in [-3, +3]. Positive = bullish conviction; negative = bearish conviction.
   */
  int score(ConfluenceInput input);
}
