package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

@Component
public class YahooFinanceClient {

    private static final Logger log = LoggerFactory.getLogger(YahooFinanceClient.class);

    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

    private final RestClient restClient;

    public YahooFinanceClient(RestClient.Builder builder, String yahooBaseUrl) {
        this.restClient = builder
                .baseUrl(yahooBaseUrl)
                .defaultHeader("User-Agent", USER_AGENT)
                .build();
    }

    @Retryable(
            retryFor = Exception.class,
            noRetryFor = HttpClientErrorException.NotFound.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000, multiplier = 2, random = true, maxDelay = 8000)
    )
    public Optional<YahooChartResponse> fetchChart(String ticker, LocalDate from, LocalDate to) {
        long period1 = from.atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        long period2 = to.atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        try {
            YahooChartResponse response = restClient.get()
                    .uri("/v8/finance/chart/{ticker}?interval=1d&period1={p1}&period2={p2}",
                            ticker, period1, period2)
                    .retrieve()
                    .body(YahooChartResponse.class);
            return Optional.ofNullable(response);
        } catch (HttpClientErrorException.NotFound ex) {
            log.warn("Yahoo Finance: ticker {} not found", ticker);
            return Optional.empty();
        }
    }
}
