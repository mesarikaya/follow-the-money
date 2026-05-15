package com.ftm.app.api.controller;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.ingestion.service.IngestTriggerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class IngestControllerTest {

    @Mock IngestTriggerService ingestTriggerService;
    MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new IngestController(ingestTriggerService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void trigger_returns202WithRunIds() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.trigger()).thenReturn(
                new IngestTriggerResponse(List.of(runId, UUID.randomUUID()), "queued", "Ingestion started"));

        mockMvc.perform(post("/ingest/trigger"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("queued"));
    }

    @Test
    void getStatus_returns200_forExistingRun() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.getStatus(runId)).thenReturn(statusResponse(runId, "prices", "success"));

        mockMvc.perform(get("/ingest/status/{runId}", runId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("prices"))
                .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    void getStatus_returns404_whenRunNotFound() throws Exception {
        UUID runId = UUID.randomUUID();
        when(ingestTriggerService.getStatus(runId)).thenThrow(new NoSuchElementException("not found"));

        mockMvc.perform(get("/ingest/status/{runId}", runId))
                .andExpect(status().isNotFound());
    }

    @Test
    void getLatest_returns200WithList() throws Exception {
        when(ingestTriggerService.getLatestPerSource()).thenReturn(
                List.of(statusResponse(UUID.randomUUID(), "prices", "success"),
                        statusResponse(UUID.randomUUID(), "macro", "running")));

        mockMvc.perform(get("/ingest/status/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private IngestStatusResponse statusResponse(UUID runId, String source, String status) {
        return new IngestStatusResponse(runId, source, status, OffsetDateTime.now(), null, 0);
    }
}
