package com.ftm.app.themes.snapshot;

import com.ftm.app.api.dto.ThemeSnapshotDto;
import com.ftm.app.api.service.ThemeService;
import org.springframework.stereotype.Service;

@Service
public class ThemeSnapshotService {

  private final ThemeService themeService;
  private final ThemeSnapshotAggregator aggregator;

  public ThemeSnapshotService(ThemeService themeService, ThemeSnapshotAggregator aggregator) {
    this.themeService = themeService;
    this.aggregator = aggregator;
  }

  public ThemeSnapshotDto getSnapshot() {
    return aggregator.aggregate(themeService.getThemes());
  }
}
