package com.ftm.app.api.repository;

import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class CategoryRepositoryIT {

    @Autowired
    CategoryRepository repository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetCategories() {
        jdbcTemplate.update("UPDATE categories SET active = true");
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc returns all 19 seeded categories")
    void shouldReturnAllActiveSeededCategories() {
        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        assertThat(categories).hasSize(19);
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc returns categories ordered by display order")
    void shouldReturnCategoriesOrderedByDisplayOrder() {
        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        assertThat(categories.get(0).id()).isEqualTo(CategoryId.TECH);
        assertThat(categories.get(18).id()).isEqualTo(CategoryId.CASH);
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc maps all fields correctly")
    void shouldMapAllCategoryFieldsCorrectly() {
        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        Category tech = categories.stream().filter(c -> c.id() == CategoryId.TECH).findFirst().orElseThrow();
        assertThat(tech.name()).isEqualTo("Information Technology");
        assertThat(tech.type()).isEqualTo(CategoryType.EQUITY_SECTOR);
        assertThat(tech.etfTicker()).isEqualTo("XLK");
        assertThat(tech.benchmarkTicker()).isEqualTo("SPY");
        assertThat(tech.displayOrder()).isEqualTo(1);
        assertThat(tech.active()).isTrue();
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc excludes inactive categories")
    void shouldExcludeInactiveCategories() {
        jdbcTemplate.update("UPDATE categories SET active = false WHERE id = 'CASH'");

        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        assertThat(categories).hasSize(18);
        assertThat(categories).extracting(Category::id).doesNotContain(CategoryId.CASH);
    }
}
