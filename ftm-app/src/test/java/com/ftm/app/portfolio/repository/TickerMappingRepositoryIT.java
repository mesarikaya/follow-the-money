package com.ftm.app.portfolio.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.portfolio.domain.TickerMapping;
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
class TickerMappingRepositoryIT {

  @Autowired TickerMappingRepository repository;
  @Autowired JdbcTemplate jdbcTemplate;

  @BeforeEach
  void cleanTable() {
    jdbcTemplate.execute("TRUNCATE ticker_category_map");
  }

  @Test
  @DisplayName("upsert inserts a new ticker mapping")
  void shouldInsertNewMapping() {
    repository.upsert("AAPL", "TECH", "Apple Inc.");

    Map<String, String> map = repository.findAllAsMap();
    assertThat(map).containsEntry("AAPL", "TECH");
  }

  @Test
  @DisplayName("upsert updates existing mapping on conflict")
  void shouldUpdateExistingMapping() {
    repository.upsert("XLK", "TECH", "Tech ETF");
    repository.upsert("XLK", "INDU", "Updated category");

    Map<String, String> map = repository.findAllAsMap();
    assertThat(map.get("XLK")).isEqualTo("INDU");
  }

  @Test
  @DisplayName("findAll returns ordered list by category then ticker")
  void shouldReturnOrderedList() {
    repository.upsert("XLK", "TECH", null);
    repository.upsert("GLD", "GOLD", null);
    repository.upsert("TLT", "TLTD", null);

    List<TickerMapping> all = repository.findAll();
    assertThat(all).hasSize(3);
    assertThat(all).extracting(TickerMapping::categoryId).isSortedAccordingTo(String::compareTo);
  }

  @Test
  @DisplayName("findAllAsMap stores tickers in uppercase")
  void shouldStoreTickersUppercase() {
    repository.upsert("aapl", "TECH", null);

    Map<String, String> map = repository.findAllAsMap();
    assertThat(map).containsKey("AAPL");
    assertThat(map).doesNotContainKey("aapl");
  }

  @Test
  @DisplayName("delete removes the mapping and returns 1")
  void shouldDeleteMapping() {
    repository.upsert("GLD", "GOLD", null);

    int deleted = repository.delete("GLD");

    assertThat(deleted).isEqualTo(1);
    assertThat(repository.findAllAsMap()).doesNotContainKey("GLD");
  }

  @Test
  @DisplayName("delete returns 0 when ticker does not exist")
  void shouldReturnZeroWhenTickerNotFound() {
    int deleted = repository.delete("NOTEXIST");

    assertThat(deleted).isZero();
  }

  @Test
  @DisplayName("delete is case-insensitive for ticker lookup")
  void shouldDeleteCaseInsensitively() {
    repository.upsert("GLD", "GOLD", null);

    int deleted = repository.delete("gld");

    assertThat(deleted).isEqualTo(1);
    assertThat(repository.findAllAsMap()).doesNotContainKey("GLD");
  }

  @Test
  @DisplayName("findAllAsMap returns empty map when table is empty")
  void shouldReturnEmptyMapWhenTableEmpty() {
    Map<String, String> map = repository.findAllAsMap();

    assertThat(map).isEmpty();
  }
}
