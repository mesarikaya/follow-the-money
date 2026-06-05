package com.ftm.app.api.controller;

import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.dto.MacroSeriesPoint;
import com.ftm.app.api.service.MacroService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/macro")
@Tag(name = "Macro", description = "Macro indicators and regime classification")
public class MacroController {

  private final MacroService macroService;

  public MacroController(MacroService macroService) {
    this.macroService = macroService;
  }

  @GetMapping
  @Operation(summary = "Latest FRED macro indicators and regime classification")
  public ResponseEntity<MacroResponse> getMacro() {
    return ResponseEntity.ok(macroService.getMacroResponse());
  }

  @GetMapping("/history")
  @Operation(summary = "Historical FRED series data for macro sparklines")
  public ResponseEntity<Map<String, List<MacroSeriesPoint>>> getMacroHistory(
      @RequestParam(defaultValue = "365") int days) {
    return ResponseEntity.ok(macroService.getMacroHistory(days));
  }
}
