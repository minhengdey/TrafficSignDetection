package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.TrafficSignTypeResponse;
import org.example.trafficsigndetection.service.TrafficSignTypeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/sign-type")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrafficSignTypeController {
    TrafficSignTypeService trafficSignTypeService;

    @GetMapping("/{code}")
    public ApiResponse<TrafficSignTypeResponse> findDescriptionByCode(@PathVariable String code) {
        return ApiResponse.<TrafficSignTypeResponse>builder()
                .result(trafficSignTypeService.getTrafficSignTypeByCode(code))
                .code(1000)
                .build();
    }
}
