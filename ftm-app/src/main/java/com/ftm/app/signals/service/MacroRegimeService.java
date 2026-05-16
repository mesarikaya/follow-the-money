package com.ftm.app.signals.service;

import com.ftm.app.api.repository.MacroIndicatorReadRepository;
import com.ftm.app.domain.MacroIndicator;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Applies the D-008 macro regime classification rules to live FRED data.
 * Also computes the MACRO_FIT win-rate per category:
 * the fraction of historical days under the current regime where RS_60 was positive.
 */
@Service
public class MacroRegimeService {

    private static final Logger log = LoggerFactory.getLogger(MacroRegimeService.class);

    private static final String FRED_SERIES_TEN_YEAR_TWO_YEAR_YIELD_SPREAD = "T10Y2Y";
    private static final String FRED_SERIES_VIX                            = "VIXCLS";
    private static final String FRED_SERIES_BREAKEVEN_INFLATION            = "T10YIE";

    private static final Set<String> REQUIRED_SERIES = Set.of(
            FRED_SERIES_TEN_YEAR_TWO_YEAR_YIELD_SPREAD,
            FRED_SERIES_VIX,
            FRED_SERIES_BREAKEVEN_INFLATION
    );

    private static final int MACRO_HISTORY_LOOKBACK_YEARS = 2;

    private final MacroIndicatorReadRepository macroIndicatorRepository;
    private final SignalRepository signalRepository;
    private final MacroRegimeClassifier regimeClassifier;

    public MacroRegimeService(MacroIndicatorReadRepository macroIndicatorRepository,
                              SignalRepository signalRepository,
                              MacroRegimeClassifier regimeClassifier) {
        this.macroIndicatorRepository = macroIndicatorRepository;
        this.signalRepository = signalRepository;
        this.regimeClassifier = regimeClassifier;
    }

    /**
     * Classifies the current macro regime from the latest available FRED indicator values.
     */
    public MacroRegime classifyCurrentRegime() {
        List<MacroIndicator> latestIndicators = macroIndicatorRepository.findLatestPerSeries();
        Map<String, BigDecimal> latestBySeriesId = latestIndicators.stream()
                .filter(indicator -> REQUIRED_SERIES.contains(indicator.seriesId()))
                .collect(Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value));

        MacroRegime regime = regimeClassifier.classify(
                latestBySeriesId.get(FRED_SERIES_TEN_YEAR_TWO_YEAR_YIELD_SPREAD),
                latestBySeriesId.get(FRED_SERIES_VIX),
                latestBySeriesId.get(FRED_SERIES_BREAKEVEN_INFLATION)
        );

        log.info("Current macro regime classified as: {}", regime);
        return regime;
    }

    /**
     * Computes the MACRO_FIT win-rate per category for the given regime.
     * Win-rate = fraction of historical days under that regime where RS_60 was positive (> 0).
     * Returns a value in [0.0, 1.0] per category, or null if insufficient data.
     */
    public Map<String, BigDecimal> computeMacroFitByCategory(MacroRegime currentRegime) {
        LocalDate lookbackFrom = LocalDate.now().minusYears(MACRO_HISTORY_LOOKBACK_YEARS);

        List<MacroIndicator> historicalIndicators =
                macroIndicatorRepository.findHistoricalForSeries(REQUIRED_SERIES, lookbackFrom);

        Map<LocalDate, Map<String, BigDecimal>> byDate = historicalIndicators.stream()
                .collect(Collectors.groupingBy(
                        MacroIndicator::observationDate,
                        Collectors.toMap(MacroIndicator::seriesId, MacroIndicator::value)));

        List<LocalDate> datesMatchingCurrentRegime = byDate.entrySet().stream()
                .filter(entry -> hasAllRequiredSeries(entry.getValue()))
                .filter(entry -> currentRegime == regimeClassifier.classify(
                        entry.getValue().get(FRED_SERIES_TEN_YEAR_TWO_YEAR_YIELD_SPREAD),
                        entry.getValue().get(FRED_SERIES_VIX),
                        entry.getValue().get(FRED_SERIES_BREAKEVEN_INFLATION)
                ))
                .map(Map.Entry::getKey)
                .toList();

        if (datesMatchingCurrentRegime.isEmpty()) {
            log.warn("No historical dates found matching regime {}; MACRO_FIT will be empty", currentRegime);
            return Map.of();
        }

        log.debug("Found {} historical dates matching regime {}", datesMatchingCurrentRegime.size(), currentRegime);

        Map<LocalDate, Map<String, BigDecimal>> relativeStrength60DayByDate =
                signalRepository.findByTypeForDates(SignalType.RS_60, datesMatchingCurrentRegime);

        return computeWinRates(datesMatchingCurrentRegime, relativeStrength60DayByDate);
    }

    private boolean hasAllRequiredSeries(Map<String, BigDecimal> seriesValues) {
        return REQUIRED_SERIES.stream().allMatch(seriesId -> seriesValues.get(seriesId) != null);
    }

    private Map<String, BigDecimal> computeWinRates(List<LocalDate> regimeDates,
                                                    Map<LocalDate, Map<String, BigDecimal>> relativeStrength60DayByDate) {
        Map<String, Integer> positiveCount = new HashMap<>();
        Map<String, Integer> totalCount = new HashMap<>();

        for (LocalDate date : regimeDates) {
            Map<String, BigDecimal> relativeStrength60DayByCategory = relativeStrength60DayByDate.get(date);
            if (relativeStrength60DayByCategory == null) continue;

            for (Map.Entry<String, BigDecimal> entry : relativeStrength60DayByCategory.entrySet()) {
                String categoryId = entry.getKey();
                BigDecimal relativeStrength60Day = entry.getValue();

                if (relativeStrength60Day == null) continue;

                totalCount.merge(categoryId, 1, Integer::sum);
                if (relativeStrength60Day.compareTo(BigDecimal.ZERO) > 0) {
                    positiveCount.merge(categoryId, 1, Integer::sum);
                }
            }
        }

        Map<String, BigDecimal> winRates = new HashMap<>();
        for (String categoryId : totalCount.keySet()) {
            int total = totalCount.get(categoryId);
            int positive = positiveCount.getOrDefault(categoryId, 0);
            winRates.put(categoryId,
                    BigDecimal.valueOf(positive)
                            .divide(BigDecimal.valueOf(total), 6, RoundingMode.HALF_UP));
        }

        return winRates;
    }
}
