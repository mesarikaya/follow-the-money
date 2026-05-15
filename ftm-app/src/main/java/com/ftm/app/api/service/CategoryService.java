package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Cacheable("signals-latest")
    @Transactional(readOnly = true)
    public CategoriesResponse getCategoriesResponse(String timeframe) {
        List<Category> categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        AtomicInteger rank = new AtomicInteger(1);
        List<CategorySummaryDto> dtos = categories.stream()
                .map(c -> toDto(c, rank.getAndIncrement()))
                .toList();
        return new CategoriesResponse(LocalDate.now(), timeframe, dtos);
    }

    private CategorySummaryDto toDto(Category category, int rank) {
        // Signal fields are null until EP-005 computes them.
        return new CategorySummaryDto(
                category.getId(),
                category.getName(),
                category.getType().name(),
                category.getEtfTicker(),
                null, null, null, null, null, null,
                rank
        );
    }
}
