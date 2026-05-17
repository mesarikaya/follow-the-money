package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    private final CategoryRepository categoryRepository;
    private final SignalRepository signalRepository;
    private final CategoryMapper categoryMapper;

    public CategoryService(CategoryRepository categoryRepository,
                           SignalRepository signalRepository,
                           CategoryMapper categoryMapper) {
        this.categoryRepository = categoryRepository;
        this.signalRepository   = signalRepository;
        this.categoryMapper     = categoryMapper;
    }

    @Cacheable("signals-latest")
    public CategoriesResponse getCategoriesResponse(String timeframe) {
        log.debug("Loading categories for timeframe={}", timeframe);
        var rows = categoryRepository.findAllWithLatestPrice();
        Map<String, BigDecimal> rs60ByCategoryId        = signalRepository.findLatestByType(SignalType.RS_60);
        Map<String, BigDecimal> compositeByCategoryId   = signalRepository.findLatestByType(SignalType.COMPOSITE);
        Map<String, BigDecimal> rrgQuadrantByCategoryId = signalRepository.findLatestByType(SignalType.RRG_QUADRANT);

        var sortedRows = rows.stream()
                .sorted(Comparator.comparing(
                        row -> compositeByCategoryId.getOrDefault(row.category().id().name(), BigDecimal.ZERO),
                        Comparator.reverseOrder()))
                .toList();

        AtomicInteger rank = new AtomicInteger(1);
        var categorySummaryDtos = sortedRows.stream()
                .map(row -> categoryMapper.toDto(row, rank.getAndIncrement(), rs60ByCategoryId, compositeByCategoryId, rrgQuadrantByCategoryId))
                .toList();
        return new CategoriesResponse(LocalDate.now(), timeframe, categorySummaryDtos);
    }
}
