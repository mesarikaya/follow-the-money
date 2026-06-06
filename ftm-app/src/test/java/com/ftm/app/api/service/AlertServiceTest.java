package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.instancio.Select.field;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertRuleDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

  @Mock AlertRepository alertRepository;
  @Mock AlertRulesRepository alertRulesRepository;
  @Mock AlertMapper alertMapper;
  @InjectMocks AlertService alertService;

  private Alert activeAlert(Long id) {
    return Instancio.of(Alert.class)
        .set(field(Alert::id), id)
        .set(field(Alert::status), AlertStatus.ACTIVE)
        .create();
  }

  private Alert resolvedAlert(Long id) {
    return Instancio.of(Alert.class)
        .set(field(Alert::id), id)
        .set(field(Alert::status), AlertStatus.RESOLVED)
        .create();
  }

  @Test
  @DisplayName("getAlerts returns active count and all mapped alerts")
  void shouldReturnActiveCountAndAlerts() {
    Alert active = activeAlert(1L);
    Alert resolved = resolvedAlert(2L);
    AlertDto activeDto = Instancio.create(AlertDto.class);
    AlertDto resolvedDto = Instancio.create(AlertDto.class);
    when(alertRepository.findRecentAlerts(100)).thenReturn(List.of(active, resolved));
    when(alertMapper.toDto(active)).thenReturn(activeDto);
    when(alertMapper.toDto(resolved)).thenReturn(resolvedDto);

    AlertsResponse response = alertService.getAlerts();

    assertThat(response.activeCount()).isEqualTo(1);
    assertThat(response.alerts()).hasSize(2);
  }

  @Test
  @DisplayName("getAlerts returns 0 active count when all alerts are resolved")
  void shouldReturnZeroActiveCount() {
    Alert resolved = resolvedAlert(1L);
    when(alertRepository.findRecentAlerts(100)).thenReturn(List.of(resolved));
    when(alertMapper.toDto(resolved)).thenReturn(Instancio.create(AlertDto.class));

    AlertsResponse response = alertService.getAlerts();

    assertThat(response.activeCount()).isZero();
  }

  @Test
  @DisplayName("acknowledgeAlert updates alert and returns dto")
  void shouldAcknowledgeAlert() {
    Long alertId = 5L;
    Alert acknowledged = Instancio.of(Alert.class).set(field(Alert::id), alertId).create();
    AlertDto dto = Instancio.create(AlertDto.class);
    when(alertRepository.acknowledgeAlert(alertId)).thenReturn(Optional.of(acknowledged));
    when(alertMapper.toDto(acknowledged)).thenReturn(dto);

    AlertDto result = alertService.acknowledgeAlert(alertId);

    assertThat(result).isEqualTo(dto);
    verify(alertRepository).acknowledgeAlert(alertId);
  }

  @Test
  @DisplayName("acknowledgeAlert throws NoSuchElementException when alert not found")
  void shouldThrowWhenAlertNotFound() {
    when(alertRepository.acknowledgeAlert(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> alertService.acknowledgeAlert(99L))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("99");
  }

  private AlertRule alertRule(String ruleId, boolean enabled) {
    return new AlertRule(
        ruleId, enabled, null, 3, new BigDecimal("0.65"), Severity.ACTION, null, null, null);
  }

  @Test
  @DisplayName("getAlertRules returns all rules mapped to dtos")
  void shouldReturnAllAlertRules() {
    AlertRule r1 = alertRule("rrg_transition", true);
    AlertRule r2 = alertRule("composite_breakout", false);
    when(alertRulesRepository.findAll()).thenReturn(List.of(r1, r2));

    List<AlertRuleDto> result = alertService.getAlertRules();

    assertThat(result).hasSize(2);
    assertThat(result.get(0).ruleId()).isEqualTo("rrg_transition");
    assertThat(result.get(0).enabled()).isTrue();
    assertThat(result.get(1).ruleId()).isEqualTo("composite_breakout");
    assertThat(result.get(1).enabled()).isFalse();
  }

  @Test
  @DisplayName("getAlertRules returns empty list when no rules configured")
  void shouldReturnEmptyListWhenNoRulesConfigured() {
    when(alertRulesRepository.findAll()).thenReturn(List.of());

    List<AlertRuleDto> result = alertService.getAlertRules();

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("setRuleEnabled updates rule and returns updated dto")
  void shouldSetRuleEnabled() {
    AlertRule updatedRule = alertRule("rrg_transition", false);
    when(alertRulesRepository.updateEnabled("rrg_transition", false))
        .thenReturn(Optional.of(updatedRule));

    AlertRuleDto result = alertService.setRuleEnabled("rrg_transition", false);

    assertThat(result.ruleId()).isEqualTo("rrg_transition");
    assertThat(result.enabled()).isFalse();
    verify(alertRulesRepository).updateEnabled("rrg_transition", false);
  }

  @Test
  @DisplayName("setRuleEnabled throws NoSuchElementException when rule not found")
  void shouldThrowWhenRuleNotFound() {
    when(alertRulesRepository.updateEnabled("unknown_rule", true)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> alertService.setRuleEnabled("unknown_rule", true))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("unknown_rule");
  }

  @Test
  @DisplayName("acknowledgeAllActive delegates to repository and returns count")
  void shouldAcknowledgeAllActive() {
    when(alertRepository.acknowledgeAllActive()).thenReturn(7);

    int result = alertService.acknowledgeAllActive();

    assertThat(result).isEqualTo(7);
    verify(alertRepository).acknowledgeAllActive();
  }

  @Test
  @DisplayName("acknowledgeAllActive returns zero when no active alerts exist")
  void shouldReturnZeroWhenNoActiveAlerts() {
    when(alertRepository.acknowledgeAllActive()).thenReturn(0);

    int result = alertService.acknowledgeAllActive();

    assertThat(result).isZero();
  }
}
