package org.example.trafficsigndetection.mapper;

import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.entity.Video;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface VideoMapper {
    VideoResponse toResponse (Video video);
}
