package com.ftm.app.api.controller;

import com.ftm.app.api.dto.ApproachingSignalDto;
import com.ftm.app.api.service.CategoryService;
import com.ftm.app.api.service.SignalTransitionPredictor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/categories/approaching")
@Tag(
    name = "Signal Predictions",
    description = "Momentum-velocity projections for upcoming trade signal threshold crossings")
public class SignalTransitionPredictorController {

  private final CategoryService categoryService;
  private final SignalTransitionPredictor signalTransitionPredictor;

  public SignalTransitionPredictorController(
      CategoryService categoryService, SignalTransitionPredictor signalTransitionPredictor) {
    this.categoryService = categoryService;
    this.signalTransitionPredictor = signalTransitionPredictor;
  }

  @Operation(
      summary = "Upcoming signal transitions within 30 trading days",
      description =
          "Projects which categories are approaching the next trade signal threshold (BUY / WATCH / REDUCE) "
              + "based on their current 5-day momentum velocity. "
              + "Assumptions: momentum continues at the 5-day rate; only transitions within 1–30 days are returned. "
              + "Sorted by estimated days ascending — most imminent transitions first.")
  @GetMapping
  public ResponseEntity<List<ApproachingSignalDto>> getApproachingSignals(
      @RequestParam(defaultValue = "60d") String timeframe) {

    List<ApproachingSignalDto> predictions =
        signalTransitionPredictor.projectTransitions(
            categoryService.getCategoriesResponse(timeframe).categories());

    return ResponseEntity.ok(predictions);
  }
}
