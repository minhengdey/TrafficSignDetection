package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.DetectionResponse;
import org.example.trafficsigndetection.service.DetectionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin/detections")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDetectionController {
    DetectionService detectionService;

    @GetMapping()
    public ApiResponse<Page<DetectionResponse>> listDetections(@RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.<Page<DetectionResponse>>builder()
                .result(detectionService.listDetections(pageable))
                .code(1000)
                .message("Successfully retrieved detections")
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<DetectionResponse> getDetection(@PathVariable Long id) {
        return ApiResponse.<DetectionResponse>builder()
                .code(1000)
                .result(detectionService.getDetection(id))
                .message("Successfully retrieved detection")
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteDetection(@PathVariable Long id) {
        detectionService.deleteDetection(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Detection deleted successfully")
                .build();
    }
}
