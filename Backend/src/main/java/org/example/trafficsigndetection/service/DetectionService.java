package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.DetectionResponse;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.DetectionMapper;
import org.example.trafficsigndetection.repository.DetectionRepository;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DetectionService {
    DetectionRepository detectionRepository;
    DetectionMapper detectionMapper;
    VideoRepository videoRepository;

    public Page<DetectionResponse> listDetections(Pageable pageable) {
        Page<Detection> detections = detectionRepository.findAllByOrderByDetectedAtDesc(pageable);
        List<DetectionResponse> responses = detections.getContent()
                .stream().map(detectionMapper::toResponse).toList();
        return new PageImpl<>(responses, pageable, detections.getTotalElements());
    }

    public DetectionResponse getDetection(Long id) {
        Detection detection = detectionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DETECTION_NOT_FOUND));

        return detectionMapper.toResponse(detection);
    }

    @Transactional(rollbackFor = AppException.class)
    public void deleteDetection(Long id) {
        Detection detection = detectionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DETECTION_NOT_FOUND));
        detectionRepository.delete(detection);
    }

    public int countDetectionsByVideoId(Long videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));

        return detectionRepository.countAllByVideo(video);
    }

    public Float getAvgConfidenceByVideoId(Long videoId) {
        return detectionRepository.findAverageConfidenceByVideoId(videoId) * 100;
    }
}
