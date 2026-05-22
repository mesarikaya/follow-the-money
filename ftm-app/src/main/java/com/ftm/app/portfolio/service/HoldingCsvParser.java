package com.ftm.app.portfolio.service;

import com.ftm.app.portfolio.domain.HoldingCsvRow;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;

@Service
public class HoldingCsvParser {

  public List<HoldingCsvRow> parse(String csv) throws IOException {
    char delimiter = detectDelimiter(csv);
    List<HoldingCsvRow> rows = new ArrayList<>();

    try (CSVParser parser =
        CSVParser.parse(
            csv,
            CSVFormat.DEFAULT
                .builder()
                .setDelimiter(delimiter)
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .get())) {

      for (CSVRecord record : parser) {
        rows.add(
            new HoldingCsvRow(
                safeGet(record, "ticker"),
                safeGet(record, "name"),
                safeGet(record, "quantity"),
                safeGet(record, "currency"),
                safeGet(record, "avg_cost")));
      }
    }

    return rows;
  }

  private char detectDelimiter(String csv) {
    String firstLine = csv.lines().findFirst().orElse("");
    long semicolons = firstLine.chars().filter(c -> c == ';').count();
    long commas = firstLine.chars().filter(c -> c == ',').count();
    return semicolons > commas ? ';' : ',';
  }

  private String safeGet(CSVRecord record, String header) {
    return record.isMapped(header) ? record.get(header) : "";
  }
}
