package com.ftm.app.signals.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.SignalRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@RecordApplicationEvents
class SignalComputationServiceIT {

  @Autowired SignalComputationService service;
  @Autowired SignalRepository signalRepository;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired ApplicationEvents applicationEvents;

  private static final LocalDate SIGNAL_DATE = LocalDate.of(2024, 6, 28);

  @BeforeEach
  void clean() {
    jdbcTemplate.execute("TRUNCATE signals CASCADE");
    jdbcTemplate.execute("DELETE FROM raw_prices");
    jdbcTemplate.execute("DELETE FROM benchmark_prices");
  }

  @Test
  @DisplayName(
      "computeAndStore backfills all dates and writes all 9 signal types for the latest date when data is sufficient")
  void shouldComputeAllSignalTypesWhenDataSufficient() {
    insertCategoryPrices("TECH", SIGNAL_DATE, 130);
    insertBenchmarkPrices("SPY", SIGNAL_DATE, 130);

    service.computeAndStore();

    List<SignalRepository.HistoryRow> allSignals = signalRepository.findByCategoryId("TECH");

    // Latest date must have all 9 expected signal types
    List<SignalRepository.HistoryRow> latestDateSignals =
        allSignals.stream().filter(row -> row.signalDate().equals(SIGNAL_DATE)).toList();
    assertThat(latestDateSignals)
        .extracting(SignalRepository.HistoryRow::signalType)
        .containsExactlyInAnyOrder(
            SignalType.RS_20,
            SignalType.RS_60,
            SignalType.RS_120,
            SignalType.MOM,
            SignalType.RRG_RATIO,
            SignalType.RRG_MOM,
            SignalType.RRG_QUADRANT,
            SignalType.MACRO_REGIME,
            SignalType.COMPOSITE);

    // Backfill must have computed signals for multiple dates (not just the latest)
    Set<LocalDate> signalDates =
        allSignals.stream()
            .map(SignalRepository.HistoryRow::signalDate)
            .collect(Collectors.toSet());
    assertThat(signalDates).hasSizeGreaterThan(1);
  }

  @Test
  @DisplayName(
      "computeAndStore omits signals requiring more data than available, but always writes MACRO_REGIME for the latest date")
  void shouldOmitSignalTypesWithInsufficientData() {
    // 25 prices: enough for RS_20 (needs 21) but not RS_60/RS_120/RRG; MACRO_REGIME always written
    insertCategoryPrices("TECH", SIGNAL_DATE, 25);
    insertBenchmarkPrices("SPY", SIGNAL_DATE, 25);

    service.computeAndStore();

    List<SignalRepository.HistoryRow> allSignals = signalRepository.findByCategoryId("TECH");

    // Latest date must have only the signal types possible with 25 prices
    List<SignalRepository.HistoryRow> latestDateSignals =
        allSignals.stream().filter(row -> row.signalDate().equals(SIGNAL_DATE)).toList();
    assertThat(latestDateSignals)
        .extracting(SignalRepository.HistoryRow::signalType)
        .containsExactlyInAnyOrder(SignalType.RS_20, SignalType.MACRO_REGIME);
  }

  @Test
  @DisplayName("computeAndStore does nothing and publishes no event when raw_prices is empty")
  void shouldSkipComputationAndNotPublishEventWhenNoPriceData() {
    service.computeAndStore();

    assertThat(signalRepository.findByCategoryId("TECH")).isEmpty();
    assertThat(applicationEvents.stream(SignalsUpdatedEvent.class)).isEmpty();
  }

  @Test
  @DisplayName("computeAndStore publishes SignalsUpdatedEvent with the date of the latest price")
  void shouldPublishSignalsUpdatedEventWithSignalDate() {
    insertCategoryPrices("TECH", SIGNAL_DATE, 130);
    insertBenchmarkPrices("SPY", SIGNAL_DATE, 130);

    service.computeAndStore();

    assertThat(applicationEvents.stream(SignalsUpdatedEvent.class))
        .hasSize(1)
        .first()
        .extracting(SignalsUpdatedEvent::signalDate)
        .isEqualTo(SIGNAL_DATE);
  }

  private void insertCategoryPrices(String categoryId, LocalDate signalDate, int count) {
    for (int i = count - 1; i >= 0; i--) {
      LocalDate date = signalDate.minusDays(i);
      jdbcTemplate.update(
          "INSERT INTO raw_prices (trade_date, category_id, open, high, low, close, adj_close, volume)"
              + " VALUES (?, ?, 100.00, 100.00, 100.00, 100.00, 100.00, 1000000) ON CONFLICT DO NOTHING",
          date,
          categoryId);
    }
  }

  private void insertBenchmarkPrices(String ticker, LocalDate signalDate, int count) {
    for (int i = count - 1; i >= 0; i--) {
      LocalDate date = signalDate.minusDays(i);
      jdbcTemplate.update(
          "INSERT INTO benchmark_prices (trade_date, ticker, adj_close)"
              + " VALUES (?, ?, 200.00) ON CONFLICT DO NOTHING",
          date,
          ticker);
    }
  }
}
