package com.ftm.app.alerts.repository;

import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.Severity;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import static com.ftm.app.jooq.Tables.ALERT_RULES;

@Repository
public class AlertRulesRepository {

    private final DSLContext dsl;

    public AlertRulesRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<AlertRule> findAllEnabled() {
        return dsl.selectFrom(ALERT_RULES)
                .where(ALERT_RULES.ENABLED.isTrue())
                .fetch()
                .map(r -> new AlertRule(
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
                .map(r -> new AlertRule(
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
