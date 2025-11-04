package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.request.TrafficSignTypeRequest;
import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.TrafficSignTypeMapper;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrafficSignTypeService {
    TrafficSignTypeRepository trafficSignTypeRepository;
    TrafficSignTypeMapper trafficSignTypeMapper;

    public Page<TrafficSignTypeResponse> listSignTypes(Pageable pageable) {
        Page<TrafficSignType> types = trafficSignTypeRepository.findAll(pageable);
        List<TrafficSignTypeResponse> responses = types.getContent()
                .stream().map(trafficSignTypeMapper::toResponse).toList();
        return new PageImpl<>(responses, pageable, types.getTotalElements());
    }

    public TrafficSignTypeResponse getSignType(Long id) {
        TrafficSignType type = trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        return trafficSignTypeMapper.toResponse(type);
    }

    @Transactional(rollbackFor = AppException.class)
    public TrafficSignTypeResponse updateSignType(Long id, TrafficSignTypeRequest request) {
        TrafficSignType type = trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        trafficSignTypeMapper.update(type, request);

        return trafficSignTypeMapper.toResponse(trafficSignTypeRepository.save(type));
    }

    @Transactional(rollbackFor = AppException.class)
    public void deleteSignType(Long id) {
        TrafficSignType type = trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        trafficSignTypeRepository.delete(type);
    }

    public TrafficSignTypeResponse getTrafficSignTypeByCode(String code) {
        TrafficSignType type = trafficSignTypeRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        return trafficSignTypeMapper.toResponse(type);
    }
}
