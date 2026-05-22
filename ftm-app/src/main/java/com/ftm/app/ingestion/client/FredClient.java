package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.web.client.RestClient;

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
      backoff = @Backoff(delay = 1000, multiplier = 2, random = true, maxDelay = 8000))
  public List<FredObservationsResponse.Observation> fetchObservations(
      String seriesId, LocalDate from, LocalDate to) {
    log.info("Fetching FRED series {} from {} to {}", seriesId, from, to);
    FredObservationsResponse response =
        restClient
            .get()
            .uri(
                uriBuilder ->
                    uriBuilder
                        .path("/fred/series/observations")
                        .queryParam("series_id", seriesId)
                        .queryParam("api_key", apiKey)
                        .queryParam("file_type", "json")
                        .queryParam("observation_start", from)
                        .queryParam("observation_end", to)
                        .build())
            .retrieve()
            .body(FredObservationsResponse.class);
    if (response == null || response.observations() == null) return List.of();
    List<FredObservationsResponse.Observation> result =
        response.observations().stream().filter(o -> !o.isMissing()).toList();
    log.info("FRED series {} returned {} observations", seriesId, result.size());
    return result;
  }
}
