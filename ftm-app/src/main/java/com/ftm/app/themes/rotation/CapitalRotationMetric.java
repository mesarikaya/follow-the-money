package com.ftm.app.themes.rotation;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;

public interface CapitalRotationMetric {
  double compute(List<ThemeSummaryDto> themes);

  String metricName();

  double weight();
}
