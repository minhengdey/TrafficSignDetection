package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.TrafficSignTypeMapper;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrafficSignTypeService {
    TrafficSignTypeRepository trafficSignTypeRepository;
    TrafficSignTypeMapper trafficSignTypeMapper;

    public TrafficSignTypeResponse getTrafficSignTypeByCode(String code) {
        TrafficSignType type = trafficSignTypeRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        return trafficSignTypeMapper.toResponse(type);
    }
}
