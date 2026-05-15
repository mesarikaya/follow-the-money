package com.ftm.app.api.service;

import com.ftm.app.api.dto.MacroIndicatorsDto;
import com.ftm.app.api.dto.MacroRegimeHistoryEntry;
import com.ftm.app.api.dto.MacroResponse;
import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MacroService {

    private static final Logger log = LoggerFactory.getLogger(MacroService.class);

    // Hardcoded until EP-007 implements regime classification (see DECISIONS.md D-008)
    private static final String HARDCODED_REGIME = "RISK_ON_GROWTH";

    private final MacroIndicatorReadRepository macroIndicatorRepository;

    public MacroService(MacroIndicatorReadRepository macroIndicatorRepository) {
        this.macroIndicatorRepository = macroIndicatorRepository;
    }

    @Cacheable("macro-latest")
    public MacroResponse getMacroResponse() {
        log.debug("Loading latest macro indicators");
        List<MacroIndicator> indicators = macroIndicatorRepository.findLatestPerSeries();

        Map<String, BigDecimal> latest = indicators.stream()
                .collect(Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value));

        LocalDate asOfDate = indicators.stream()
                .map(MacroIndicator::observationDate)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());

        MacroIndicatorsDto indicatorsDto = new MacroIndicatorsDto(
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

        return new MacroResponse(asOfDate, HARDCODED_REGIME, indicatorsDto, regimeHistory);
    }
}
