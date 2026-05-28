package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.service.CategoryService;
import java.time.LocalDate;
import java.util.List;
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
class CategoryControllerIT {

  @Autowired WebApplicationContext webApplicationContext;

  @MockitoBean CategoryService categoryService;

  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
  }

  @Test
  @DisplayName("GET /api/v1/categories?timeframe=INVALID returns 422 Unprocessable Entity")
  void shouldReturn422ForInvalidTimeframe() throws Exception {
    mockMvc
        .perform(get("/api/v1/categories").param("timeframe", "INVALID"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/categories returns 200 OK with valid timeframe")
  void shouldReturn200ForValidTimeframe() throws Exception {
    when(categoryService.getCategoriesResponse(anyString()))
        .thenReturn(new CategoriesResponse(LocalDate.now(), "MONTH", List.of()));

    mockMvc
        .perform(get("/api/v1/categories").param("timeframe", "MONTH"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeframe").value("MONTH"));
  }

  @Test
  @DisplayName("GET /api/v1/categories/score-history returns 200 with default days")
  void shouldReturn200ForScoreHistoryWithDefaultDays() throws Exception {
    when(categoryService.getCompositeScoreHistory(anyInt())).thenReturn(Map.of());

    mockMvc
        .perform(get("/api/v1/categories/score-history"))
        .andExpect(status().isOk());
  }

  @Test
  @DisplayName("GET /api/v1/categories/score-history?days=4 returns 422 (below @Min(5))")
  void shouldReturn422WhenDaysBelowMinimum() throws Exception {
    mockMvc
        .perform(get("/api/v1/categories/score-history").param("days", "4"))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  @DisplayName("GET /api/v1/categories/score-history?days=121 returns 422 (above @Max(120))")
  void shouldReturn422WhenDaysAboveMaximum() throws Exception {
    mockMvc
        .perform(get("/api/v1/categories/score-history").param("days", "121"))
        .andExpect(status().isUnprocessableEntity());
  }
}
