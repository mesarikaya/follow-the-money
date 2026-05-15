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
class MacroIndicatorRepositoryIT {

    @Autowired
    MacroIndicatorRepository repository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanTable() {
        jdbcTemplate.execute("TRUNCATE macro_indicators CASCADE");
    }

    private static final String SERIES_ID = "DGS10";
    private static final LocalDate DATE_1 = LocalDate.of(2024, 1, 2);
    private static final LocalDate DATE_2 = LocalDate.of(2024, 1, 3);
    private static final LocalDate DATE_3 = LocalDate.of(2024, 1, 4);

    private MacroIndicatorRepository.Row row(LocalDate date, String seriesId, String value) {
        return new MacroIndicatorRepository.Row(date, seriesId, new BigDecimal(value));
    }

    @Test
    @DisplayName("batchInsert persists all rows")
    void shouldPersistAllRows() {
        var rows = List.of(
                row(DATE_1, SERIES_ID, "4.15"),
                row(DATE_2, SERIES_ID, "4.18"),
                row(DATE_3, SERIES_ID, "4.12")
        );

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
        repository.batchInsert(List.of(row(DATE_1, SERIES_ID, "4.15")));

        int inserted = repository.batchInsert(List.of(row(DATE_1, SERIES_ID, "9.99")));

        assertThat(inserted).isZero();
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("batchInsert allows null value per schema")
    void shouldAllowNullValuePerSchema() {
        var row = new MacroIndicatorRepository.Row(DATE_1, SERIES_ID, null);

        int inserted = repository.batchInsert(List.of(row));

        assertThat(inserted).isEqualTo(1);
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("findMaxObservationDate returns latest date for series")
    void shouldReturnLatestObservationDateForSeries() {
        repository.batchInsert(List.of(
                row(DATE_1, SERIES_ID, "4.15"),
                row(DATE_3, SERIES_ID, "4.12"),
                row(DATE_2, SERIES_ID, "4.18")
        ));

        var maxDate = repository.findMaxObservationDate(SERIES_ID);

        assertThat(maxDate).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxObservationDate isolates results per series")
    void shouldIsolateObservationDateLookupPerSeries() {
        repository.batchInsert(List.of(
                row(DATE_1, "DGS10", "4.15"),
                row(DATE_3, "UNRATE", "3.70")
        ));

        assertThat(repository.findMaxObservationDate("DGS10")).contains(DATE_1);
        assertThat(repository.findMaxObservationDate("UNRATE")).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxObservationDate returns empty for unknown series")
    void shouldReturnEmptyForUnknownSeries() {
        var maxDate = repository.findMaxObservationDate("UNKNOWN");

        assertThat(maxDate).isEmpty();
    }
}
