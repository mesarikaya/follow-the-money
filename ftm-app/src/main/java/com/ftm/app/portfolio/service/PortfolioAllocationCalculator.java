package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Portfolio;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Turns the holdings a user actually owns into the portfolio's category weights. The last category
 * absorbs the rounding remainder, so the weights always add up to exactly 100%.
 */
@Component
public class PortfolioAllocationCalculator {

  private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
  private static final BigDecimal FULL_ALLOCATION = new BigDecimal("100.00");
  private static final int PERCENT_SCALE = 2;

  /** Empty when nothing is classifiable or nothing has a value — there is then nothing to sync. */
  public List<Portfolio> computeAllocations(List<HoldingDto> holdings) {
    Map<String, BigDecimal> valueByCategory = valueByCategory(holdings);
    BigDecimal total = valueByCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    if (total.compareTo(BigDecimal.ZERO) == 0) return List.of();

    List<String> categoryIds = new ArrayList<>(valueByCategory.keySet());
    List<Portfolio> allocations = new ArrayList<>();
    BigDecimal allocated = BigDecimal.ZERO;

    for (int i = 0; i < categoryIds.size(); i++) {
      String categoryId = categoryIds.get(i);
      boolean isLast = i == categoryIds.size() - 1;
      BigDecimal percent =
          isLast
              ? FULL_ALLOCATION.subtract(allocated)
              : percentOf(valueByCategory.get(categoryId), total);
      if (!isLast) allocated = allocated.add(percent);
      allocations.add(new Portfolio(CategoryId.valueOf(categoryId), percent, null, null));
    }
    return allocations;
  }

  /** Market value in EUR per category, skipping holdings we cannot place or cannot value. */
  private static Map<String, BigDecimal> valueByCategory(List<HoldingDto> holdings) {
    Map<String, BigDecimal> valueByCategory = new LinkedHashMap<>();
    for (HoldingDto holding : holdings) {
      String categoryId = holding.categoryId();
      BigDecimal value = holding.marketValueEur();
      if (categoryId == null || !isKnownCategoryId(categoryId) || value == null) continue;
      valueByCategory.merge(categoryId, value, BigDecimal::add);
    }
    return valueByCategory;
  }

  private static BigDecimal percentOf(BigDecimal value, BigDecimal total) {
    return value.multiply(ONE_HUNDRED).divide(total, PERCENT_SCALE, RoundingMode.HALF_UP);
  }

  private static boolean isKnownCategoryId(String categoryId) {
    try {
      CategoryId.valueOf(categoryId);
      return true;
    } catch (IllegalArgumentException notACategory) {
      return false;
    }
  }
}
