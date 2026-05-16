package com.ftm.app.api.controller;

import com.ftm.app.api.dto.RrgResponse;
import com.ftm.app.api.service.RrgService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "RRG", description = "Relative Rotation Graph chart data")
public class RrgController {

    private final RrgService rrgService;

    public RrgController(RrgService rrgService) {
        this.rrgService = rrgService;
    }

    @GetMapping("/api/v1/rrg")
    @Operation(summary = "RRG chart data — last 42 trading days per active category")
    public RrgResponse getLatest() {
        return rrgService.getLatest();
    }
}
