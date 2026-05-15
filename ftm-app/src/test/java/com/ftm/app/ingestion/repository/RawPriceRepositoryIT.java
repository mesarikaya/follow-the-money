package com.ftm.app.ingestion.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class RawPriceRepositoryIT {

    @Autowired
    RawPriceRepository repository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanTable() {
        jdbcTemplate.execute("TRUNCATE raw_prices");
    }

    // V2 seeds this category — safe to use in all tests
    private static final String CATEGORY_ID = "TECH";
    private static final LocalDate DATE_1 = LocalDate.of(2024, 1, 2);
    private static final LocalDate DATE_2 = LocalDate.of(2024, 1, 3);
    private static final LocalDate DATE_3 = LocalDate.of(2024, 1, 4);

    private RawPriceRepository.Row row(LocalDate date, String categoryId) {
        return new RawPriceRepository.Row(
                date, categoryId,
                new BigDecimal("190.00"),
                new BigDecimal("192.50"),
                new BigDecimal("189.75"),
                new BigDecimal("191.00"),
                new BigDecimal("191.00"),
                50_000_000L
        );
    }

    @Test
    @DisplayName("batchInsert persists all rows")
    void shouldPersistAllRows() {
        var rows = List.of(row(DATE_1, CATEGORY_ID), row(DATE_2, CATEGORY_ID), row(DATE_3, CATEGORY_ID));

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
        repository.batchInsert(List.of(row(DATE_1, CATEGORY_ID)));

        int inserted = repository.batchInsert(List.of(row(DATE_1, CATEGORY_ID)));

        assertThat(inserted).isZero();
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("findMaxTradeDate returns latest date for category")
    void shouldReturnLatestTradeDateForCategory() {
        repository.batchInsert(List.of(
                row(DATE_1, CATEGORY_ID),
                row(DATE_3, CATEGORY_ID),
                row(DATE_2, CATEGORY_ID)
        ));

        var maxDate = repository.findMaxTradeDate(CATEGORY_ID);

        assertThat(maxDate).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxTradeDate isolates results per category")
    void shouldIsolateTradeDateLookupPerCategory() {
        repository.batchInsert(List.of(
                row(DATE_1, "TECH"),
                row(DATE_3, "HLTH")
        ));

        assertThat(repository.findMaxTradeDate("TECH")).contains(DATE_1);
        assertThat(repository.findMaxTradeDate("HLTH")).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxTradeDate returns empty for unknown category")
    void shouldReturnEmptyForUnknownCategory() {
        var maxDate = repository.findMaxTradeDate("UNKNOWN");

        assertThat(maxDate).isEmpty();
    }
}
