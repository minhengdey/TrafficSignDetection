package org.example.trafficsigndetection.mapper;

import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.dto.response.UserResponse;
import org.example.trafficsigndetection.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface UserMapper {
    User toEntity (UserRequest request);
    UserResponse toResponse (User user);
    void update (@MappingTarget User user, UserRequest request);
}
