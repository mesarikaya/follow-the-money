package com.ftm.app.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.api.dto.TickerMappingDto;
import com.ftm.app.portfolio.domain.TickerMapping;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TickerMappingMapperTest {

  private final TickerMappingMapper mapper = new TickerMappingMapperImpl();

  @Test
  @DisplayName("maps all fields from TickerMapping to TickerMappingDto")
  void shouldMapAllFields() {
    OffsetDateTime updatedAt = OffsetDateTime.parse("2025-01-15T10:30:00Z");
    TickerMapping source = new TickerMapping("AAPL", "TECH", "Apple Inc.", updatedAt);

    TickerMappingDto result = mapper.toDto(source);

    assertThat(result.ticker()).isEqualTo("AAPL");
    assertThat(result.categoryId()).isEqualTo("TECH");
    assertThat(result.notes()).isEqualTo("Apple Inc.");
    assertThat(result.updatedAt()).isEqualTo(updatedAt);
  }

  @Test
  @DisplayName("maps null notes without throwing")
  void shouldMapNullNotes() {
    TickerMapping source = new TickerMapping("XLK", "TECH", null, OffsetDateTime.now());

    TickerMappingDto result = mapper.toDto(source);

    assertThat(result.ticker()).isEqualTo("XLK");
    assertThat(result.notes()).isNull();
  }
}
