package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.backtest.repository.BacktestRepository;
import com.ftm.app.backtest.service.BacktestEngine;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class BacktestControllerTest {

  @Mock BacktestEngine backtestEngine;
  @Mock BacktestRepository backtestRepository;

  MockMvc mockMvc;
  ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new BacktestController(backtestEngine, backtestRepository))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private BacktestResult sampleResult(UUID runId) {
    return Instancio.of(BacktestResult.class)
        .set(field(BacktestResult::runId), runId)
        .set(field(BacktestResult::rebalanceFrequency), "MONTHLY")
        .set(field(BacktestResult::equityCurve), List.of())
        .create();
  }

  @Test
  @DisplayName("POST /backtest/run returns 200 with backtest result")
  void shouldRunBacktest() throws Exception {
    UUID runId = UUID.randomUUID();
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2023, 1, 1),
            LocalDate.of(2024, 1, 1),
            "MONTHLY",
            5,
            new BigDecimal("0.5"),
            "ALL");
    BacktestResult result = sampleResult(runId);
    when(backtestEngine.run(any(BacktestRequest.class))).thenReturn(result);
    when(backtestRepository.save(result)).thenReturn(result);

    mockMvc
        .perform(
            post("/backtest/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.runId").value(runId.toString()))
        .andExpect(jsonPath("$.rebalanceFrequency").value("MONTHLY"));
  }

  @Test
  @DisplayName("POST /backtest/run returns 200 when engine returns a result")
  void shouldReturn200WhenEngineSucceeds() throws Exception {
    UUID runId = UUID.randomUUID();
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2022, 1, 1), LocalDate.of(2023, 1, 1), "QUARTERLY", 3, null, null);
    BacktestResult result = sampleResult(runId);
    when(backtestEngine.run(any(BacktestRequest.class))).thenReturn(result);
    when(backtestRepository.save(result)).thenReturn(result);

    mockMvc
        .perform(
            post("/backtest/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.runId").value(runId.toString()));
  }

  @Test
  @DisplayName("GET /backtest/{runId} returns 200 for existing run")
  void shouldReturnBacktestResult() throws Exception {
    UUID runId = UUID.randomUUID();
    BacktestResult result = sampleResult(runId);
    when(backtestRepository.findByRunId(runId)).thenReturn(Optional.of(result));

    mockMvc
        .perform(get("/backtest/{runId}", runId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.runId").value(runId.toString()));
  }

  @Test
  @DisplayName("GET /backtest/{runId} returns 404 for unknown run")
  void shouldReturn404ForUnknownRun() throws Exception {
    UUID runId = UUID.randomUUID();
    when(backtestRepository.findByRunId(runId)).thenReturn(Optional.empty());

    mockMvc.perform(get("/backtest/{runId}", runId)).andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("GET /backtest/recent returns list of recent runs")
  void shouldReturnRecentRuns() throws Exception {
    when(backtestRepository.findRecent(10)).thenReturn(List.of(sampleResult(UUID.randomUUID())));

    mockMvc
        .perform(get("/backtest/recent"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @DisplayName("POST /backtest/frequency-sweep returns 3 rows (WEEKLY/MONTHLY/QUARTERLY)")
  void shouldReturnFrequencySweepResults() throws Exception {
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2022, 1, 1), LocalDate.of(2024, 1, 1), "MONTHLY", 5, null, null);
    when(backtestEngine.run(any(BacktestRequest.class))).thenReturn(sampleResult(null));

    mockMvc
        .perform(
            post("/backtest/frequency-sweep")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(3));
  }

  @Test
  @DisplayName("POST /backtest/sweep returns 12 rows (topN 1–12)")
  void shouldReturnSweepResults() throws Exception {
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2022, 1, 1), LocalDate.of(2024, 1, 1), "MONTHLY", 5, null, null);
    // engine.run() is called once per topN value; stub for any topN
    when(backtestEngine.run(any(BacktestRequest.class))).thenReturn(sampleResult(null));

    mockMvc
        .perform(
            post("/backtest/sweep")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(12));
  }
}
