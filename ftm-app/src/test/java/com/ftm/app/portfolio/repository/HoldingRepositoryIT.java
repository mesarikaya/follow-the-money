package com.ftm.app.portfolio.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.domain.Holding;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class HoldingRepositoryIT {

  @Autowired HoldingRepository repository;
  @Autowired JdbcTemplate jdbcTemplate;

  @BeforeEach
  void cleanTable() {
    jdbcTemplate.execute("TRUNCATE holdings CASCADE");
  }

  private Holding usdHolding(String ticker, String categoryId) {
    return new Holding(
        null,
        ticker,
        ticker + " Fund",
        categoryId,
        "USD",
        new BigDecimal("10.0"),
        new BigDecimal("100.00"),
        null,
        null,
        null,
        null,
        null);
  }

  private Holding eurHolding(String ticker, String categoryId) {
    return new Holding(
        null,
        ticker,
        ticker + " AG",
        categoryId,
        "EUR",
        new BigDecimal("5.0"),
        new BigDecimal("1200.00"),
        new BigDecimal("1.085"),
        null,
        null,
        null,
        null);
  }

  @Test
  @DisplayName("replaceAll stores holdings and findAll returns them ordered")
  void shouldPersistAndReturnHoldings() {
    repository.replaceAll(List.of(usdHolding("GLD", "GOLD"), usdHolding("XLK", "TECH")));

    List<Holding> holdings = repository.findAll();
    assertThat(holdings).hasSize(2);
    assertThat(holdings).extracting(Holding::ticker).containsExactlyInAnyOrder("GLD", "XLK");
  }

  @Test
  @DisplayName("replaceAll removes existing holdings before inserting new ones")
  void shouldReplaceExistingHoldings() {
    repository.replaceAll(List.of(usdHolding("XLK", "TECH")));
    repository.replaceAll(List.of(usdHolding("GLD", "GOLD")));

    List<Holding> holdings = repository.findAll();
    assertThat(holdings).hasSize(1);
    assertThat(holdings.get(0).ticker()).isEqualTo("GLD");
  }

  @Test
  @DisplayName("replaceAll with empty list clears all holdings")
  void shouldClearHoldingsWhenEmptyList() {
    repository.replaceAll(List.of(usdHolding("XLK", "TECH")));
    repository.replaceAll(List.of());

    assertThat(repository.findAll()).isEmpty();
  }

  @Test
  @DisplayName("updateByTicker updates quantity and avgCostLocal")
  void shouldUpdateQuantityAndAvgCost() {
    repository.replaceAll(List.of(usdHolding("XLK", "TECH")));

    int updated =
        repository.updateByTicker("XLK", new BigDecimal("20.0"), new BigDecimal("210.00"));

    assertThat(updated).isEqualTo(1);
    Holding holding = repository.findAll().get(0);
    assertThat(holding.quantity()).isEqualByComparingTo("20.0");
    assertThat(holding.avgCostLocal()).isEqualByComparingTo("210.00");
  }

  @Test
  @DisplayName("updateByTicker returns 0 for unknown ticker")
  void shouldReturnZeroForUnknownTicker() {
    int updated = repository.updateByTicker("NOTEXIST", new BigDecimal("5.0"), null);

    assertThat(updated).isZero();
  }

  @Test
  @DisplayName("findAll orders by category_id ascending then ticker ascending")
  void shouldReturnHoldingsOrdered() {
    repository.replaceAll(
        List.of(usdHolding("XLK", "TECH"), usdHolding("GLD", "GOLD"), usdHolding("TLT", "TLTD")));

    List<Holding> holdings = repository.findAll();
    List<String> categoryIds = holdings.stream().map(Holding::categoryId).toList();
    assertThat(categoryIds).isSortedAccordingTo(String::compareTo);
  }

  @Test
  @DisplayName("EUR holding persists usdFxRate")
  void shouldPersistFxRate() {
    repository.replaceAll(List.of(eurHolding("RHM", "INDU")));

    Holding holding = repository.findAll().get(0);
    assertThat(holding.currency()).isEqualTo("EUR");
    assertThat(holding.usdFxRate()).isEqualByComparingTo("1.085");
  }
}
