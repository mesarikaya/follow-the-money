package com.ftm.app.backtest.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class BacktestRepository {

  private final DSLContext dsl;
  private final ObjectMapper objectMapper;

  public BacktestRepository(DSLContext dsl) {
    this.dsl = dsl;
    this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
  }

  public BacktestResult save(BacktestResult result) {
    UUID runId = UUID.randomUUID();
    OffsetDateTime runAt = OffsetDateTime.now();

    dsl.insertInto(DSL.table("backtest_results"))
        .set(DSL.field("run_id"), runId)
        .set(DSL.field("run_at"), runAt)
        .set(DSL.field("start_date"), result.startDate())
        .set(DSL.field("end_date"), result.endDate())
        .set(DSL.field("rebalance_frequency"), result.rebalanceFrequency())
        .set(DSL.field("top_n"), result.topN())
        .set(DSL.field("signal_threshold"), result.signalThreshold())
        .set(DSL.field("total_return_pct"), result.totalReturnPct())
        .set(DSL.field("annualized_return_pct"), result.annualizedReturnPct())
        .set(DSL.field("max_drawdown_pct"), result.maxDrawdownPct())
        .set(DSL.field("sharpe_ratio"), result.sharpeRatio())
        .set(DSL.field("sortino_ratio"), result.sortinoRatio())
        .set(DSL.field("calmar_ratio"), result.calmarRatio())
        .set(DSL.field("spy_total_return_pct"), result.spyTotalReturnPct())
        .set(DSL.field("spy_annualized_return_pct"), result.spyAnnualizedReturnPct())
        .set(DSL.field("spy_max_drawdown_pct"), result.spyMaxDrawdownPct())
        .set(DSL.field("spy_sharpe_ratio"), result.spySharpeRatio())
        .set(DSL.field("trading_days"), result.tradingDays())
        .set(DSL.field("equity_curve"), JSONB.valueOf(serializeEquityCurve(result.equityCurve())))
        .execute();

    return new BacktestResult(
        runId,
        runAt,
        result.startDate(),
        result.endDate(),
        result.rebalanceFrequency(),
        result.topN(),
        result.signalThreshold(),
        result.totalReturnPct(),
        result.annualizedReturnPct(),
        result.maxDrawdownPct(),
        result.sharpeRatio(),
        result.sortinoRatio(),
        result.calmarRatio(),
        result.spyTotalReturnPct(),
        result.spyAnnualizedReturnPct(),
        result.spyMaxDrawdownPct(),
        result.spySharpeRatio(),
        result.tradingDays(),
        result.equityCurve(),
        result.rebalanceHistory() != null ? result.rebalanceHistory() : List.of());
  }

  public Optional<BacktestResult> findByRunId(UUID runId) {
    return dsl.selectFrom(DSL.table("backtest_results"))
        .where(DSL.field("run_id").eq(runId))
        .fetchOptional()
        .map(r -> mapRow(r, true));
  }

  public List<BacktestResult> findRecent(int limitCount) {
    return dsl.selectFrom(DSL.table("backtest_results"))
        .orderBy(DSL.field("run_at").desc())
        .limit(limitCount)
        .fetch()
        .map(r -> mapRow(r, false));
  }

  private BacktestResult mapRow(org.jooq.Record r, boolean includeEquityCurve) {
    return new BacktestResult(
        r.get("run_id", UUID.class),
        r.get("run_at", OffsetDateTime.class),
        r.get("start_date", java.time.LocalDate.class),
        r.get("end_date", java.time.LocalDate.class),
        r.get("rebalance_frequency", String.class),
        r.get("top_n", Integer.class),
        r.get("signal_threshold", java.math.BigDecimal.class),
        r.get("total_return_pct", java.math.BigDecimal.class),
        r.get("annualized_return_pct", java.math.BigDecimal.class),
        r.get("max_drawdown_pct", java.math.BigDecimal.class),
        r.get("sharpe_ratio", java.math.BigDecimal.class),
        r.get("sortino_ratio", java.math.BigDecimal.class),
        r.get("calmar_ratio", java.math.BigDecimal.class),
        r.get("spy_total_return_pct", java.math.BigDecimal.class),
        r.get("spy_annualized_return_pct", java.math.BigDecimal.class),
        r.get("spy_max_drawdown_pct", java.math.BigDecimal.class),
        r.get("spy_sharpe_ratio", java.math.BigDecimal.class),
        Optional.ofNullable(r.get("trading_days", Integer.class)).orElse(0),
        includeEquityCurve ? deserializeEquityCurve(r.get("equity_curve", JSONB.class)) : List.of(),
        List.of());
  }

  private String serializeEquityCurve(List<EquityCurvePoint> equityCurve) {
    try {
      return objectMapper.writeValueAsString(equityCurve);
    } catch (JsonProcessingException e) {
      return "[]";
    }
  }

  @SuppressWarnings("unchecked")
  private List<EquityCurvePoint> deserializeEquityCurve(JSONB jsonb) {
    if (jsonb == null || jsonb.data() == null) return List.of();
    try {
      return objectMapper.readValue(
          jsonb.data(),
          objectMapper
              .getTypeFactory()
              .constructCollectionType(List.class, EquityCurvePoint.class));
    } catch (JsonProcessingException e) {
      return List.of();
    }
  }
}
