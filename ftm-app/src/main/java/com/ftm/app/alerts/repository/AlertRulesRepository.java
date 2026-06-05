package com.ftm.app.alerts.repository;

import static com.ftm.app.jooq.Tables.ALERT_RULES;

import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.Severity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
public class AlertRulesRepository {

  private final DSLContext dsl;

  public AlertRulesRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public List<AlertRule> findAll() {
    return dsl.selectFrom(ALERT_RULES)
        .orderBy(ALERT_RULES.RULE_ID)
        .fetch()
        .map(
            r ->
                new AlertRule(
                    r.getRuleId(),
                    r.getEnabled(),
                    r.getZThreshold(),
                    r.getPersistenceDays(),
                    r.getCompositeThreshold(),
                    Severity.valueOf(r.getSeverity()),
                    jsonbToString(r.getCategoryFilter()),
                    jsonbToString(r.getConfig()),
                    r.getLastUpdated()));
  }

  public Optional<AlertRule> updateEnabled(String ruleId, boolean enabled) {
    return dsl.update(ALERT_RULES)
        .set(ALERT_RULES.ENABLED, enabled)
        .set(ALERT_RULES.LAST_UPDATED, OffsetDateTime.now())
        .where(ALERT_RULES.RULE_ID.eq(ruleId))
        .returning(ALERT_RULES.fields())
        .fetchOptional()
        .map(
            r ->
                new AlertRule(
                    r.getValue(ALERT_RULES.RULE_ID),
                    r.getValue(ALERT_RULES.ENABLED),
                    r.getValue(ALERT_RULES.Z_THRESHOLD),
                    r.getValue(ALERT_RULES.PERSISTENCE_DAYS),
                    r.getValue(ALERT_RULES.COMPOSITE_THRESHOLD),
                    Severity.valueOf(r.getValue(ALERT_RULES.SEVERITY)),
                    jsonbToString(r.getValue(ALERT_RULES.CATEGORY_FILTER)),
                    jsonbToString(r.getValue(ALERT_RULES.CONFIG)),
                    r.getValue(ALERT_RULES.LAST_UPDATED)));
  }

  public List<AlertRule> findAllEnabled() {
    return dsl.selectFrom(ALERT_RULES)
        .where(ALERT_RULES.ENABLED.isTrue())
        .fetch()
        .map(
            r ->
                new AlertRule(
                    r.getRuleId(),
                    r.getEnabled(),
                    r.getZThreshold(),
                    r.getPersistenceDays(),
                    r.getCompositeThreshold(),
                    Severity.valueOf(r.getSeverity()),
                    jsonbToString(r.getCategoryFilter()),
                    jsonbToString(r.getConfig()),
                    r.getLastUpdated()));
  }

  public Optional<AlertRule> findById(String ruleId) {
    return dsl.selectFrom(ALERT_RULES)
        .where(ALERT_RULES.RULE_ID.eq(ruleId))
        .fetchOptional()
        .map(
            r ->
                new AlertRule(
                    r.getRuleId(),
                    r.getEnabled(),
                    r.getZThreshold(),
                    r.getPersistenceDays(),
                    r.getCompositeThreshold(),
                    Severity.valueOf(r.getSeverity()),
                    jsonbToString(r.getCategoryFilter()),
                    jsonbToString(r.getConfig()),
                    r.getLastUpdated()));
  }

  private String jsonbToString(JSONB jsonb) {
    return jsonb != null ? jsonb.data() : null;
  }
}
