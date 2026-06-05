package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.service.MacroService;
import java.util.Map;
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
class MacroControllerIT {

  @Autowired WebApplicationContext webApplicationContext;

  @MockitoBean MacroService macroService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
  }

  @Test
  @DisplayName("GET /api/v1/macro/history returns 200 with default days")
  void shouldReturn200WithDefaultDays() throws Exception {
    when(macroService.getMacroHistory(anyInt())).thenReturn(Map.of());

    mockMvc.perform(get("/api/v1/macro/history")).andExpect(status().isOk());
  }

  @Test
  @DisplayName("GET /api/v1/macro/history?days=6 returns 422 (below @Min(7))")
  void shouldReturn422WhenDaysBelowMinimum() throws Exception {
    mockMvc
        .perform(get("/api/v1/macro/history").param("days", "6"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/macro/history?days=3651 returns 422 (above @Max(3650))")
  void shouldReturn422WhenDaysAboveMaximum() throws Exception {
    mockMvc
        .perform(get("/api/v1/macro/history").param("days", "3651"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/macro/history?days=365 returns 200 for valid boundary value")
  void shouldReturn200ForValidDays() throws Exception {
    when(macroService.getMacroHistory(anyInt())).thenReturn(Map.of());

    mockMvc
        .perform(get("/api/v1/macro/history").param("days", "365"))
        .andExpect(status().isOk());
  }
}
