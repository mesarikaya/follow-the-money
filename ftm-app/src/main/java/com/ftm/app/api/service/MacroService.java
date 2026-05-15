package com.ftm.app.api.service;

import com.ftm.app.api.dto.MacroIndicatorsDto;
import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.repository.MacroIndicatorRepository;
import com.ftm.app.domain.MacroIndicator;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MacroService {

    // Hardcoded until EP-007 implements regime classification (see DECISIONS.md D-008)
    private static final String HARDCODED_REGIME = "RISK_ON_GROWTH";

    private final MacroIndicatorRepository macroIndicatorRepository;

    public MacroService(MacroIndicatorRepository macroIndicatorRepository) {
        this.macroIndicatorRepository = macroIndicatorRepository;
    }

    @Cacheable("macro-latest")
    @Transactional(readOnly = true)
    public MacroResponse getMacroResponse() {
        Map<String, BigDecimal> latest = macroIndicatorRepository.findLatestPerSeries()
                .stream()
                .collect(Collectors.toMap(MacroIndicator::getSeriesId, MacroIndicator::getValue));

        LocalDate asOfDate = macroIndicatorRepository.findLatestPerSeries()
                .stream()
                .map(MacroIndicator::getObservationDate)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());

        MacroIndicatorsDto indicators = new MacroIndicatorsDto(
                latest.get("T10Y2Y"),
                latest.get("VIXCLS"),
                latest.get("DTWEXBGS"),
                latest.get("T10YIE"),
                latest.get("FEDFUNDS"),
                latest.get("DGS10"),
                latest.get("DGS2")
        );

        // Regime history computed by EP-007; return single current entry for now
        List<MacroRegimeHistoryEntry> regimeHistory = List.of(
                new MacroRegimeHistoryEntry(LocalDate.now(), HARDCODED_REGIME)
        );

        return new MacroResponse(asOfDate, HARDCODED_REGIME, indicators, regimeHistory);
    }
}
