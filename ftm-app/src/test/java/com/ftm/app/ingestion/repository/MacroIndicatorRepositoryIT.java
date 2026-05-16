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

    private MacroIndicatorRepository.Row row(LocalDate date, String seriesId) {
        return Instancio.of(MacroIndicatorRepository.Row.class)
                .set(field(MacroIndicatorRepository.Row::observationDate), date)
                .set(field(MacroIndicatorRepository.Row::seriesId), seriesId)
                .create();
    }

    @Test
    @DisplayName("batchInsert persists all rows")
    void shouldPersistAllRows() {
        var rows = List.of(row(DATE_1, SERIES_ID), row(DATE_2, SERIES_ID), row(DATE_3, SERIES_ID));

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
        repository.batchInsert(List.of(row(DATE_1, SERIES_ID)));

        int inserted = repository.batchInsert(List.of(row(DATE_1, SERIES_ID)));

        assertThat(inserted).isZero();
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("batchInsert allows null value per schema")
    void shouldAllowNullValuePerSchema() {
        var row = Instancio.of(MacroIndicatorRepository.Row.class)
                .set(field(MacroIndicatorRepository.Row::observationDate), DATE_1)
                .set(field(MacroIndicatorRepository.Row::seriesId), SERIES_ID)
                .ignore(field(MacroIndicatorRepository.Row::value))
                .create();

        int inserted = repository.batchInsert(List.of(row));

        assertThat(inserted).isEqualTo(1);
        assertThat(repository.countAll()).isEqualTo(1);
    }

    @Test
    @DisplayName("findMaxObservationDate returns latest date for series")
    void shouldReturnLatestObservationDateForSeries() {
        repository.batchInsert(List.of(
                row(DATE_1, SERIES_ID),
                row(DATE_3, SERIES_ID),
                row(DATE_2, SERIES_ID)
        ));

        var maxDate = repository.findMaxObservationDate(SERIES_ID);

        assertThat(maxDate).contains(DATE_3);
    }

    @Test
    @DisplayName("findMaxObservationDate isolates results per series")
    void shouldIsolateObservationDateLookupPerSeries() {
        repository.batchInsert(List.of(
                row(DATE_1, "DGS10"),
                row(DATE_3, "UNRATE")
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
