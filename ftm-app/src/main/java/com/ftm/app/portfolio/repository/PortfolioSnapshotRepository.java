package com.ftm.app.portfolio.repository;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.table;

import com.ftm.app.portfolio.domain.PortfolioValueSnapshot;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class PortfolioSnapshotRepository {

  private static final org.jooq.Table<?> SNAPSHOTS =
      table(name("portfolio_value_snapshots"));
  private static final org.jooq.Table<?> FX_HISTORY =
      table(name("fx_rates_history"));

  private final DSLContext dsl;

  public PortfolioSnapshotRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public void upsertSnapshot(PortfolioValueSnapshot snapshot) {
    dsl.insertInto(SNAPSHOTS)
        .set(field(name("snapshot_date")), snapshot.snapshotDate())
        .set(field(name("total_value_eur")), snapshot.totalValueEur())
        .set(field(name("total_cost_eur")), snapshot.totalCostEur())
        .set(field(name("holding_count")), snapshot.holdingCount())
        .set(field(name("captured_at")), OffsetDateTime.now())
        .onConflict(field(name("snapshot_date")))
        .doUpdate()
        .set(field(name("total_value_eur")), snapshot.totalValueEur())
        .set(field(name("total_cost_eur")), snapshot.totalCostEur())
        .set(field(name("holding_count")), snapshot.holdingCount())
        .set(field(name("captured_at")), OffsetDateTime.now())
        .execute();
  }

  public void upsertFxRate(LocalDate date, String currencyPair, BigDecimal rate, String source) {
    dsl.insertInto(FX_HISTORY)
        .set(field(name("snapshot_date")), date)
        .set(field(name("currency_pair")), currencyPair)
        .set(field(name("rate")), rate)
        .set(field(name("source")), source)
        .set(field(name("captured_at")), OffsetDateTime.now())
        .onConflict(field(name("snapshot_date")), field(name("currency_pair")))
        .doUpdate()
        .set(field(name("rate")), rate)
        .set(field(name("captured_at")), OffsetDateTime.now())
        .execute();
  }

  public java.util.Optional<BigDecimal> findLastFxRate(String currencyPair) {
    return dsl.select(field(name("rate")))
        .from(FX_HISTORY)
        .where(field(name("currency_pair")).eq(currencyPair))
        .orderBy(field(name("snapshot_date")).desc(), field(name("captured_at")).desc())
        .limit(1)
        .fetchOptional()
        .map(r -> r.get(field(name("rate")), BigDecimal.class));
  }

  public List<PortfolioValueSnapshot> findRecentSnapshots(int days) {
    return dsl.select(
            field(name("snapshot_date")),
            field(name("total_value_eur")),
            field(name("total_cost_eur")),
            field(name("holding_count")))
        .from(SNAPSHOTS)
        .where(
            field(name("snapshot_date"))
                .greaterOrEqual(LocalDate.now().minusDays(days)))
        .orderBy(field(name("snapshot_date")).asc())
        .fetch()
        .map(
            r ->
                new PortfolioValueSnapshot(
                    r.get(field(name("snapshot_date")), LocalDate.class),
                    r.get(field(name("total_value_eur")), BigDecimal.class),
                    r.get(field(name("total_cost_eur")), BigDecimal.class),
                    r.get(field(name("holding_count")), Integer.class)));
  }
}
