package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.dto.response.UserResponse;
import org.example.trafficsigndetection.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin")
public class AdminController {
    AdminUserService adminUserService;
    AdminVideoService adminVideoService;
    AdminSignTypeService adminSignTypeService;
    AdminDetectionService adminDetectionService;
    AdminStatsService adminStatsService;

    // Users
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> listUsers() {
        return ResponseEntity.ok(adminUserService.listUsers());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(adminUserService.getUser(id));
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@RequestBody UserRequest request) {
        return ResponseEntity.ok(adminUserService.createUser(request));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserRequest request) {
        return ResponseEntity.ok(adminUserService.updateUser(id, request));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        adminUserService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    // Videos
    @GetMapping("/videos")
    public ResponseEntity<List<Video>> listVideos() {
        return ResponseEntity.ok(adminVideoService.listVideos());
    }

    @GetMapping("/videos/{id}")
    public ResponseEntity<Video> getVideo(@PathVariable Long id) {
        return ResponseEntity.ok(adminVideoService.getVideo(id));
    }

    @DeleteMapping("/videos/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable Long id) {
        adminVideoService.deleteVideo(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/videos/{id}/reprocess")
    public ResponseEntity<Video> reprocessVideo(@PathVariable Long id) {
        return ResponseEntity.ok(adminVideoService.reprocessVideo(id));
    }

    @GetMapping("/videos/{id}/detections")
    public ResponseEntity<List<Detection>> getVideoDetections(@PathVariable Long id) {
        Video v = adminVideoService.getVideo(id);
        return ResponseEntity.ok(v.getDetections());
    }

    // Sign types
    @GetMapping("/sign-types")
    public ResponseEntity<List<TrafficSignType>> listSignTypes() {
        return ResponseEntity.ok(adminSignTypeService.listSignTypes());
    }

    @GetMapping("/sign-types/{id}")
    public ResponseEntity<TrafficSignType> getSignType(@PathVariable Long id) {
        return ResponseEntity.ok(adminSignTypeService.getSignType(id));
    }

    @PostMapping("/sign-types")
    public ResponseEntity<TrafficSignType> createSignType(@RequestBody TrafficSignType payload) {
        return ResponseEntity.ok(adminSignTypeService.createSignType(payload));
    }

    @PutMapping("/sign-types/{id}")
    public ResponseEntity<TrafficSignType> updateSignType(@PathVariable Long id, @RequestBody TrafficSignType payload) {
        return ResponseEntity.ok(adminSignTypeService.updateSignType(id, payload));
    }

    @DeleteMapping("/sign-types/{id}")
    public ResponseEntity<Void> deleteSignType(@PathVariable Long id) {
        adminSignTypeService.deleteSignType(id);
        return ResponseEntity.noContent().build();
    }

    // Detections
    @GetMapping("/detections")
    public ResponseEntity<List<Detection>> listDetections() {
        return ResponseEntity.ok(adminDetectionService.listDetections());
    }

    @GetMapping("/detections/{id}")
    public ResponseEntity<Detection> getDetection(@PathVariable Long id) {
        return ResponseEntity.ok(adminDetectionService.getDetection(id));
    }

    @PutMapping("/detections/{id}")
    public ResponseEntity<Detection> updateDetection(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String label = body.containsKey("label") ? (String) body.get("label") : null;
        Float confidence = body.containsKey("confidence") ? Float.valueOf(String.valueOf(body.get("confidence")))
                : null;
        Long signTypeId = body.containsKey("signTypeId") ? Long.valueOf(String.valueOf(body.get("signTypeId"))) : null;
        return ResponseEntity.ok(adminDetectionService.updateDetection(id, label, confidence, signTypeId));
    }

    @DeleteMapping("/detections/{id}")
    public ResponseEntity<Void> deleteDetection(@PathVariable Long id) {
        adminDetectionService.deleteDetection(id);
        return ResponseEntity.noContent().build();
    }

    // Stats
    @GetMapping("/stats/overview")
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(adminStatsService.overview());
    }

    @GetMapping("/stats/detections-over-time")
    public ResponseEntity<Map<String, Object>> detectionsOverTime() {
        return ResponseEntity.ok(adminStatsService.detectionsOverTime());
    }

    @GetMapping("/stats/top-signs")
    public ResponseEntity<Map<String, Object>> topSigns() {
        return ResponseEntity.ok(adminStatsService.topSigns());
    }

    @GetMapping("/stats/videos-by-status")
    public ResponseEntity<Map<String, Object>> videosByStatus() {
        return ResponseEntity.ok(adminStatsService.videosByStatus());
    }
}
