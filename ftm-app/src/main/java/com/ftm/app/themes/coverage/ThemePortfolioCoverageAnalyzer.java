package com.ftm.app.themes.coverage;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.ThemePortfolioCoverageDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ThemePortfolioCoverageAnalyzer {

  public List<ThemePortfolioCoverageDto> analyze(
      List<ThemeSummaryDto> themes,
      Map<String, List<String>> constituentsByTheme,
      List<HoldingDto> holdings,
      BigDecimal totalPortfolioEur) {

    Map<String, HoldingDto> holdingByCategoryId =
        holdings.stream()
            .filter(h -> h.categoryId() != null)
            .collect(Collectors.toMap(HoldingDto::categoryId, h -> h, (a, b) -> a));

    boolean hasTotalValue =
        totalPortfolioEur != null && totalPortfolioEur.compareTo(BigDecimal.ZERO) > 0;

    List<ThemePortfolioCoverageDto> result = new ArrayList<>();
    for (ThemeSummaryDto theme : themes) {
      List<String> constituentIds =
          constituentsByTheme.getOrDefault(theme.id(), List.of());
      Set<String> constituentSet = Set.copyOf(constituentIds);

      List<HoldingDto> matchingHoldings =
          holdings.stream()
              .filter(
                  h -> h.categoryId() != null && constituentSet.contains(h.categoryId()))
              .toList();

      List<String> coveringTickers =
          matchingHoldings.stream().map(HoldingDto::ticker).toList();

      double exposurePct = 0.0;
      if (hasTotalValue && !matchingHoldings.isEmpty()) {
        BigDecimal coveringValue =
            matchingHoldings.stream()
                .map(HoldingDto::marketValueEur)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (coveringValue.compareTo(BigDecimal.ZERO) > 0) {
          exposurePct =
              coveringValue
                  .multiply(BigDecimal.valueOf(100))
                  .divide(totalPortfolioEur, 2, java.math.RoundingMode.HALF_UP)
                  .doubleValue();
        }
      }

      result.add(
          new ThemePortfolioCoverageDto(
              theme.id(),
              theme.name(),
              theme.dominantSignal(),
              theme.themePhase(),
              theme.compositeScore() != null ? theme.compositeScore() : 0.0,
              !coveringTickers.isEmpty(),
              coveringTickers,
              exposurePct));
    }
    return result;
  }
}
