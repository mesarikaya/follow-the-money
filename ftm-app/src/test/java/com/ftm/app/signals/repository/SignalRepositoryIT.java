package com.ftm.app.signals.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class SignalRepositoryIT {

  @Autowired SignalRepository repository;
  @Autowired JdbcTemplate jdbcTemplate;

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String TECH = "TECH";

  @BeforeEach
  void clean() {
    jdbcTemplate.execute("TRUNCATE signals CASCADE");
  }

  @Test
  @DisplayName("batchUpsert inserts new signal rows")
  void shouldInsertNewSignalRows() {
    var rows =
        List.of(
            new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.045000")),
            new SignalRepository.Row(DATE, TECH, SignalType.RS_20, new BigDecimal("1.012000")));

    int written = repository.batchUpsert(rows);

    assertThat(written).isEqualTo(2);
    var history = repository.findByCategoryId(TECH);
    assertThat(history).hasSize(2);
  }

  @Test
  @DisplayName("batchUpsert updates value on conflict")
  void shouldUpdateValueOnConflict() {
    var initial =
        List.of(new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.000000")));
    repository.batchUpsert(initial);

    var updated =
        List.of(new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.100000")));
    repository.batchUpsert(updated);

    var history = repository.findByCategoryId(TECH);
    assertThat(history).hasSize(1);
    assertThat(history.getFirst().value()).isEqualByComparingTo("1.100000");
  }

  @Test
  @DisplayName("findLatestByType returns value for the most recent signal_date")
  void shouldReturnLatestSignalByType() {
    var older =
        new SignalRepository.Row(
            DATE.minusDays(1), TECH, SignalType.RS_60, new BigDecimal("0.990000"));
    var newer = new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.050000"));
    repository.batchUpsert(List.of(older, newer));

    var result = repository.findLatestByType(SignalType.RS_60);

    assertThat(result).containsKey(TECH);
    assertThat(result.get(TECH)).isEqualByComparingTo("1.050000");
  }

  @Test
  @DisplayName("findLatestByType returns empty map when no signals exist")
  void shouldReturnEmptyMapWhenNoSignals() {
    assertThat(repository.findLatestByType(SignalType.RS_60)).isEmpty();
  }

  @Test
  @DisplayName("findByCategoryId returns ordered history descending by date")
  void shouldReturnHistoryOrderedByDate() {
    repository.batchUpsert(
        List.of(
            new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.050000")),
            new SignalRepository.Row(
                DATE.minusDays(1), TECH, SignalType.RS_60, new BigDecimal("1.040000"))));

    var history = repository.findByCategoryId(TECH);

    assertThat(history.getFirst().signalDate()).isEqualTo(DATE);
    assertThat(history.getLast().signalDate()).isEqualTo(DATE.minusDays(1));
  }

  @Test
  @DisplayName("findLatestByTypes returns the most recent value for each requested type in one call")
  void shouldReturnLatestSignalsForMultipleTypes() {
    repository.batchUpsert(
        List.of(
            new SignalRepository.Row(DATE.minusDays(1), TECH, SignalType.RS_60, new BigDecimal("1.010000")),
            new SignalRepository.Row(DATE, TECH, SignalType.RS_60, new BigDecimal("1.050000")),
            new SignalRepository.Row(DATE, TECH, SignalType.COMPOSITE, new BigDecimal("0.750000")),
            new SignalRepository.Row(DATE, TECH, SignalType.RRG_QUADRANT, new BigDecimal("4"))));

    Map<SignalType, Map<String, BigDecimal>> result =
        repository.findLatestByTypes(List.of(SignalType.RS_60, SignalType.COMPOSITE, SignalType.RRG_QUADRANT));

    assertThat(result).containsKeys(SignalType.RS_60, SignalType.COMPOSITE, SignalType.RRG_QUADRANT);
    assertThat(result.get(SignalType.RS_60).get(TECH)).isEqualByComparingTo("1.050000");
    assertThat(result.get(SignalType.COMPOSITE).get(TECH)).isEqualByComparingTo("0.750000");
    assertThat(result.get(SignalType.RRG_QUADRANT).get(TECH)).isEqualByComparingTo("4");
  }

  @Test
  @DisplayName("findLatestByTypes returns empty map for empty input")
  void shouldReturnEmptyMapForEmptyTypeList() {
    assertThat(repository.findLatestByTypes(List.of())).isEmpty();
  }
}
