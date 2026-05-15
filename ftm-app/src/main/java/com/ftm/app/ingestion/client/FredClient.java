package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.List;

@Component
public class FredClient {

    private static final Logger log = LoggerFactory.getLogger(FredClient.class);

    private final RestClient restClient;
    private final String apiKey;

    public FredClient(RestClient.Builder builder, String fredBaseUrl, String fredApiKey) {
        this.restClient = builder.baseUrl(fredBaseUrl).build();
        this.apiKey = fredApiKey;
    }

    @Retryable(
            retryFor = Exception.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000, multiplier = 2, random = true, maxDelay = 8000)
    )
    public List<FredObservationsResponse.Observation> fetchObservations(
            String seriesId, LocalDate from, LocalDate to) {
        log.debug("Fetching FRED series {} from {} to {}", seriesId, from, to);
        FredObservationsResponse response = restClient.get()
                .uri("/fred/v2/series/observations?series_id={sid}&api_key={key}" +
                                "&file_type=json&observation_start={from}&observation_end={to}",
                        seriesId, apiKey, from, to)
                .retrieve()
                .body(FredObservationsResponse.class);
        if (response == null || response.observations() == null) return List.of();
        List<FredObservationsResponse.Observation> result = response.observations().stream()
                .filter(o -> !o.isMissing())
                .toList();
        log.debug("FRED series {} returned {} observations", seriesId, result.size());
        return result;
    }
}
