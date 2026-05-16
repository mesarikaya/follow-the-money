package com.ftm.app.signals.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.SignalRepository;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import static com.ftm.app.jooq.Tables.BENCHMARK_PRICES;
import static com.ftm.app.jooq.Tables.RAW_PRICES;
import static org.jooq.impl.DSL.*;

@Service
public class SignalComputationService {

    private static final Logger log = LoggerFactory.getLogger(SignalComputationService.class);

    private static final int LOOKBACK_DAYS = 365;
    private static final int MOM_LAG = 10;

    private static final int RRG_RS_PERIOD    = 20;
    private static final int RRG_RATIO_EMA   = 10;
    private static final int RRG_MOM_EMA     = 5;

    private final CategoryRepository categoryRepository;
    private final SignalRepository signalRepository;
    private final RelativeStrengthCalculator rsCalc;
    private final RrgCalculator rrgCalc;
    private final MacroRegimeService macroRegimeService;
    private final CompositeScoreService compositeScoreService;
    private final DSLContext dsl;
    private final ApplicationEventPublisher events;

    public SignalComputationService(
            CategoryRepository categoryRepository,
            SignalRepository signalRepository,
            RelativeStrengthCalculator rsCalc,
            RrgCalculator rrgCalc,
            MacroRegimeService macroRegimeService,
            CompositeScoreService compositeScoreService,
            DSLContext dsl,
            ApplicationEventPublisher events) {
        this.categoryRepository    = categoryRepository;
        this.signalRepository      = signalRepository;
        this.rsCalc                = rsCalc;
        this.rrgCalc               = rrgCalc;
        this.macroRegimeService    = macroRegimeService;
        this.compositeScoreService = compositeScoreService;
        this.dsl                   = dsl;
        this.events                = events;
    }

    @Transactional
    public void computeAndStore() {
        LocalDate signalDate = resolveSignalDate();
        if (signalDate == null) {
            log.warn("No price data found; skipping signal computation");
            return;
        }
        log.info("Computing signals for signal_date={}", signalDate);

        List<Category> categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        Map<String, List<BigDecimal>> categoryPricesByCategoryId  = loadCategoryPrices(signalDate);
        Map<String, List<BigDecimal>> benchmarkPricesByTicker     = loadBenchmarkPrices(signalDate);

        List<SignalRepository.Row> rows = new ArrayList<>();

        Map<String, BigDecimal> rs60ByCategoryId         = new HashMap<>();
        Map<String, BigDecimal> flow20DayByCategoryId    = new HashMap<>();
        Map<String, BigDecimal> momentumByCategoryId     = new HashMap<>();
        Map<String, BigDecimal> rrgQuadrantByCategoryId  = new HashMap<>();

        for (Category category : categories) {
            String categoryId = category.id().name();
            List<BigDecimal> categoryPrices  = categoryPricesByCategoryId.getOrDefault(categoryId, List.of());
            List<BigDecimal> benchmarkPrices = benchmarkPricesByTicker.getOrDefault(category.benchmarkTicker(), List.of());

            BigDecimal rs20  = rsCalc.computeRs(categoryPrices, benchmarkPrices, 20);
            BigDecimal rs60  = rsCalc.computeRs(categoryPrices, benchmarkPrices, 60);
            BigDecimal rs120 = rsCalc.computeRs(categoryPrices, benchmarkPrices, 120);
            BigDecimal momentum = rsCalc.computeMom(categoryPrices, benchmarkPrices, MOM_LAG);

            addIfNotNull(rows, signalDate, categoryId, SignalType.RS_20,  rs20);
            addIfNotNull(rows, signalDate, categoryId, SignalType.RS_60,  rs60);
            addIfNotNull(rows, signalDate, categoryId, SignalType.RS_120, rs120);
            addIfNotNull(rows, signalDate, categoryId, SignalType.MOM,    momentum);

            if (rs60 != null) rs60ByCategoryId.put(categoryId, rs60);
            if (momentum != null) momentumByCategoryId.put(categoryId, momentum);

            List<BigDecimal> rs20Series  = rsCalc.computeRsSeries(categoryPrices, benchmarkPrices, RRG_RS_PERIOD);
            List<BigDecimal> ratioSeries = rrgCalc.computeRatioSeries(rs20Series, RRG_RATIO_EMA);
            List<BigDecimal> momentumSeries = rrgCalc.computeMomentumSeries(ratioSeries, RRG_MOM_EMA);
            BigDecimal latestRatio   = lastNonNull(ratioSeries);
            BigDecimal latestRrgMom  = lastNonNull(momentumSeries);

            addIfNotNull(rows, signalDate, categoryId, SignalType.RRG_RATIO, latestRatio);
            addIfNotNull(rows, signalDate, categoryId, SignalType.RRG_MOM,   latestRrgMom);
            if (latestRatio != null && latestRrgMom != null) {
                BigDecimal quadrant = BigDecimal.valueOf(rrgCalc.computeQuadrant(latestRatio, latestRrgMom));
                rows.add(new SignalRepository.Row(signalDate, categoryId, SignalType.RRG_QUADRANT, quadrant));
                rrgQuadrantByCategoryId.put(categoryId, quadrant);
            }
        }

        // --- EP-007: Macro regime + MACRO_FIT + COMPOSITE ---
        MacroRegime currentRegime = macroRegimeService.classifyCurrentRegime();
        Map<String, BigDecimal> macroFitByCategoryId = macroRegimeService.computeMacroFitByCategory(currentRegime);
        Map<String, BigDecimal> compositeScoresByCategoryId = compositeScoreService.computeCompositeScores(
                rs60ByCategoryId,
                flow20DayByCategoryId,
                momentumByCategoryId,
                macroFitByCategoryId,
                rrgQuadrantByCategoryId);

        BigDecimal regimeOrdinal = BigDecimal.valueOf(currentRegime.ordinal());
        for (Category category : categories) {
            String categoryId = category.id().name();
            rows.add(new SignalRepository.Row(signalDate, categoryId, SignalType.MACRO_REGIME, regimeOrdinal));
            addIfNotNull(rows, signalDate, categoryId, SignalType.MACRO_FIT,  macroFitByCategoryId.get(categoryId));
            addIfNotNull(rows, signalDate, categoryId, SignalType.COMPOSITE,  compositeScoresByCategoryId.get(categoryId));
        }

        int written = signalRepository.batchUpsert(rows);
        log.info("Signal computation complete: {} signals written for date={}, regime={}", written, signalDate, currentRegime);

        events.publishEvent(new SignalsUpdatedEvent(signalDate));
    }

    private LocalDate resolveSignalDate() {
        return dsl.select(max(RAW_PRICES.TRADE_DATE))
                .from(RAW_PRICES)
                .fetchOneInto(LocalDate.class);
    }

    private Map<String, List<BigDecimal>> loadCategoryPrices(LocalDate signalDate) {
        LocalDate from = signalDate.minusDays(LOOKBACK_DAYS);
        return dsl.select(RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE, RAW_PRICES.ADJ_CLOSE)
                .from(RAW_PRICES)
                .where(RAW_PRICES.TRADE_DATE.between(from, signalDate))
                .orderBy(RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE.asc())
                .fetch()
                .stream()
                .collect(Collectors.groupingBy(
                        r -> r.get(RAW_PRICES.CATEGORY_ID),
                        Collectors.mapping(r -> r.get(RAW_PRICES.ADJ_CLOSE), Collectors.toList())));
    }

    private Map<String, List<BigDecimal>> loadBenchmarkPrices(LocalDate signalDate) {
        LocalDate from = signalDate.minusDays(LOOKBACK_DAYS);
        return dsl.select(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE, BENCHMARK_PRICES.ADJ_CLOSE)
                .from(BENCHMARK_PRICES)
                .where(BENCHMARK_PRICES.TRADE_DATE.between(from, signalDate))
                .orderBy(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE.asc())
                .fetch()
                .stream()
                .collect(Collectors.groupingBy(
                        r -> r.get(BENCHMARK_PRICES.TICKER),
                        Collectors.mapping(r -> r.get(BENCHMARK_PRICES.ADJ_CLOSE), Collectors.toList())));
    }

    private void addIfNotNull(List<SignalRepository.Row> rows,
                              LocalDate date, String categoryId,
                              SignalType type, BigDecimal value) {
        if (value != null) {
            rows.add(new SignalRepository.Row(date, categoryId, type, value));
        }
    }

    private BigDecimal lastNonNull(List<BigDecimal> series) {
        for (int i = series.size() - 1; i >= 0; i--) {
            BigDecimal v = series.get(i);
            if (v != null) return v;
        }
        return null;
    }
}
