package org.example.trafficsigndetection.controller.admin;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.request.TrafficSignTypeRequest;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.service.TrafficSignTypeService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/admin/sign-types")
@PreAuthorize("hasRole('ADMIN')")
public class AdminTrafficSignTypeController {
    TrafficSignTypeService trafficSignTypeService;

    @GetMapping()
    public ApiResponse<Page<TrafficSignTypeResponse>> listSignTypes(@RequestParam(defaultValue = "0") int page,
                                                                    @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);

        return ApiResponse.<Page<TrafficSignTypeResponse>>builder()
                .code(1000)
                .result(trafficSignTypeService.listSignTypes(pageable))
                .message("Successfully retrieved sign types")
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<TrafficSignTypeResponse> getSignType(@PathVariable Long id) {
        return ApiResponse.<TrafficSignTypeResponse>builder()
                .code(1000)
                .result(trafficSignTypeService.getSignType(id))
                .message("Successfully retrieved sign type")
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<TrafficSignTypeResponse> updateSignType(@PathVariable Long id,
                                                               @RequestBody TrafficSignTypeRequest request) {
        return ApiResponse.<TrafficSignTypeResponse>builder()
                .code(1000)
                .result(trafficSignTypeService.updateSignType(id, request))
                .message("Sign type updated successfully")
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteSignType(@PathVariable Long id) {
        trafficSignTypeService.deleteSignType(id);
        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Sign type deleted successfully")
                .build();
    }
}
