package org.example.trafficsigndetection.controller;

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

@RestController
@RequestMapping("/api/video")
public class VideoController {
    private final VideoProcessingService videoProcessingService;
    private final VideoService videoService;

    public VideoController(VideoProcessingService videoProcessingService, VideoService videoService) {
        this.videoProcessingService = videoProcessingService;
        this.videoService = videoService;
    }

    @PostMapping("/detection")
    public ResponseEntity<VideoResult> uploadVideo(@RequestParam("file") MultipartFile file) {
        try {
            VideoResult result = videoProcessingService.processVideo(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new VideoResult("error", null));
        }
    }

    @PostMapping(value = "/detection", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> detectFromUrl(@RequestBody Map<String, Object> payload) {
        try {
            if (payload == null || !payload.containsKey("videoUrl")) {
                return ResponseEntity.badRequest().body(Map.of("error", "videoUrl is required"));
            }

            String videoUrl = String.valueOf(payload.get("videoUrl"));
            // optional videoId passed through
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

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ApiResponse<VideoResponse> getVideoById(@PathVariable("id") Long id) {
        return ApiResponse.<VideoResponse>builder()
                .result(videoService.findByVideoId(id))
                .code(1000)
                .build();
    }
}
