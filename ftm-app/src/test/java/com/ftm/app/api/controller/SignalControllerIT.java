package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.api.service.SignalHistoryService;
import com.ftm.app.signals.service.SignalComputationService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// Full Spring context required: WebMvcConfig adds /api/v1 prefix and wires HandlerMethodValidator
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@ActiveProfiles("test")
class SignalControllerIT {

  @Autowired WebApplicationContext webApplicationContext;

  @MockitoBean SignalHistoryService signalHistoryService;
  @MockitoBean SignalComputationService signalComputationService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
  }

  @Test
  @DisplayName("GET /api/v1/signals/TECH returns 200 with default days")
  void shouldReturn200WithDefaultDays() throws Exception {
    when(signalHistoryService.getHistory(anyString(), anyInt())).thenReturn(List.of());

    mockMvc.perform(get("/api/v1/signals/TECH")).andExpect(status().isOk());
  }

  @Test
  @DisplayName("GET /api/v1/signals/TECH?days=-1 returns 422 (below @Min(0))")
  void shouldReturn422WhenDaysBelowMinimum() throws Exception {
    mockMvc
        .perform(get("/api/v1/signals/TECH").param("days", "-1"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/signals/TECH?days=3651 returns 422 (above @Max(3650))")
  void shouldReturn422WhenDaysAboveMaximum() throws Exception {
    mockMvc
        .perform(get("/api/v1/signals/TECH").param("days", "3651"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/signals/TECH?days=90 returns 200 for valid days")
  void shouldReturn200ForValidDays() throws Exception {
    when(signalHistoryService.getHistory(anyString(), anyInt())).thenReturn(List.of());

    mockMvc
        .perform(get("/api/v1/signals/TECH").param("days", "90"))
        .andExpect(status().isOk());
  }
}
