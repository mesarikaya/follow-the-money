package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CategoryHierarchyResolverTest {

  private final CategoryHierarchyResolver resolver = new CategoryHierarchyResolver();

  // INDU_ADEF -> INDU, SEMI/SOFT -> TECH, HLTH_PHAR -> HLTH; top-levels map to null.
  private Map<String, String> hierarchy() {
    Map<String, String> parents = new HashMap<>();
    parents.put("INDU", null);
    parents.put("TECH", null);
    parents.put("HLTH", null);
    parents.put("CASH", null);
    parents.put("INDU_ADEF", "INDU");
    parents.put("SEMI", "TECH");
    parents.put("SOFT", "TECH");
    parents.put("HLTH_PHAR", "HLTH");
    return parents;
  }

  @Test
  @DisplayName("a sub-category resolves to its parent sector")
  void subCategoryResolvesToParent() {
    assertThat(resolver.topLevelAncestorId("INDU_ADEF", hierarchy())).isEqualTo("INDU");
    assertThat(resolver.topLevelAncestorId("SEMI", hierarchy())).isEqualTo("TECH");
  }

  @Test
  @DisplayName("a top-level category resolves to itself")
  void topLevelResolvesToItself() {
    assertThat(resolver.topLevelAncestorId("INDU", hierarchy())).isEqualTo("INDU");
    assertThat(resolver.topLevelAncestorId("CASH", hierarchy())).isEqualTo("CASH");
  }

  @Test
  @DisplayName("an unknown category resolves to itself")
  void unknownResolvesToItself() {
    assertThat(resolver.topLevelAncestorId("MYSTERY", hierarchy())).isEqualTo("MYSTERY");
  }

  @Test
  @DisplayName("a cyclic parent reference terminates instead of looping forever")
  void cyclicReferenceTerminates() {
    Map<String, String> cyclic = new HashMap<>();
    cyclic.put("A", "B");
    cyclic.put("B", "A");
    // Should stop once it revisits a node rather than hang.
    assertThat(resolver.topLevelAncestorId("A", cyclic)).isIn("A", "B");
  }

  @Test
  @DisplayName("rollUp sums sub-category values into their parent sector")
  void rollUpSumsIntoParent() {
    Map<String, BigDecimal> raw = new HashMap<>();
    raw.put("CASH", new BigDecimal("46.82"));
    raw.put("INDU_ADEF", new BigDecimal("19.02"));
    raw.put("HLTH_PHAR", new BigDecimal("11.55"));
    raw.put("SEMI", new BigDecimal("4.03"));
    raw.put("SOFT", new BigDecimal("0.35"));
    raw.put("TECH", new BigDecimal("4.34"));

    Map<String, BigDecimal> rolled = resolver.rollUpToTopLevel(raw, hierarchy());

    assertThat(rolled.get("CASH").doubleValue()).isCloseTo(46.82, within(1e-9));
    assertThat(rolled.get("INDU").doubleValue()).isCloseTo(19.02, within(1e-9));
    assertThat(rolled.get("HLTH").doubleValue()).isCloseTo(11.55, within(1e-9));
    // SEMI + SOFT + TECH all collapse into TECH: 4.03 + 0.35 + 4.34 = 8.72
    assertThat(rolled.get("TECH").doubleValue()).isCloseTo(8.72, within(1e-9));
    // Total is preserved (nothing dropped).
    double total = rolled.values().stream().mapToDouble(BigDecimal::doubleValue).sum();
    assertThat(total).isCloseTo(86.11, within(1e-9));
  }
}
