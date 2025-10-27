package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.DetectionRepository;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminDetectionService {
    DetectionRepository detectionRepository;
    TrafficSignTypeRepository trafficSignTypeRepository;

    public List<Detection> listDetections() {
        return detectionRepository.findAll();
    }

    public Detection getDetection(Long id) {
        return detectionRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.DETECTION_NOT_FOUND));
    }

    public Detection updateDetection(Long id, String label, Float confidence, Long signTypeId) {
        Detection d = detectionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DETECTION_NOT_FOUND));
        if (label != null)
            d.setLabel(label);
        if (confidence != null)
            d.setConfidence(confidence);
        if (signTypeId != null) {
            TrafficSignType t = trafficSignTypeRepository.findById(signTypeId)
                    .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
            d.setSignType(t);
        }
        return detectionRepository.save(d);
    }

    public void deleteDetection(Long id) {
        Detection d = detectionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DETECTION_NOT_FOUND));
        detectionRepository.delete(d);
    }
}
