package com.ftm.app.api.controller;

import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.SeasonalReturnDto;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.service.CategoryService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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
class CategoryControllerTest {

  @Mock CategoryService categoryService;
  MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new CategoryController(categoryService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /categories returns 200 OK with default timeframe")
  void shouldReturn200WithDefaultTimeframe() throws Exception {
    when(categoryService.getCategoriesResponse(anyString()))
        .thenReturn(
            Instancio.of(CategoriesResponse.class)
                .set(field(CategoriesResponse::timeframe), "MONTH")
                .set(field(CategoriesResponse::categories), List.of())
                .create());

    mockMvc
        .perform(get("/categories"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeframe").value("MONTH"));
  }

  @Test
  @DisplayName("GET /categories?timeframe=WEEK returns 200 OK")
  void shouldReturn200ForValidTimeframe() throws Exception {
    when(categoryService.getCategoriesResponse("WEEK"))
        .thenReturn(
            Instancio.of(CategoriesResponse.class)
                .set(field(CategoriesResponse::timeframe), "WEEK")
                .set(field(CategoriesResponse::categories), List.of())
                .create());

    mockMvc
        .perform(get("/categories").param("timeframe", "WEEK"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeframe").value("WEEK"));
  }

  @Test
  @DisplayName("GET /categories/score-history returns 200 with map of category histories")
  void shouldReturnScoreHistory() throws Exception {
    when(categoryService.getCompositeScoreHistory(anyInt()))
        .thenReturn(Map.of("TECH", List.of(0.70, 0.75, 0.72), "FINL", List.of(0.50, 0.55)));

    mockMvc
        .perform(get("/categories/score-history"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.TECH.length()").value(3))
        .andExpect(jsonPath("$.FINL.length()").value(2));
  }

  @Test
  @DisplayName("GET /categories/score-history?days=60 passes explicit days to service")
  void shouldPassExplicitDaysToService() throws Exception {
    when(categoryService.getCompositeScoreHistory(60)).thenReturn(Map.of("TECH", List.of(0.68)));

    mockMvc
        .perform(get("/categories/score-history").param("days", "60"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.TECH[0]").value(0.68));
  }

  @Test
  @DisplayName("GET /categories/score-history returns 200 with empty map when no history")
  void shouldReturnEmptyMapWhenNoHistory() throws Exception {
    when(categoryService.getCompositeScoreHistory(anyInt())).thenReturn(Map.of());

    mockMvc
        .perform(get("/categories/score-history"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  @DisplayName("GET /categories/seasonal returns average monthly returns per category")
  void shouldReturnSeasonalReturns() throws Exception {
    var data =
        List.of(
            new SeasonalReturnDto("TECH", 1, new BigDecimal("0.0312"), 5),
            new SeasonalReturnDto("TECH", 6, new BigDecimal("-0.0145"), 5),
            new SeasonalReturnDto("FINL", 3, new BigDecimal("0.0210"), 4));
    when(categoryService.getSeasonalReturns()).thenReturn(data);

    mockMvc
        .perform(get("/categories/seasonal"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(3))
        .andExpect(jsonPath("$[0].categoryId").value("TECH"))
        .andExpect(jsonPath("$[0].month").value(1))
        .andExpect(jsonPath("$[0].avgReturn").value(0.0312));
  }
}
