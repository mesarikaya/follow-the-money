package com.ftm.app.api.mapper;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.domain.IngestLog;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface IngestLogMapper {

  @Mapping(target = "source", expression = "java(ingestLog.source().name().toLowerCase())")
  @Mapping(target = "status", expression = "java(ingestLog.status().name().toLowerCase())")
  IngestStatusResponse toResponse(IngestLog ingestLog);
}
