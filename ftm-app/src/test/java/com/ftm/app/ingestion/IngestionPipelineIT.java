package com.ftm.app.ingestion;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.BenchmarkPriceRepository;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import com.ftm.app.ingestion.repository.MacroIndicatorRepository;
import com.ftm.app.ingestion.repository.RawPriceRepository;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class IngestionPipelineIT {

    static MockWebServer mockExternalApis;

    @LocalServerPort int port;
    @Autowired IngestLogRepository ingestLogRepository;
    @Autowired RawPriceRepository rawPriceRepository;
    @Autowired BenchmarkPriceRepository benchmarkPriceRepository;
    @Autowired MacroIndicatorRepository macroIndicatorRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    RestClient restClient;

    @BeforeAll
    static void startMockServer() throws IOException {
        mockExternalApis = new MockWebServer();
        mockExternalApis.setDispatcher(new ExternalApiDispatcher());
        mockExternalApis.start();
    }

    @AfterAll
    static void stopMockServer() throws IOException {
        mockExternalApis.shutdown();
    }

    @DynamicPropertySource
    static void overrideExternalApiUrls(DynamicPropertyRegistry registry) {
        registry.add("ftm.yahoo.base-url", () -> mockExternalApis.url("/").toString());
        registry.add("ftm.fred.base-url",  () -> mockExternalApis.url("/").toString());
    }

    @BeforeEach
    void setUp() {
        restClient = RestClient.create("http://localhost:" + port);
        jdbcTemplate.execute("TRUNCATE raw_prices, benchmark_prices, macro_indicators, ingest_log CASCADE");
    }

    @Test
    @DisplayName("POST /ingest/trigger persists prices to database and completes with SUCCESS status")
    void shouldPersistPricesAndCompleteSuccessfully() {
        ResponseEntity<String> response = restClient.post()
                .uri("/api/v1/ingest/trigger").retrieve().toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(202);

        await().atMost(30, TimeUnit.SECONDS)
                .pollInterval(500, TimeUnit.MILLISECONDS)
                .until(() -> ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES)
                        .map(l -> l.status() != IngestStatus.RUNNING)
                        .orElse(false));

        var pricesLog = ingestLogRepository
                .findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES).orElseThrow();
        assertThat(pricesLog.status()).isEqualTo(IngestStatus.SUCCESS);
        assertThat(pricesLog.rowsInserted()).isPositive();
        assertThat(pricesLog.finishedAt()).isNotNull();

        assertThat(rawPriceRepository.countAll()).isPositive();
        assertThat(benchmarkPriceRepository.countAll()).isPositive();
    }

    @Test
    @DisplayName("POST /ingest/trigger persists macro data and completes with SUCCESS status")
    void shouldPersistMacroDataAndCompleteSuccessfully() {
        restClient.post().uri("/api/v1/ingest/trigger").retrieve().toEntity(String.class);

        await().atMost(30, TimeUnit.SECONDS)
                .pollInterval(500, TimeUnit.MILLISECONDS)
                .until(() -> ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.MACRO)
                        .map(l -> l.status() != IngestStatus.RUNNING)
                        .orElse(false));

        var macroLog = ingestLogRepository
                .findTopBySourceOrderByStartedAtDesc(IngestSource.MACRO).orElseThrow();
        assertThat(macroLog.status()).isEqualTo(IngestStatus.SUCCESS);

        assertThat(macroIndicatorRepository.countAll()).isPositive();
    }

    @Test
    @DisplayName("POST /ingest/trigger is idempotent — no duplicates on second trigger")
    void shouldBeIdempotentWithNoDuplicatesOnSecondTrigger() {
        restClient.post().uri("/api/v1/ingest/trigger").retrieve().toEntity(String.class);

        await().atMost(30, TimeUnit.SECONDS)
                .until(() -> ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES)
                        .map(l -> l.status() == IngestStatus.SUCCESS)
                        .orElse(false));

        int countAfterFirst = rawPriceRepository.countAll();
        OffsetDateTime firstRunStartedAt = ingestLogRepository
                .findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES).orElseThrow().startedAt();

        // Second trigger — all dates already present, ON CONFLICT DO NOTHING keeps count the same
        restClient.post().uri("/api/v1/ingest/trigger").retrieve().toEntity(String.class);

        // Wait for a NEW PRICES log (startedAt strictly after the first run) to complete
        await().atMost(30, TimeUnit.SECONDS)
                .until(() -> ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES)
                        .map(l -> l.status() == IngestStatus.SUCCESS
                                && l.startedAt().isAfter(firstRunStartedAt))
                        .orElse(false));

        int countAfterSecond = rawPriceRepository.countAll();

        assertThat(countAfterSecond).isEqualTo(countAfterFirst);
    }

    /**
     * Routes mock HTTP responses by path prefix — simulates Yahoo Finance and FRED APIs.
     */
    static class ExternalApiDispatcher extends Dispatcher {

        @NotNull
        @Override
        public MockResponse dispatch(@NotNull RecordedRequest request) {
            String path = request.getPath() == null ? "" : request.getPath();
            if (path.contains("/v8/finance/chart/")) {
                return jsonResponse(fixture("fixtures/yahoo-chart-valid.json"));
            }
            if (path.contains("/fred/v2/series/observations")) {
                return jsonResponse(fixture("fixtures/fred-observations-with-missing.json"));
            }
            return new MockResponse().setResponseCode(404);
        }

        private MockResponse jsonResponse(String body) {
            return new MockResponse()
                    .addHeader("Content-Type", "application/json")
                    .setBody(body);
        }

        private static String fixture(String path) {
            try (var stream = ExternalApiDispatcher.class.getClassLoader().getResourceAsStream(path)) {
                return new String(Objects.requireNonNull(stream, "Fixture not found: " + path).readAllBytes(),
                        StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
    }
}
