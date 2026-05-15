package com.ftm.app.ingestion.repository;

import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class BenchmarkPriceRepositoryIT {

    @Autowired
    BenchmarkPriceRepository repository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanTable() {
        jdbcTemplate.execute("TRUNCATE benchmark_prices CASCADE");
    }

    private static final String TICKER = "SPY";
    private static final LocalDate DATE_1 = LocalDate.of(2024, 1, 2);
    private static final LocalDate DATE_2 = LocalDate.of(2024, 1, 3);
    private static final LocalDate DATE_3 = LocalDate.of(2024, 1, 4);

    private BenchmarkPriceRepository.Row row(LocalDate date, String ticker) {
        return Instancio.of(BenchmarkPriceRepository.Row.class)
                .set(field(BenchmarkPriceRepository.Row::tradeDate), date)
                .set(field(BenchmarkPriceRepository.Row::ticker), ticker)
                .create();
    }

    @Test
    @DisplayName("batchInsert persists all rows")
    void shouldPersistAllRows() {
        var rows = List.of(row(DATE_1, TICKER), row(DATE_2, TICKER), row(DATE_3, TICKER));

        int inserted = repository.batchInsert(rows);

        assertThat(inserted).isEqualTo(3);
        assertThat(repository.countAll()).isEqualTo(3);
    }

    @Test
    @DisplayName("batchInsert returns zero and inserts nothing given empty list")
    void shouldReturnZeroAndInsertNothingGivenEmptyList() {
        int inserted = repository.batchInsert(List.of());

        assertThat(inserted).isZero();
        assertThat(repository.countAll()).isZero();
    }

    @Test
    @DisplayName("batchInsert ignores duplicate key on second insert")
    void shouldIgnoreDuplicateKeyOnSecondInsert() {
        var row = row(DATE_1, TICKER);
        repository.batchInsert(List.of(row));

        int inserted = repository.batchInsert(List.of(row(DATE_1, TICKER)));

        assertThat(inserted).isZero();
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("findMaxTradeDate returns latest date for ticker")
    void shouldReturnLatestTradeDateForTicker() {
        repository.batchInsert(List.of(row(DATE_1, TICKER), row(DATE_3, TICKER), row(DATE_2, TICKER)));

        var maxDate = repository.findMaxTradeDate(TICKER);

        assertThat(maxDate).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxTradeDate isolates results per ticker")
    void shouldIsolateTradeDateLookupPerTicker() {
        repository.batchInsert(List.of(row(DATE_1, TICKER), row(DATE_3, "AGG")));

        assertThat(repository.findMaxTradeDate(TICKER)).contains(DATE_1);
        assertThat(repository.findMaxTradeDate("AGG")).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxTradeDate returns empty for unknown ticker")
    void shouldReturnEmptyForUnknownTicker() {
        var maxDate = repository.findMaxTradeDate("UNKNOWN");

        assertThat(maxDate).isEmpty();
    }
}
