package org.example.trafficsigndetection.mapper;

import org.example.trafficsigndetection.dto.request.TrafficSignTypeRequest;
import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface TrafficSignTypeMapper {
    TrafficSignTypeResponse toResponse (TrafficSignType trafficSignType);
    void update (@MappingTarget TrafficSignType type, TrafficSignTypeRequest request);
}
