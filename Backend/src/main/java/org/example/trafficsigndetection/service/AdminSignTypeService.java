package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminSignTypeService {
    TrafficSignTypeRepository trafficSignTypeRepository;

    public List<TrafficSignType> listSignTypes() {
        return trafficSignTypeRepository.findAll();
    }

    public TrafficSignType getSignType(Long id) {
        return trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
    }

    public TrafficSignType createSignType(TrafficSignType type) {
        return trafficSignTypeRepository.save(type);
    }

    public TrafficSignType updateSignType(Long id, TrafficSignType payload) {
        TrafficSignType t = trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
        if (payload.getCode() != null)
            t.setCode(payload.getCode());
        if (payload.getName() != null)
            t.setName(payload.getName());
        if (payload.getDescription() != null)
            t.setDescription(payload.getDescription());
        if (payload.getExampleImagePath() != null)
            t.setExampleImagePath(payload.getExampleImagePath());
        return trafficSignTypeRepository.save(t);
    }

    public void deleteSignType(Long id) {
        TrafficSignType t = trafficSignTypeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
        trafficSignTypeRepository.delete(t);
    }
}
