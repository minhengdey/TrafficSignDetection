package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.*;
import org.example.trafficsigndetection.service.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin/stats")
@PreAuthorize("hasRole('ADMIN')")
public class AdminStatsController {
    AdminStatsService adminStatsService;

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.overview())
                .message("Successfully retrieved stats overview")
                .build();
    }

    @GetMapping("/detections-over-time")
    public ApiResponse<Map<String, Object>> detectionsOverTime() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.detectionsOverTime())
                .message("Successfully retrieved detections-over-time stats")
                .build();
    }

    @GetMapping("/top-signs")
    public ApiResponse<Map<String, Object>> topSigns() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.topSigns())
                .message("Successfully retrieved top signs stats")
                .build();
    }

    @GetMapping("/videos-by-status")
    public ApiResponse<Map<String, Object>> videosByStatus() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.videosByStatus())
                .message("Successfully retrieved videos-by-status stats")
                .build();
    }
}
