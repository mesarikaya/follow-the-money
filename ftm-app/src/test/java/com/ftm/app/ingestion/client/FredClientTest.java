package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

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
    @DisplayName("fetchObservations parses dates and values correctly from valid response")
    void shouldParseDatesAndValuesCorrectly() {
        server.enqueue(new MockResponse()
                .setBody(fixture("fixtures/fred-observations-valid.json"))
                .addHeader("Content-Type", "application/json"));

        List<FredObservationsResponse.Observation> result =
                client.fetchObservations("T10Y2Y", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).date()).isEqualTo("2024-01-02");
        assertThat(result.get(0).value()).isEqualTo("3.95");
        assertThat(result.get(1).date()).isEqualTo("2024-01-04");
    }

    @Test
    @DisplayName("fetchObservations filters out missing value entries")
    void shouldFilterMissingValues() {
        server.enqueue(new MockResponse()
                .setBody(fixture("fixtures/fred-observations-with-missing.json"))
                .addHeader("Content-Type", "application/json"));

        List<FredObservationsResponse.Observation> result =
                client.fetchObservations("VIXCLS", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5));

        assertThat(result).hasSize(2);
        assertThat(result).noneMatch(FredObservationsResponse.Observation::isMissing);
    }

    @Test
    @DisplayName("fetchObservations throws on server error so the handler can capture it")
    void shouldThrowOnServerError() {
        // Without Spring context @Retryable is not active; client throws so the handler can capture the error
        server.enqueue(new MockResponse().setResponseCode(500));

        assertThatThrownBy(() ->
                client.fetchObservations("T10Y2Y", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 5)))
                .isInstanceOf(Exception.class);
    }

    private String fixture(String path) {
        try (var stream = getClass().getClassLoader().getResourceAsStream(path)) {
            return new String(Objects.requireNonNull(stream, "Fixture not found: " + path).readAllBytes(),
                    StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
