package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubSectorBreadthAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String BREADTH_DIV = "sub_sector_breadth_divergence";
  private static final String BULL_CONFLUENCE = "sub_sector_bull_confluence";
  private static final String TRADE_BUY = "trade_signal_buy";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;
  @Mock CategoryRepository categoryRepository;

  private SubSectorBreadthAlertEvaluator evaluator() {
    return new SubSectorBreadthAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository, categoryRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(String ruleId, boolean enabled, Severity severity) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private Category sub(CategoryId id, int order) {
    return new Category(id, id.name(), CategoryType.EQUITY_SECTOR, "ETF", "XLK", order, true, "TECH");
  }

  private void stubFourSubSectors() {
    when(categoryRepository.findSubCategoriesByParentId("TECH"))
        .thenReturn(
            List.of(
                sub(CategoryId.SEMI, 101),
                sub(CategoryId.AIRO, 102),
                sub(CategoryId.CLOD, 103),
                sub(CategoryId.SOFT, 104)));
  }

  /** RRG quadrant per sub-sector by name (3/4 = bullish). */
  private void stubQuadrants(int semi, int airo, int clod, int soft) {
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "SEMI", new BigDecimal(semi),
                "AIRO", new BigDecimal(airo),
                "CLOD", new BigDecimal(clod),
                "SOFT", new BigDecimal(soft)));
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    lenient()
        .when(alertRulesRepository.findById(BREADTH_DIV))
        .thenReturn(Optional.of(rule(BREADTH_DIV, false, Severity.WARNING)));
    lenient()
        .when(alertRulesRepository.findById(BULL_CONFLUENCE))
        .thenReturn(Optional.of(rule(BULL_CONFLUENCE, false, Severity.INFO)));

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBreadthDivergenceWhenBuyActiveButBreadthWeak() {
    when(alertRulesRepository.findById(BREADTH_DIV))
        .thenReturn(Optional.of(rule(BREADTH_DIV, true, Severity.WARNING)));
    when(alertRulesRepository.findById(BULL_CONFLUENCE))
        .thenReturn(Optional.of(rule(BULL_CONFLUENCE, false, Severity.INFO)));
    stubFourSubSectors();
    // Only 1 of 4 bullish → breadth 25% < 40%
    stubQuadrants(4, 1, 1, 1);
    when(alertRepository.existsActiveAlert(TRADE_BUY, "TECH")).thenReturn(true);
    lenient().when(alertRepository.existsActiveAlert(BREADTH_DIV, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireBreadthDivergenceWhenNoParentBuy() {
    when(alertRulesRepository.findById(BREADTH_DIV))
        .thenReturn(Optional.of(rule(BREADTH_DIV, true, Severity.WARNING)));
    when(alertRulesRepository.findById(BULL_CONFLUENCE))
        .thenReturn(Optional.of(rule(BULL_CONFLUENCE, false, Severity.INFO)));
    stubFourSubSectors();
    stubQuadrants(4, 1, 1, 1);
    when(alertRepository.existsActiveAlert(TRADE_BUY, "TECH")).thenReturn(false);
    lenient().when(alertRepository.existsActiveAlert(BREADTH_DIV, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBullConfluenceWhenBroadParticipation() {
    when(alertRulesRepository.findById(BREADTH_DIV))
        .thenReturn(Optional.of(rule(BREADTH_DIV, false, Severity.WARNING)));
    when(alertRulesRepository.findById(BULL_CONFLUENCE))
        .thenReturn(Optional.of(rule(BULL_CONFLUENCE, true, Severity.INFO)));
    stubFourSubSectors();
    // All 4 bullish → 100% >= 75%
    stubQuadrants(4, 4, 3, 3);
    lenient().when(alertRepository.existsActiveAlert(BULL_CONFLUENCE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireBullConfluenceWhenParticipationNarrow() {
    when(alertRulesRepository.findById(BREADTH_DIV))
        .thenReturn(Optional.of(rule(BREADTH_DIV, false, Severity.WARNING)));
    when(alertRulesRepository.findById(BULL_CONFLUENCE))
        .thenReturn(Optional.of(rule(BULL_CONFLUENCE, true, Severity.INFO)));
    stubFourSubSectors();
    // 2 of 4 bullish → 50% < 75%
    stubQuadrants(4, 3, 1, 1);
    lenient().when(alertRepository.existsActiveAlert(BULL_CONFLUENCE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}
