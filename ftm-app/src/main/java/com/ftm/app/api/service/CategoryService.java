package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Cacheable("signals-latest")
    public CategoriesResponse getCategoriesResponse(String timeframe) {
        log.debug("Loading categories for timeframe={}", timeframe);
        var rows = categoryRepository.findAllWithLatestPrice();
        AtomicInteger rank = new AtomicInteger(1);
        List<CategorySummaryDto> dtos = rows.stream()
                .map(row -> toDto(row, rank.getAndIncrement()))
                .toList();
        return new CategoriesResponse(LocalDate.now(), timeframe, dtos);
    }

    private CategorySummaryDto toDto(CategoryRepository.CategoryPriceRow row, int rank) {
        var c = row.category();
        // Signal fields are null until EP-005 computes them.
        return new CategorySummaryDto(
                c.id(),
                c.name(),
                c.type().name(),
                c.etfTicker(),
                null, null, null, null, null, null,
                rank,
                row.latestClose(),
                row.priceDate()
        );
    }
}
