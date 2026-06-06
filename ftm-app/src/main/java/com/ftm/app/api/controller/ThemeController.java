package com.ftm.app.api.controller;

import com.ftm.app.api.dto.ThemeDetailDto;
import com.ftm.app.api.dto.ThemeSummaryDto;
import com.ftm.app.api.service.ThemeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/themes")
@Validated
@Tag(name = "Themes", description = "Cross-sector investment theme baskets with aggregated rotation signals")
public class ThemeController {

  private final ThemeService themeService;

  public ThemeController(ThemeService themeService) {
    this.themeService = themeService;
  }

  @GetMapping
  @Operation(summary = "All investment themes with aggregated composite, RS, and flow signals")
  public List<ThemeSummaryDto> getThemes() {
    return themeService.getThemes();
  }

  @GetMapping("/{themeId}")
  @Operation(summary = "Detail view for a single theme: all constituent ETFs with individual signals")
  public ThemeDetailDto getTheme(
      @PathVariable
          @Pattern(regexp = "[A-Za-z0-9_]{1,30}", message = "themeId must be 1–30 alphanumeric characters")
          String themeId) {
    return themeService.getTheme(themeId.toUpperCase());
  }
}
