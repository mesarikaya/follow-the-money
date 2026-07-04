package com.ftm.app.portfolio.service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Resolves a category to its top-level (parentless) ancestor and rolls per-category values up that
 * hierarchy. A holding tagged with a sub-category such as {@code INDU_ADEF} or {@code SEMI} must
 * contribute its value to the parent sector ({@code INDU}, {@code TECH}) so sector allocations sum
 * to 100% instead of silently dropping sub-category positions.
 *
 * <p>Pure and stateless: the hierarchy is passed in as a {@code categoryId -> parentId} map, so
 * this has no repository dependency and is trivially unit-testable.
 */
@Component
public class CategoryHierarchyResolver {

  /**
   * Walks parent links until it reaches a category with no parent. Returns the category itself when
   * it is already top-level or unknown. Guards against cyclic parent references.
   */
  public String topLevelAncestorId(String categoryId, Map<String, String> parentByCategoryId) {
    String current = categoryId;
    Set<String> visited = new HashSet<>();
    String parent = parentByCategoryId.get(current);
    while (parent != null && visited.add(current)) {
      current = parent;
      parent = parentByCategoryId.get(current);
    }
    return current;
  }

  /**
   * Sums each entry's value into its top-level ancestor bucket. Sub-category allocations therefore
   * accumulate into their parent sector; top-level entries pass through unchanged.
   */
  public Map<String, BigDecimal> rollUpToTopLevel(
      Map<String, BigDecimal> valueByCategoryId, Map<String, String> parentByCategoryId) {
    Map<String, BigDecimal> rolledUp = new HashMap<>();
    valueByCategoryId.forEach(
        (categoryId, value) ->
            rolledUp.merge(
                topLevelAncestorId(categoryId, parentByCategoryId), value, BigDecimal::add));
    return rolledUp;
  }
}
