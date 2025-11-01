package org.example.trafficsigndetection.mapper;

import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.mapstruct.Mapper;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface TrafficSignTypeMapper {
    TrafficSignTypeResponse toResponse (TrafficSignType trafficSignType);
}
