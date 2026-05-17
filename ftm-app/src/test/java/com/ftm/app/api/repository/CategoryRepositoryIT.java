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

import java.math.BigDecimal;
import java.time.LocalDate;
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
        jdbcTemplate.update("UPDATE categories SET active = true WHERE id <> 'FTRS'");
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc returns all active categories including sub-sectors and factor ETFs")
    void shouldReturnAllActiveSeededCategories() {
        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        // 19 top-level + 4 TECH sub-sectors (V7) + 4 factor ETFs (V8) + 58 universal sub-sectors (V9) = 85; FTRS stays inactive
        assertThat(categories).hasSize(85);
    }

    @Test
    @DisplayName("findAllByActiveTrueOrderByDisplayOrderAsc returns categories ordered by display order")
    void shouldReturnCategoriesOrderedByDisplayOrder() {
        List<Category> categories = repository.findAllByActiveTrueOrderByDisplayOrderAsc();

        assertThat(categories.getFirst().id()).isEqualTo(CategoryId.TECH);
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

        assertThat(categories).hasSize(84);
        assertThat(categories).extracting(Category::id).doesNotContain(CategoryId.CASH);
    }

    @Test
    @DisplayName("findAllWithLatestPrice returns all 19 categories with null price when no prices ingested")
    void findAllWithLatestPrice_returnsAllCategoriesWithNullPriceWhenNoPricesExist() {
        jdbcTemplate.update("DELETE FROM raw_prices");

        List<CategoryRepository.CategoryPriceRow> rows = repository.findAllWithLatestPrice();

        assertThat(rows).hasSize(19);
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.latestClose()).isNull();
            assertThat(row.priceDate()).isNull();
        });
    }

    @Test
    @DisplayName("findAllWithLatestPrice returns latest close and date for a category with prices")
    void findAllWithLatestPrice_returnsLatestCloseForCategoryWithPrices() {
        jdbcTemplate.update("DELETE FROM raw_prices");
        jdbcTemplate.update(
                "INSERT INTO raw_prices (trade_date, category_id, open, high, low, close, adj_close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                LocalDate.of(2026, 1, 10), "TECH", 190.0, 195.0, 188.0, 192.0, 192.0, 1000000L);
        jdbcTemplate.update(
                "INSERT INTO raw_prices (trade_date, category_id, open, high, low, close, adj_close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                LocalDate.of(2026, 1, 15), "TECH", 193.0, 200.0, 191.0, 198.5, 198.5, 1200000L);

        List<CategoryRepository.CategoryPriceRow> rows = repository.findAllWithLatestPrice();

        CategoryRepository.CategoryPriceRow techRow = rows.stream()
                .filter(r -> r.category().id() == CategoryId.TECH)
                .findFirst().orElseThrow();
        assertThat(techRow.latestClose()).isEqualByComparingTo(new BigDecimal("198.5"));
        assertThat(techRow.priceDate()).isEqualTo(LocalDate.of(2026, 1, 15));
    }
}
