package com.ftm.app.api.service;

import com.ftm.app.api.dto.ScoreDecompositionDto;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.service.CompositeScoreService;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class ScoreDecompositionService {

  private static final List<SignalType> REQUIRED_SIGNAL_TYPES =
      List.of(
          SignalType.RS_60,
          SignalType.RS_120,
          SignalType.PERSISTENCE_20D,
          SignalType.FLOW_20D,
          SignalType.MOM,
          SignalType.MACRO_FIT,
          SignalType.RRG_QUADRANT);

  private final SignalRepository signalRepository;
  private final CompositeScoreService compositeScoreService;

  public ScoreDecompositionService(
      SignalRepository signalRepository, CompositeScoreService compositeScoreService) {
    this.signalRepository = signalRepository;
    this.compositeScoreService = compositeScoreService;
  }

  @Cacheable("score-components")
  public Map<String, ScoreDecompositionDto> getAllScoreDecompositions() {
    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(REQUIRED_SIGNAL_TYPES);

    Map<String, CompositeScoreService.ScoreDecomposition> decompositions =
        compositeScoreService.computeScoreDecompositions(
            signals.getOrDefault(SignalType.RS_60, Collections.emptyMap()),
            signals.getOrDefault(SignalType.RS_120, Collections.emptyMap()),
            signals.getOrDefault(SignalType.PERSISTENCE_20D, Collections.emptyMap()),
            signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap()),
            signals.getOrDefault(SignalType.MOM, Collections.emptyMap()),
            signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap()),
            signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap()));

    return decompositions.entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, e -> toDto(e.getKey(), e.getValue())));
  }

  private static ScoreDecompositionDto toDto(
      String categoryId, CompositeScoreService.ScoreDecomposition decomposition) {
    return new ScoreDecompositionDto(
        categoryId,
        toDouble(decomposition.relativeStrength60Contribution()),
        toDouble(decomposition.relativeStrength120Contribution()),
        toDouble(decomposition.persistence20dContribution()),
        toDouble(decomposition.flow20dContribution()),
        toDouble(decomposition.momentumContribution()),
        toDouble(decomposition.macroFitContribution()),
        toDouble(decomposition.rrgContribution()),
        toDouble(decomposition.totalScore()));
  }

  private static Double toDouble(BigDecimal value) {
    return value != null ? value.doubleValue() : null;
  }
}
