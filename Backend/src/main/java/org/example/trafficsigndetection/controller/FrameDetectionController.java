package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.FrameDetectionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/frame")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class FrameDetectionController {
    FrameDetectionService frameDetectionService;

    @PostMapping(value = "/detection", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<Map<String, Object>> detectFrame(@RequestBody Map<String, Object> payload) {
        try {
            if (payload == null || !payload.containsKey("image")) {
                log.error("image payload is required for frame detection");
                throw new AppException(org.example.trafficsigndetection.enums.ErrorCode.DETECTION_ERROR);
            }

            String base64 = String.valueOf(payload.get("image"));

            return ApiResponse.<Map<String, Object>>builder()
                    .code(1000)
                    .message("Frame detected")
                    .result(frameDetectionService.detectFromBase64(base64))
                    .build();
        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("frame detection controller error", e);
            throw new AppException(org.example.trafficsigndetection.enums.ErrorCode.ROBOFLOW_ERROR);
        }
    }
}
