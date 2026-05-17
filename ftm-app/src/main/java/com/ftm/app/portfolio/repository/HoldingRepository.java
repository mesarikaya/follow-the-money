package com.ftm.app.portfolio.repository;

import com.ftm.app.domain.Holding;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static com.ftm.app.jooq.Tables.HOLDINGS;

@Repository
public class HoldingRepository {

    private final DSLContext dsl;

    public HoldingRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<Holding> findAll() {
        return dsl.selectFrom(HOLDINGS)
                .orderBy(HOLDINGS.CATEGORY_ID.asc().nullsLast(), HOLDINGS.TICKER.asc())
                .fetch()
                .map(r -> new Holding(
                        r.getId(),
                        r.getTicker(),
                        r.getName(),
                        r.getCategoryId(),
                        r.getCurrency(),
                        r.getQuantity(),
                        r.getAvgCostLocal(),
                        r.getUsdFxRate(),
                        r.getUploadedAt()));
    }

    public void replaceAll(List<Holding> holdings) {
        dsl.transaction(configuration -> {
            var transactionalDsl = configuration.dsl();
            transactionalDsl.deleteFrom(HOLDINGS).execute();
            OffsetDateTime now = OffsetDateTime.now();
            for (Holding holding : holdings) {
                transactionalDsl.insertInto(HOLDINGS,
                                HOLDINGS.TICKER,
                                HOLDINGS.NAME,
                                HOLDINGS.CATEGORY_ID,
                                HOLDINGS.CURRENCY,
                                HOLDINGS.QUANTITY,
                                HOLDINGS.AVG_COST_LOCAL,
                                HOLDINGS.USD_FX_RATE,
                                HOLDINGS.UPLOADED_AT)
                        .values(
                                holding.ticker(),
                                holding.name(),
                                holding.categoryId(),
                                holding.currency(),
                                holding.quantity(),
                                holding.avgCostLocal(),
                                holding.usdFxRate(),
                                now)
                        .execute();
            }
        });
    }

    public int updateByTicker(String ticker, BigDecimal quantity, BigDecimal avgCostLocal) {
        return dsl.update(HOLDINGS)
                .set(HOLDINGS.QUANTITY, quantity)
                .set(HOLDINGS.AVG_COST_LOCAL, avgCostLocal)
                .set(HOLDINGS.UPLOADED_AT, OffsetDateTime.now())
                .where(HOLDINGS.TICKER.eq(ticker))
                .execute();
    }
}
