package com.ftm.app.signals.service;

import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.SignalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
    @DisplayName("computeAndStore writes RS, MOM, RRG, MACRO_REGIME, and COMPOSITE signals when price data is sufficient")
    void shouldComputeAllSignalTypesWhenDataSufficient() {
        insertCategoryPrices("TECH", SIGNAL_DATE, 130);
        insertBenchmarkPrices("SPY", SIGNAL_DATE, 130);

        service.computeAndStore();

        List<SignalRepository.HistoryRow> signals = signalRepository.findByCategoryId("TECH");
        assertThat(signals)
                .extracting(SignalRepository.HistoryRow::signalType)
                .containsExactlyInAnyOrder(
                        SignalType.RS_20, SignalType.RS_60, SignalType.RS_120, SignalType.MOM,
                        SignalType.RRG_RATIO, SignalType.RRG_MOM, SignalType.RRG_QUADRANT,
                        SignalType.MACRO_REGIME, SignalType.COMPOSITE);
    }

    @Test
    @DisplayName("computeAndStore omits signals requiring more data than available, but always writes MACRO_REGIME")
    void shouldOmitSignalTypesWithInsufficientData() {
        // 25 prices: enough for RS_20 (needs 21) but not RS_60/RS_120/MOM/RRG; MACRO_REGIME always written
        insertCategoryPrices("TECH", SIGNAL_DATE, 25);
        insertBenchmarkPrices("SPY", SIGNAL_DATE, 25);

        service.computeAndStore();

        List<SignalRepository.HistoryRow> signals = signalRepository.findByCategoryId("TECH");
        assertThat(signals)
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
                    "INSERT INTO raw_prices (trade_date, category_id, open, high, low, close, adj_close, volume)" +
                    " VALUES (?, ?, 100.00, 100.00, 100.00, 100.00, 100.00, 1000000) ON CONFLICT DO NOTHING",
                    date, categoryId);
        }
    }

    private void insertBenchmarkPrices(String ticker, LocalDate signalDate, int count) {
        for (int i = count - 1; i >= 0; i--) {
            LocalDate date = signalDate.minusDays(i);
            jdbcTemplate.update(
                    "INSERT INTO benchmark_prices (trade_date, ticker, adj_close)" +
                    " VALUES (?, ?, 200.00) ON CONFLICT DO NOTHING",
                    date, ticker);
        }
    }
}
