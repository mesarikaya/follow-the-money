package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.service.AlertService;
import java.util.List;
import java.util.NoSuchElementException;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class AlertControllerTest {

  @Mock AlertService alertService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new AlertController(alertService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private AlertDto activeAlert(Long id) {
    return Instancio.of(AlertDto.class)
        .set(field(AlertDto::id), id)
        .set(field(AlertDto::categoryId), "TECH")
        .set(field(AlertDto::status), "ACTIVE")
        .create();
  }

  @Test
  @DisplayName("GET /alerts returns active count and alert list")
  void shouldReturnAlerts() throws Exception {
    AlertDto alert = activeAlert(1L);
    when(alertService.getAlerts()).thenReturn(new AlertsResponse(1, List.of(alert)));

    mockMvc
        .perform(get("/alerts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.activeCount").value(1))
        .andExpect(jsonPath("$.alerts.length()").value(1))
        .andExpect(jsonPath("$.alerts[0].categoryId").value("TECH"))
        .andExpect(jsonPath("$.alerts[0].status").value("ACTIVE"));
  }

  @Test
  @DisplayName("GET /alerts returns 200 with empty list when no alerts")
  void shouldReturnEmptyAlerts() throws Exception {
    when(alertService.getAlerts()).thenReturn(new AlertsResponse(0, List.of()));

    mockMvc
        .perform(get("/alerts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.activeCount").value(0))
        .andExpect(jsonPath("$.alerts.length()").value(0));
  }

  @Test
  @DisplayName("POST /alerts/{id}/acknowledge returns acknowledged alert")
  void shouldAcknowledgeAlert() throws Exception {
    AlertDto acknowledged = activeAlert(1L);
    when(alertService.acknowledgeAlert(1L)).thenReturn(acknowledged);

    mockMvc
        .perform(post("/alerts/1/acknowledge"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1));
  }

  @Test
  @DisplayName("POST /alerts/{id}/acknowledge returns 404 for unknown alert")
  void shouldReturn404ForUnknownAlert() throws Exception {
    when(alertService.acknowledgeAlert(99L))
        .thenThrow(new NoSuchElementException("Alert not found: 99"));

    mockMvc.perform(post("/alerts/99/acknowledge")).andExpect(status().isNotFound());
  }
}
