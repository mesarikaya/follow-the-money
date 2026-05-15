package com.ftm.app.api.repository;

import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;

import static com.ftm.app.jooq.Tables.CATEGORIES;

@Repository
public class CategoryRepository {

    private final DSLContext dsl;

    public CategoryRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<Category> findAllByActiveTrueOrderByDisplayOrderAsc() {
        return dsl.selectFrom(CATEGORIES)
                .where(CATEGORIES.ACTIVE.isTrue())
                .orderBy(CATEGORIES.DISPLAY_ORDER.asc())
                .fetch()
                .map(r -> new Category(
                        CategoryId.valueOf(r.getId()),
                        r.getName(),
                        CategoryType.valueOf(r.getType()),
                        r.getEtfTicker(),
                        r.getBenchmarkTicker(),
                        r.getDisplayOrder(),
                        r.getActive()
                ));
    }
}
