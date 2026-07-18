package com.ftm.app.macro.repository;

import static com.ftm.app.jooq.Tables.MACRO_INDICATORS;
import static org.jooq.impl.DSL.max;

import com.ftm.app.domain.MacroIndicator;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class MacroIndicatorReadRepository {

  private final DSLContext dsl;

  public MacroIndicatorReadRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public List<MacroIndicator> findHistoricalForSeries(
      Collection<String> seriesIds, LocalDate from) {
    return dsl.selectFrom(MACRO_INDICATORS)
        .where(MACRO_INDICATORS.SERIES_ID.in(seriesIds))
        .and(MACRO_INDICATORS.OBSERVATION_DATE.ge(from))
        .orderBy(MACRO_INDICATORS.OBSERVATION_DATE.asc(), MACRO_INDICATORS.SERIES_ID.asc())
        .fetch()
        .map(
            r ->
                new MacroIndicator(
                    r.getObservationDate(), r.getSeriesId(), r.getValue(), r.getSource()));
  }

  public List<MacroIndicator> findLatestPerSeries() {
    var m2 = MACRO_INDICATORS.as("m2");
    return dsl.selectFrom(MACRO_INDICATORS)
        .where(
            MACRO_INDICATORS.OBSERVATION_DATE.eq(
                dsl.select(max(m2.OBSERVATION_DATE))
                    .from(m2)
                    .where(m2.SERIES_ID.eq(MACRO_INDICATORS.SERIES_ID))))
        .fetch()
        .map(
            r ->
                new MacroIndicator(
                    r.getObservationDate(), r.getSeriesId(), r.getValue(), r.getSource()));
  }

  public List<MacroIndicator> findPreviousPerSeries(LocalDate latestAsOf) {
    var m2 = MACRO_INDICATORS.as("m2");
    return dsl.selectFrom(MACRO_INDICATORS)
        .where(
            MACRO_INDICATORS.OBSERVATION_DATE.eq(
                dsl.select(max(m2.OBSERVATION_DATE))
                    .from(m2)
                    .where(m2.SERIES_ID.eq(MACRO_INDICATORS.SERIES_ID))
                    .and(m2.OBSERVATION_DATE.lt(latestAsOf))))
        .fetch()
        .map(
            r ->
                new MacroIndicator(
                    r.getObservationDate(), r.getSeriesId(), r.getValue(), r.getSource()));
  }
}
