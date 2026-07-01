package com.ftm.app.themes.risk;

public interface ThemeRiskDimension {
  ThemeRiskLevel evaluate(ThemeRiskContext context);

  String dimensionName();
}
