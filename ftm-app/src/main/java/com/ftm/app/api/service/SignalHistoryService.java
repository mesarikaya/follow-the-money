package com.ftm.app.api.service;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.api.mapper.SignalHistoryMapper;
import com.ftm.app.signals.repository.SignalRepository;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class SignalHistoryService {

  private final SignalRepository signalRepository;
  private final SignalHistoryMapper signalHistoryMapper;

  public SignalHistoryService(
      SignalRepository signalRepository, SignalHistoryMapper signalHistoryMapper) {
    this.signalRepository = signalRepository;
    this.signalHistoryMapper = signalHistoryMapper;
  }

  @Cacheable(value = "signal-history", key = "#categoryId + '-' + #days")
  public List<SignalHistoryDto> getHistory(String categoryId, int days) {
    return signalRepository.findByCategoryId(categoryId, days).stream()
        .map(signalHistoryMapper::toDto)
        .toList();
  }
}
