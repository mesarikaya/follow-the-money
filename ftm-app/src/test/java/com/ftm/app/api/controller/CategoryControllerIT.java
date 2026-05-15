package com.ftm.app.api.controller;

import com.ftm.app.api.service.CategoryService;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
        mockMvc.perform(get("/api/v1/categories").param("timeframe", "INVALID"))
                .andExpect(status().isUnprocessableEntity());
    }
}
