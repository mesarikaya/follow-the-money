package com.ftm.app.signals.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
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

    private final CategoryRepository categoryRepository;
    private final SignalRepository signalRepository;
    private final RelativeStrengthCalculator rsCalc;
    private final DSLContext dsl;
    private final ApplicationEventPublisher events;

    public SignalComputationService(
            CategoryRepository categoryRepository,
            SignalRepository signalRepository,
            RelativeStrengthCalculator rsCalc,
            DSLContext dsl,
            ApplicationEventPublisher events) {
        this.categoryRepository = categoryRepository;
        this.signalRepository   = signalRepository;
        this.rsCalc             = rsCalc;
        this.dsl                = dsl;
        this.events             = events;
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
        Map<String, List<BigDecimal>> catPrices   = loadCategoryPrices(signalDate);
        Map<String, List<BigDecimal>> benchPrices = loadBenchmarkPrices(signalDate);

        List<SignalRepository.Row> rows = new ArrayList<>();
        for (Category cat : categories) {
            List<BigDecimal> cp = catPrices.getOrDefault(cat.id().name(), List.of());
            List<BigDecimal> bp = benchPrices.getOrDefault(cat.benchmarkTicker(), List.of());

            BigDecimal rs20  = rsCalc.computeRs(cp, bp, 20);
            BigDecimal rs60  = rsCalc.computeRs(cp, bp, 60);
            BigDecimal rs120 = rsCalc.computeRs(cp, bp, 120);
            BigDecimal mom   = rsCalc.computeMom(cp, bp, MOM_LAG);

            addIfNotNull(rows, signalDate, cat.id().name(), SignalType.RS_20,  rs20);
            addIfNotNull(rows, signalDate, cat.id().name(), SignalType.RS_60,  rs60);
            addIfNotNull(rows, signalDate, cat.id().name(), SignalType.RS_120, rs120);
            addIfNotNull(rows, signalDate, cat.id().name(), SignalType.MOM,    mom);
        }

        int written = signalRepository.batchUpsert(rows);
        log.info("Signal computation complete: {} signals written for date={}", written, signalDate);

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
}
