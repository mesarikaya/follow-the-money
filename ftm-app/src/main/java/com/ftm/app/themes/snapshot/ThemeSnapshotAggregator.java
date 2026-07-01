package com.ftm.app.themes.snapshot;

import com.ftm.app.api.dto.ThemeSnapshotDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ThemeSnapshotAggregator {

  public ThemeSnapshotDto aggregate(List<ThemeSummaryDto> themes) {
    if (themes.isEmpty()) {
      return new ThemeSnapshotDto(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, 0, 0);
    }

    int buyCount = 0, watchCount = 0, holdCount = 0, reduceCount = 0;
    int breakoutCount = 0, momentumCount = 0, buildingCount = 0, fadingCount = 0, weakCount = 0;
    double totalScore = 0.0;
    int gainingMomentumCount = 0, losingMomentumCount = 0;

    for (ThemeSummaryDto theme : themes) {
      switch (nullSafe(theme.dominantSignal())) {
        case "BUY" -> buyCount++;
        case "WATCH" -> watchCount++;
        case "HOLD" -> holdCount++;
        case "REDUCE" -> reduceCount++;
      }
      switch (nullSafe(theme.themePhase())) {
        case "BREAKOUT" -> breakoutCount++;
        case "MOMENTUM" -> momentumCount++;
        case "BUILDING" -> buildingCount++;
        case "FADING" -> fadingCount++;
        case "WEAK" -> weakCount++;
      }
      if (theme.compositeScore() != null) {
        totalScore += theme.compositeScore();
      }
      Double trend = theme.compositeTrend5d();
      if (trend != null) {
        if (trend > 0) gainingMomentumCount++;
        else if (trend < 0) losingMomentumCount++;
      }
    }

    double averageCompositeScore = totalScore / themes.size();
    return new ThemeSnapshotDto(
        themes.size(),
        buyCount,
        watchCount,
        holdCount,
        reduceCount,
        breakoutCount,
        momentumCount,
        buildingCount,
        fadingCount,
        weakCount,
        averageCompositeScore,
        gainingMomentumCount,
        losingMomentumCount);
  }

  private static String nullSafe(String value) {
    return value != null ? value : "";
  }
}
