package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    private final CategoryRepository categoryRepository;
    private final SignalRepository signalRepository;

    public CategoryService(CategoryRepository categoryRepository, SignalRepository signalRepository) {
        this.categoryRepository = categoryRepository;
        this.signalRepository   = signalRepository;
    }

    @Cacheable("signals-latest")
    public CategoriesResponse getCategoriesResponse(String timeframe) {
        log.debug("Loading categories for timeframe={}", timeframe);
        var rows = categoryRepository.findAllWithLatestPrice();
        Map<String, BigDecimal> rs60 = signalRepository.findLatestByType(SignalType.RS_60);
        AtomicInteger rank = new AtomicInteger(1);
        List<CategorySummaryDto> dtos = rows.stream()
                .map(row -> toDto(row, rank.getAndIncrement(), rs60))
                .toList();
        return new CategoriesResponse(LocalDate.now(), timeframe, dtos);
    }

    private CategorySummaryDto toDto(CategoryRepository.CategoryPriceRow row, int rank,
                                     Map<String, BigDecimal> rs60ByCategory) {
        var c = row.category();
        return new CategorySummaryDto(
                c.id(),
                c.name(),
                c.type().name(),
                c.etfTicker(),
                null,
                null,
                null,
                rs60ByCategory.get(c.id().name()),
                null,
                null,
                rank,
                row.latestClose(),
                row.priceDate()
        );
    }
}
