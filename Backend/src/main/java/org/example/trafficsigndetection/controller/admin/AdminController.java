package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.request.TrafficSignTypeRequest;
import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.dto.response.*;
import org.example.trafficsigndetection.service.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    UserService userService;
    VideoService videoService;
    TrafficSignTypeService trafficSignTypeService;
    DetectionService detectionService;
    AdminStatsService adminStatsService;

    @GetMapping("/users")
    public ApiResponse<Page<UserResponse>> listUsers(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.<Page<UserResponse>>builder()
                .code(1000)
                .result(userService.listUsers(pageable))
                .message("Successfully retrieved users")
                .build();
    }

    @GetMapping("/users/{id}")
    public ApiResponse<UserResponse> getUser(@PathVariable Long id) {
        return ApiResponse.<UserResponse>builder()
                .code(1000)
                .result(userService.getUser(id))
                .message("Successfully retrieved user")
                .build();
    }

    @PostMapping("/users")
    public ApiResponse<UserResponse> createUser(@RequestBody UserRequest request) {
        return ApiResponse.<UserResponse>builder()
                .code(1000)
                .result(userService.createUser(request))
                .message("User created successfully")
                .build();
    }

    @PutMapping("/users/{id}")
    public ApiResponse<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserRequest request) {
        return ApiResponse.<UserResponse>builder()
                .code(1000)
                .result(userService.updateUser(id, request))
                .message("User updated successfully")
                .build();
    }

    @DeleteMapping("/users/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("User deleted successfully")
                .build();
    }

    @GetMapping("/videos")
    public ApiResponse<Page<VideoResponse>> listVideos(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.<Page<VideoResponse>>builder()
                .code(1000)
                .result(videoService.listVideos(pageable))
                .message("Successfully retrieved videos")
                .build();
    }

    @GetMapping("/videos/{id}")
    public ApiResponse<VideoResponse> getVideo(@PathVariable Long id) {
        return ApiResponse.<VideoResponse>builder()
                .code(1000)
                .result(videoService.getVideo(id))
                .message("Successfully retrieved video")
                .build();
    }

    @DeleteMapping("/videos/{id}")
    public ApiResponse<Void> deleteVideo(@PathVariable Long id) {
        videoService.deleteVideo(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Video deleted successfully")
                .build();
    }

    @PostMapping("/videos/{id}/reprocess")
    public ApiResponse<VideoResponse> reprocessVideo(@PathVariable Long id) {
        return ApiResponse.<VideoResponse>builder()
                .code(1000)
                .result(videoService.reprocessVideo(id))
                .message("Video reprocessed successfully")
                .build();
    }

    @GetMapping("/videos/{id}/detections")
    public ApiResponse<Integer> getVideoDetections(@PathVariable Long id) {
        return ApiResponse.<Integer>builder()
                .code(1000)
                .result(detectionService.countDetectionsByVideoId(id))
                .message("Successfully retrieved video detections")
                .build();
    }

    @GetMapping("/sign-types")
    public ApiResponse<Page<TrafficSignTypeResponse>> listSignTypes(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);

        return ApiResponse.<Page<TrafficSignTypeResponse>>builder()
                .code(1000)
                .result(trafficSignTypeService.listSignTypes(pageable))
                .message("Successfully retrieved sign types")
                .build();
    }

    @GetMapping("/sign-types/{id}")
    public ApiResponse<TrafficSignTypeResponse> getSignType(@PathVariable Long id) {
        return ApiResponse.<TrafficSignTypeResponse>builder()
                .code(1000)
                .result(trafficSignTypeService.getSignType(id))
                .message("Successfully retrieved sign type")
                .build();
    }

    @PutMapping("/sign-types/{id}")
    public ApiResponse<TrafficSignTypeResponse> updateSignType(@PathVariable Long id,
            @RequestBody TrafficSignTypeRequest request) {
        return ApiResponse.<TrafficSignTypeResponse>builder()
                .code(1000)
                .result(trafficSignTypeService.updateSignType(id, request))
                .message("Sign type updated successfully")
                .build();
    }

    @DeleteMapping("/sign-types/{id}")
    public ApiResponse<Void> deleteSignType(@PathVariable Long id) {
        trafficSignTypeService.deleteSignType(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Sign type deleted successfully")
                .build();
    }

    @GetMapping("/detections")
    public ApiResponse<Page<DetectionResponse>> listDetections(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.<Page<DetectionResponse>>builder()
                .result(detectionService.listDetections(pageable))
                .code(1000)
                .message("Successfully retrieved detections")
                .build();
    }

    @GetMapping("/detections/{id}")
    public ApiResponse<DetectionResponse> getDetection(@PathVariable Long id) {
        return ApiResponse.<DetectionResponse>builder()
                .code(1000)
                .result(detectionService.getDetection(id))
                .message("Successfully retrieved detection")
                .build();
    }

    @DeleteMapping("/detections/{id}")
    public ApiResponse<Void> deleteDetection(@PathVariable Long id) {
        detectionService.deleteDetection(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Detection deleted successfully")
                .build();
    }

    @GetMapping("/stats/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.overview())
                .message("Successfully retrieved stats overview")
                .build();
    }

    @GetMapping("/stats/detections-over-time")
    public ApiResponse<Map<String, Object>> detectionsOverTime() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.detectionsOverTime())
                .message("Successfully retrieved detections-over-time stats")
                .build();
    }

    @GetMapping("/stats/top-signs")
    public ApiResponse<Map<String, Object>> topSigns() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.topSigns())
                .message("Successfully retrieved top signs stats")
                .build();
    }

    @GetMapping("/stats/videos-by-status")
    public ApiResponse<Map<String, Object>> videosByStatus() {
        return ApiResponse.<Map<String, Object>>builder()
                .code(1000)
                .result(adminStatsService.videosByStatus())
                .message("Successfully retrieved videos-by-status stats")
                .build();
    }
}
