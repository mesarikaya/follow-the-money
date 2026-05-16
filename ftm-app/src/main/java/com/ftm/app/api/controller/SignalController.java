package com.ftm.app.api.controller;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.signals.repository.SignalRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@Tag(name = "Signals", description = "Signal history per category")
public class SignalController {

    private final SignalRepository signalRepository;

    public SignalController(SignalRepository signalRepository) {
        this.signalRepository = signalRepository;
    }

    @GetMapping("/signals/{categoryId}")
    @Operation(summary = "Full signal history for a category")
    public List<SignalHistoryDto> getSignalHistory(@PathVariable String categoryId) {
        return signalRepository.findByCategoryId(categoryId.toUpperCase()).stream()
                .map(r -> new SignalHistoryDto(r.signalDate(), r.signalType(), r.value(), r.computedAt()))
                .toList();
    }
}
