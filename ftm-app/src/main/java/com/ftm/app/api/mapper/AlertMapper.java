package com.ftm.app.api.mapper;

import com.ftm.app.api.dto.AlertDto;
import com.ftm.app.domain.Alert;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AlertMapper {

  @Mapping(
      target = "categoryId",
      expression = "java(alert.categoryId() != null ? alert.categoryId().name() : null)")
  @Mapping(target = "severity", expression = "java(alert.severity().name())")
  @Mapping(target = "status", expression = "java(alert.status().name())")
  AlertDto toDto(Alert alert);
}
