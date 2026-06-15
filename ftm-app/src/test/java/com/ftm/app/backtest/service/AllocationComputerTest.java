package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AllocationComputerTest {

  AllocationComputer computer;

  @BeforeEach
  void setUp() {
    computer = new AllocationComputer();
  }

  @Test
  @DisplayName("excludes categories with no price data even when their signal score is highest")
  void shouldExcludeCategoriesWithNoPriceData() {
    LocalDate date = LocalDate.of(2023, 1, 2);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(date, Map.of("HIGH_NO_DATA", new BigDecimal("0.95"), "LOW_WITH_DATA", new BigDecimal("0.60")));
    Set<String> withPriceData = Set.of("LOW_WITH_DATA");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(date), composites, 2, null, withPriceData);

    assertThat(result.get(date)).containsExactly("LOW_WITH_DATA");
    assertThat(result.get(date)).doesNotContain("HIGH_NO_DATA");
  }

  @Test
  @DisplayName("selects top-N categories by descending composite score")
  void shouldSelectTopNByScore() {
    LocalDate date = LocalDate.of(2023, 1, 2);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(date, Map.of("TECH", new BigDecimal("0.90"), "FINL", new BigDecimal("0.70"), "HLTH", new BigDecimal("0.80")));
    Set<String> withPriceData = Set.of("TECH", "FINL", "HLTH");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(date), composites, 2, null, withPriceData);

    assertThat(result.get(date)).containsExactly("TECH", "HLTH");
  }

  @Test
  @DisplayName("applies signal threshold to exclude low-scoring categories")
  void shouldApplySignalThreshold() {
    LocalDate date = LocalDate.of(2023, 1, 2);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(date, Map.of("TECH", new BigDecimal("0.90"), "FINL", new BigDecimal("0.40"), "HLTH", new BigDecimal("0.80")));
    Set<String> withPriceData = Set.of("TECH", "FINL", "HLTH");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(date), composites, 3, new BigDecimal("0.50"), withPriceData);

    assertThat(result.get(date)).containsExactlyInAnyOrder("TECH", "HLTH");
    assertThat(result.get(date)).doesNotContain("FINL");
  }

  @Test
  @DisplayName("reuses last allocation when no composites are found for a rebalance date")
  void shouldReuseLastAllocationWhenNoCompositesFound() {
    LocalDate date1 = LocalDate.of(2023, 1, 2);
    LocalDate date2 = LocalDate.of(2023, 2, 1);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(date1, Map.of("TECH", new BigDecimal("0.90")));
    Set<String> withPriceData = Set.of("TECH");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(date1, date2), composites, 2, null, withPriceData);

    assertThat(result.get(date1)).containsExactly("TECH");
    assertThat(result.get(date2)).containsExactly("TECH");
  }

  @Test
  @DisplayName("returns empty allocation when no categories have price data and there is no prior allocation")
  void shouldReturnEmptyWhenNoCategoriesHavePriceData() {
    LocalDate date = LocalDate.of(2023, 1, 2);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(date, Map.of("NO_DATA", new BigDecimal("0.95")));
    Set<String> withPriceData = Set.of();

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(date), composites, 2, null, withPriceData);

    assertThat(result.get(date)).isEmpty();
  }

  @Test
  @DisplayName("uses closest past composites when rebalance date has no exact match")
  void shouldUseClosestPastCompositesForRebalanceDate() {
    LocalDate signalDate = LocalDate.of(2023, 1, 30);
    LocalDate rebalanceDate = LocalDate.of(2023, 2, 1);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(signalDate, Map.of("TECH", new BigDecimal("0.90")));
    Set<String> withPriceData = Set.of("TECH");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(rebalanceDate), composites, 2, null, withPriceData);

    assertThat(result.get(rebalanceDate)).containsExactly("TECH");
  }

  @Test
  @DisplayName("ignores future composites that are after the rebalance date")
  void shouldIgnoreFutureComposites() {
    LocalDate rebalanceDate = LocalDate.of(2023, 1, 2);
    LocalDate futureDate = LocalDate.of(2023, 3, 1);
    Map<LocalDate, Map<String, BigDecimal>> composites =
        Map.of(futureDate, Map.of("TECH", new BigDecimal("0.90")));
    Set<String> withPriceData = Set.of("TECH");

    Map<LocalDate, List<String>> result =
        computer.computeAllocations(List.of(rebalanceDate), composites, 2, null, withPriceData);

    assertThat(result.get(rebalanceDate)).isEmpty();
  }
}
