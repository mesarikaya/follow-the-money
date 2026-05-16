package com.ftm.app.portfolio.repository;

import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Portfolio;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

import static com.ftm.app.jooq.Tables.PORTFOLIO;

@Repository
public class PortfolioRepository {

    private final DSLContext dsl;

    public PortfolioRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<Portfolio> findAll() {
        return dsl.selectFrom(PORTFOLIO)
                .orderBy(PORTFOLIO.CATEGORY_ID.asc())
                .fetch()
                .map(r -> new Portfolio(
                        CategoryId.valueOf(r.getCategoryId()),
                        r.getAllocationPct(),
                        r.getLastUpdated(),
                        r.getNotes()));
    }

    public void replaceAll(List<Portfolio> entries) {
        dsl.transaction(configuration -> {
            var transactionalDsl = configuration.dsl();
            transactionalDsl.deleteFrom(PORTFOLIO).execute();
            for (Portfolio entry : entries) {
                transactionalDsl.insertInto(PORTFOLIO,
                                PORTFOLIO.CATEGORY_ID,
                                PORTFOLIO.ALLOCATION_PCT,
                                PORTFOLIO.LAST_UPDATED,
                                PORTFOLIO.NOTES)
                        .values(
                                entry.categoryId().name(),
                                entry.allocationPct(),
                                OffsetDateTime.now(),
                                entry.notes())
                        .execute();
            }
        });
    }
}
