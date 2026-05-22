package com.ftm.app.api.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.domain.MacroIndicator;
import java.math.BigDecimal;
import java.time.LocalDate;
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
class MacroIndicatorRepositoryIT {

  @Autowired MacroIndicatorReadRepository repository;

  @Autowired JdbcTemplate jdbcTemplate;

  @BeforeEach
  void cleanTable() {
    jdbcTemplate.execute("TRUNCATE macro_indicators CASCADE");
  }

  private void insert(LocalDate date, String seriesId, String value) {
    jdbcTemplate.update(
        "INSERT INTO macro_indicators (observation_date, series_id, value, source) VALUES (?, ?, ?, 'FRED')",
        date,
        seriesId,
        new BigDecimal(value));
  }

  @Test
  @DisplayName("findLatestPerSeries returns empty when table is empty")
  void shouldReturnEmptyWhenTableIsEmpty() {
    List<MacroIndicator> result = repository.findLatestPerSeries();

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("findLatestPerSeries returns the latest observation per series")
  void shouldReturnLatestObservationPerSeries() {
    insert(LocalDate.of(2024, 1, 2), "DGS10", "4.15");
    insert(LocalDate.of(2024, 1, 3), "DGS10", "4.18");
    insert(LocalDate.of(2024, 1, 2), "UNRATE", "3.70");

    List<MacroIndicator> result = repository.findLatestPerSeries();

    assertThat(result).hasSize(2);
    MacroIndicator dgs10 =
        result.stream().filter(m -> m.seriesId().equals("DGS10")).findFirst().orElseThrow();
    assertThat(dgs10.observationDate()).isEqualTo(LocalDate.of(2024, 1, 3));
    assertThat(dgs10.source()).isEqualTo("FRED");
  }

  @Test
  @DisplayName("findLatestPerSeries returns one row per series even when multiple dates exist")
  void shouldReturnOneRowPerSeries() {
    insert(LocalDate.of(2024, 1, 1), "DGS10", "4.10");
    insert(LocalDate.of(2024, 1, 2), "DGS10", "4.20");
    insert(LocalDate.of(2024, 1, 3), "DGS10", "4.30");

    List<MacroIndicator> result = repository.findLatestPerSeries();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).seriesId()).isEqualTo("DGS10");
    assertThat(result.get(0).observationDate()).isEqualTo(LocalDate.of(2024, 1, 3));
  }

  @Test
  @DisplayName("findLatestPerSeries maps all fields correctly")
  void shouldMapAllFieldsCorrectly() {
    insert(LocalDate.of(2024, 1, 5), "T10Y2Y", "0.3500");

    List<MacroIndicator> result = repository.findLatestPerSeries();

    assertThat(result).hasSize(1);
    MacroIndicator m = result.get(0);
    assertThat(m.seriesId()).isEqualTo("T10Y2Y");
    assertThat(m.observationDate()).isEqualTo(LocalDate.of(2024, 1, 5));
    assertThat(m.value()).isNotNull();
    assertThat(m.source()).isEqualTo("FRED");
  }
}
