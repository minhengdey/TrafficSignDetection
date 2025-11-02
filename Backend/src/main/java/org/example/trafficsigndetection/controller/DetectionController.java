package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.service.DetectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/detection")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DetectionController {
    DetectionService detectionService;

    @GetMapping("/{videoId}/avg-confidence")
    public ApiResponse<Float> getAvgConfidence(@PathVariable("videoId") Long videoId) {
        return ApiResponse.<Float>builder()
                .code(1000)
                .result(detectionService.getAvgConfidenceByVideoId(videoId))
                .message("Successfully get avg confidence")
                .build();
    }

    @GetMapping("/{videoId}/detections")
    public ApiResponse<Integer> getVideoDetections(@PathVariable("videoId") Long videoId) {
        return ApiResponse.<Integer>builder()
                .code(1000)
                .result(detectionService.countDetectionsByVideoId(videoId))
                .message("Successfully retrieved video detections")
                .build();
    }
}
