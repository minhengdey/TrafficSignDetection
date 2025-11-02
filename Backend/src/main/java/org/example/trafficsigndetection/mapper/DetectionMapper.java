package org.example.trafficsigndetection.mapper;

import org.example.trafficsigndetection.dto.response.DetectionResponse;
import org.example.trafficsigndetection.entity.Detection;
import org.mapstruct.Mapper;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface DetectionMapper {
    DetectionResponse toResponse (Detection user);
}
