package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FredClientTest {

    private MockWebServer server;
    private FredClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        client = new FredClient(RestClient.builder(), server.url("/").toString(), "test-key");
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void fetchObservations_parsesDatesAndValuesCorrectly() {
        server.enqueue(new MockResponse()
                .setBody(validObservationsJson())
                .addHeader("Content-Type", "application/json"));

        List<FredObservationsResponse.Observation> result =
                client.fetchObservations("T10Y2Y", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).date()).isEqualTo("2024-01-02");
        assertThat(result.get(0).value()).isEqualTo("3.95");
        assertThat(result.get(1).date()).isEqualTo("2024-01-04");
    }

    @Test
    void fetchObservations_filtersMissingValues() {
        server.enqueue(new MockResponse()
                .setBody(observationsWithMissingJson())
                .addHeader("Content-Type", "application/json"));

        List<FredObservationsResponse.Observation> result =
                client.fetchObservations("VIXCLS", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5));

        assertThat(result).hasSize(2);
        assertThat(result).noneMatch(FredObservationsResponse.Observation::isMissing);
    }

    @Test
    void fetchObservations_throwsOnServerError() {
        // Without Spring context @Retryable is not active; client throws so the handler can capture the error
        server.enqueue(new MockResponse().setResponseCode(500));

        assertThatThrownBy(() ->
                client.fetchObservations("T10Y2Y", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5)))
                .isInstanceOf(Exception.class);
    }

    private String validObservationsJson() {
        return """
                {
                  "observations": [
                    {"date": "2024-01-02", "value": "3.95"},
                    {"date": "2024-01-04", "value": "3.88"}
                  ]
                }
                """;
    }

    private String observationsWithMissingJson() {
        return """
                {
                  "observations": [
                    {"date": "2024-01-02", "value": "18.45"},
                    {"date": "2024-01-03", "value": "."},
                    {"date": "2024-01-04", "value": "19.10"}
                  ]
                }
                """;
    }
}
