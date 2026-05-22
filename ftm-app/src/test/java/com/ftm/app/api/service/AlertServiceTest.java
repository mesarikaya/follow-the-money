package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.instancio.Select.field;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.api.dto.AlertsResponse;
import com.ftm.app.api.mapper.AlertMapper;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertStatus;
import java.util.List;
import java.util.NoSuchElementException;
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
    when(alertRepository.acknowledgeAlert(alertId)).thenReturn(1);
    when(alertRepository.findRecentAlerts(100)).thenReturn(List.of(acknowledged));
    when(alertMapper.toDto(acknowledged)).thenReturn(dto);

    AlertDto result = alertService.acknowledgeAlert(alertId);

    assertThat(result).isEqualTo(dto);
    verify(alertRepository).acknowledgeAlert(alertId);
  }

  @Test
  @DisplayName("acknowledgeAlert throws NoSuchElementException when alert not found")
  void shouldThrowWhenAlertNotFound() {
    when(alertRepository.acknowledgeAlert(99L)).thenReturn(0);

    assertThatThrownBy(() -> alertService.acknowledgeAlert(99L))
        .isInstanceOf(NoSuchElementException.class)
        .hasMessageContaining("99");
  }
}
