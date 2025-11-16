package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.service.DetectionService;
import org.example.trafficsigndetection.service.VideoService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin/videos")
@PreAuthorize("hasRole('ADMIN')")
public class AdminVideoController {
    VideoService videoService;
    DetectionService detectionService;

    @GetMapping()
    public ApiResponse<Page<VideoResponse>> listVideos(@RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.<Page<VideoResponse>>builder()
                .code(1000)
                .result(videoService.listVideos(pageable))
                .message("Successfully retrieved videos")
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<VideoResponse> getVideo(@PathVariable Long id) {
        return ApiResponse.<VideoResponse>builder()
                .code(1000)
                .result(videoService.getVideo(id))
                .message("Successfully retrieved video")
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteVideo(@PathVariable Long id) {
        videoService.deleteVideo(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Video deleted successfully")
                .build();
    }

    @PostMapping("/{id}/reprocess")
    public ApiResponse<VideoResponse> reprocessVideo(@PathVariable Long id) {
        return ApiResponse.<VideoResponse>builder()
                .code(1000)
                .result(videoService.reprocessVideo(id))
                .message("Video reprocessed successfully")
                .build();
    }

    @GetMapping("/{id}/detections")
    public ApiResponse<Integer> getVideoDetections(@PathVariable Long id) {
        return ApiResponse.<Integer>builder()
                .code(1000)
                .result(detectionService.countDetectionsByVideoId(id))
                .message("Successfully retrieved video detections")
                .build();
    }
}
