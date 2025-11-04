package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.dto.video.VideoResult;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.VideoProcessingService;
import org.example.trafficsigndetection.service.VideoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/video")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class VideoController {
    VideoProcessingService videoProcessingService;
    VideoService videoService;

    @PostMapping(value = "/detection", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<?> detectFromUrl(@RequestBody Map<String, Object> payload) {
        try {
            if (payload == null || !payload.containsKey("videoUrl")) {
                log.error("videoUrl is required");
                throw new AppException(ErrorCode.DETECTION_ERROR);
            }

            String videoUrl = String.valueOf(payload.get("videoUrl"));

            Object vidObj = payload.get("videoId");
            Long videoId = null;
            try {
                if (vidObj != null)
                    videoId = Long.valueOf(String.valueOf(vidObj));
            } catch (NumberFormatException ignored) {
            }

            VideoResult result = videoProcessingService.processVideoFromUrl(videoUrl, videoId);

            Map<String, Object> resp = new HashMap<>();
            resp.put("status", "ok");
            resp.put("frames", result.getFrames());
            resp.put("videoUrl", videoUrl);
            if (videoId != null)
                resp.put("videoId", videoId);

            return ApiResponse.<Map<String, Object>>builder()
                    .code(1000)
                    .message("Successfully detected")
                    .result(resp)
                    .build();
        } catch (Exception e) {
            e.printStackTrace();
            throw new AppException(ErrorCode.DETECTION_ERROR);
        }
    }

    @GetMapping("/{id}")
    public ApiResponse<VideoResponse> getVideoById(@PathVariable("id") Long id) {
        return ApiResponse.<VideoResponse>builder()
                .result(videoService.getVideo(id))
                .code(1000)
                .build();
    }
}
