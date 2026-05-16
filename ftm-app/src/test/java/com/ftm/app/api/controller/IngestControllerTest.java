package com.ftm.app.api.controller;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.ingestion.service.IngestTriggerService;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.instancio.Select.field;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class IngestControllerTest {

    @Mock
    IngestTriggerService ingestTriggerService;
    MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new IngestController(ingestTriggerService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private IngestStatusResponse statusResponse(UUID runId, String source, String status) {
        return Instancio.of(IngestStatusResponse.class)
                .set(field(IngestStatusResponse::runId), runId)
                .set(field(IngestStatusResponse::source), source)
                .set(field(IngestStatusResponse::status), status)
                .create();
    }

    @Test
    @DisplayName("POST /ingest/trigger returns 202 Accepted with run IDs")
    void shouldReturn202WithRunIds() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.trigger()).thenReturn(
                new IngestTriggerResponse(List.of(runId, UUID.randomUUID()), "queued", "Ingestion started"));

        mockMvc.perform(post("/ingest/trigger"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("queued"));
    }

    @Test
    @DisplayName("GET /ingest/status/{runId} returns 200 OK for existing run")
    void shouldReturn200ForExistingRun() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.getStatus(runId)).thenReturn(statusResponse(runId, "prices", "success"));

        mockMvc.perform(get("/ingest/status/{runId}", runId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("prices"))
                .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @DisplayName("GET /ingest/status/{runId} returns 404 when run is not found")
    void shouldReturn404WhenRunNotFound() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.getStatus(runId)).thenThrow(new NoSuchElementException("not found"));

        mockMvc.perform(get("/ingest/status/{runId}", runId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /ingest/status/latest returns 200 OK with list of latest logs")
    void shouldReturn200WithLatestLogList() throws Exception {
        when(ingestTriggerService.getLatestPerSource()).thenReturn(
                List.of(statusResponse(UUID.randomUUID(), "prices", "success"),
                        statusResponse(UUID.randomUUID(), "macro", "running")));

        mockMvc.perform(get("/ingest/status/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }
}
