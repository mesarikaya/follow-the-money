package com.ftm.app.api.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.exceptions.GlobalExceptionHandler;
import com.ftm.app.api.service.CategoryService;
import java.time.LocalDate;
import java.util.List;
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
        .thenReturn(new CategoriesResponse(LocalDate.now(), "MONTH", List.of()));

    mockMvc
        .perform(get("/categories"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeframe").value("MONTH"));
  }

  @Test
  @DisplayName("GET /categories?timeframe=WEEK returns 200 OK")
  void shouldReturn200ForValidTimeframe() throws Exception {
    when(categoryService.getCategoriesResponse("WEEK"))
        .thenReturn(new CategoriesResponse(LocalDate.now(), "WEEK", List.of()));

    mockMvc
        .perform(get("/categories").param("timeframe", "WEEK"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeframe").value("WEEK"));
  }
}
