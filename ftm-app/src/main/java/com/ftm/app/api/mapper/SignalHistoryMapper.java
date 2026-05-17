package com.ftm.app.api.mapper;

import com.ftm.app.api.dto.SignalHistoryDto;
import com.ftm.app.signals.repository.SignalRepository;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SignalHistoryMapper {
    SignalHistoryDto toDto(SignalRepository.HistoryRow row);
}
