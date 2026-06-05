package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.portfolio.domain.HoldingCsvRow;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HoldingCsvParserTest {

  private final HoldingCsvParser parser = new HoldingCsvParser();

  @Test
  @DisplayName("parses comma-delimited CSV with all fields")
  void shouldParseCommaCsv() throws IOException {
    String csv = """
        ticker,name,quantity,currency,avg_cost
        XLK,Technology ETF,100,USD,185.50
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).ticker()).isEqualTo("XLK");
    assertThat(rows.get(0).name()).isEqualTo("Technology ETF");
    assertThat(rows.get(0).quantity()).isEqualTo("100");
    assertThat(rows.get(0).currency()).isEqualTo("USD");
    assertThat(rows.get(0).avgCost()).isEqualTo("185.50");
  }

  @Test
  @DisplayName("auto-detects semicolon delimiter when header has more semicolons than commas")
  void shouldParseSemicolonCsv() throws IOException {
    String csv = """
        ticker;name;quantity;currency;avg_cost
        GLD;Gold ETF;50;EUR;150.00
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).ticker()).isEqualTo("GLD");
    assertThat(rows.get(0).currency()).isEqualTo("EUR");
    assertThat(rows.get(0).avgCost()).isEqualTo("150.00");
  }

  @Test
  @DisplayName("parses multiple rows")
  void shouldParseMultipleRows() throws IOException {
    String csv = """
        ticker,name,quantity,currency,avg_cost
        XLK,Tech,100,USD,185.50
        XLV,Health,200,USD,130.00
        XLE,Energy,75,USD,90.25
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(3);
    assertThat(rows).extracting(HoldingCsvRow::ticker).containsExactly("XLK", "XLV", "XLE");
  }

  @Test
  @DisplayName("returns empty string for missing optional column")
  void shouldReturnEmptyStringForMissingColumn() throws IOException {
    String csv = """
        ticker,quantity
        BIL,1000
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).ticker()).isEqualTo("BIL");
    assertThat(rows.get(0).name()).isEmpty();
    assertThat(rows.get(0).currency()).isEmpty();
    assertThat(rows.get(0).avgCost()).isEmpty();
  }

  @Test
  @DisplayName("handles header case-insensitively")
  void shouldHandleCaseInsensitiveHeaders() throws IOException {
    String csv = """
        TICKER,NAME,QUANTITY,CURRENCY,AVG_COST
        XLF,Financials,300,USD,42.00
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).ticker()).isEqualTo("XLF");
    assertThat(rows.get(0).name()).isEqualTo("Financials");
  }

  @Test
  @DisplayName("returns empty list for CSV with only a header row")
  void shouldReturnEmptyListForHeaderOnly() throws IOException {
    String csv = "ticker,name,quantity,currency,avg_cost\n";

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).isEmpty();
  }

  @Test
  @DisplayName("trims whitespace around field values")
  void shouldTrimWhitespace() throws IOException {
    String csv = """
        ticker , name , quantity , currency , avg_cost
          XLB  ,  Materials  ,  100  ,  USD  ,  58.75
        """;

    List<HoldingCsvRow> rows = parser.parse(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).ticker()).isEqualTo("XLB");
    assertThat(rows.get(0).name()).isEqualTo("Materials");
    assertThat(rows.get(0).quantity()).isEqualTo("100");
  }
}
