package com.ftm.app.ingestion.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record YahooChartResponse(Chart chart) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Chart(List<Result> result, Object error) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Result(
            List<Long> timestamp,
            Indicators indicators
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Indicators(List<Quote> quote, List<AdjClose> adjclose) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Quote(
            List<BigDecimal> open,
            List<BigDecimal> high,
            List<BigDecimal> low,
            List<BigDecimal> close,
            List<Long> volume
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdjClose(List<BigDecimal> adjclose) {}
}
