package com.ftm.app.themes.signal;

import com.ftm.app.api.dto.ThemeConstituentDto;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Computes concentration risk as the fraction of constituents in the dominant parent sector.
 * A value of 1.0 means all constituents share a single parent sector (maximum concentration).
 */
@Component
public class ThemeConcentrationRiskCalculator {

  public Double calculate(List<ThemeConstituentDto> constituents) {
    if (constituents.isEmpty()) return null;
    Map<String, Long> countByParent =
        constituents.stream()
            .collect(
                Collectors.groupingBy(
                    c -> c.parentCategoryId() != null ? c.parentCategoryId() : c.categoryId(),
                    Collectors.counting()));
    long maxCount = countByParent.values().stream().mapToLong(Long::longValue).max().orElse(0);
    return (double) maxCount / constituents.size();
  }
}
