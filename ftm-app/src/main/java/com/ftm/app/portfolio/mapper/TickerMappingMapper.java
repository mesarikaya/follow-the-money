package com.ftm.app.portfolio.mapper;

import com.ftm.app.api.dto.TickerMappingDto;
import com.ftm.app.portfolio.domain.TickerMapping;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface TickerMappingMapper {

  TickerMappingDto toDto(TickerMapping tickerMapping);
}
