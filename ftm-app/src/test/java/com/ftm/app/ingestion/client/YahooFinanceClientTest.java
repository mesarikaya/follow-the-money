package com.ftm.app.ingestion.client;

import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YahooFinanceClientTest {

    private MockWebServer server;
    private YahooFinanceClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        client = new YahooFinanceClient(RestClient.builder(), server.url("/").toString());
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    @DisplayName("fetchChart parses timestamps and prices correctly from valid response")
    void shouldParseTimestampsAndPricesCorrectly() throws InterruptedException {
        server.enqueue(new MockResponse()
                .setBody(fixture("fixtures/yahoo-chart-valid.json"))
                .addHeader("Content-Type", "application/json"));

        Optional<YahooChartResponse> result =
                client.fetchChart("XLK", LocalDate.of(2024, 1, 2), LocalDate.of(2024, 1, 5));

        assertThat(result).isPresent();
        YahooChartResponse.Result chartResult = result.get().chart().result().get(0);
        assertThat(chartResult.timestamp()).hasSize(2);
        assertThat(chartResult.indicators().adjclose().get(0).adjclose()).hasSize(2);
        assertThat(chartResult.indicators().quote().get(0).open()).hasSize(2);

        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).contains("XLK");
        assertThat(request.getHeader("User-Agent")).isNotBlank();
    }

    @Test
    @DisplayName("fetchChart returns empty when ticker is not found (404)")
    void shouldReturnEmptyOnNotFound() {
        server.enqueue(new MockResponse().setResponseCode(404));

        Optional<YahooChartResponse> result =
                client.fetchChart("INVALID", LocalDate.of(2024, 1, 2), LocalDate.of(2024, 1, 5));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("fetchChart throws on server error so the handler can capture it")
    void shouldThrowOnServerError() {
        // Without Spring context @Retryable is not active; client throws so the handler can capture the error
        server.enqueue(new MockResponse().setResponseCode(500));

        assertThatThrownBy(() ->
                client.fetchChart("XLK", LocalDate.of(2024, 1, 2), LocalDate.of(2024, 1, 5)))
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
