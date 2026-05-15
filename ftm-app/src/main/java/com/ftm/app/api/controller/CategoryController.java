package com.ftm.app.api.controller;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/categories")
@Validated
@Tag(name = "Categories", description = "Investable category list with latest rotation signals")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @Operation(summary = "All 19 categories with latest composite score and RRG quadrant")
    public ResponseEntity<CategoriesResponse> getCategories(
            @RequestParam(defaultValue = "MONTH")
            @Pattern(regexp = "DAY|WEEK|MONTH|QUARTER|YEAR", message = "timeframe must be one of DAY, WEEK, MONTH, QUARTER, YEAR")
            String timeframe) {
        return ResponseEntity.ok(categoryService.getCategoriesResponse(timeframe));
    }
}
