package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.UserService;
import org.example.trafficsigndetection.service.VideoService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/user")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserController {
    UserService userService;
    VideoService videoService;

    @GetMapping("/videos")
    public ApiResponse<Page<VideoResponse>> getMyVideos(@RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "5") int size) {
        Pageable pageable = PageRequest.of(page, size);

        return ApiResponse.<Page<VideoResponse>>builder()
                .code(1000)
                .result(videoService.getVideosByUsername(getMyUsername(), pageable))
                .message("Successfully get my videos")
                .build();
    }

    @GetMapping("/total-uploads")
    public ApiResponse<Integer> getTotalUploads() {
        return ApiResponse.<Integer>builder()
                .code(1000)
                .result(videoService.getTotalUploadsByUsername(getMyUsername()))
                .message("Successfully get total uploads")
                .build();
    }

    @GetMapping("/signs-detected")
    public ApiResponse<Integer> getSignsDetected() {
        return ApiResponse.<Integer>builder()
                .code(1000)
                .result(videoService.getSignsDetectedByUsername(getMyUsername()))
                .message("Successfully get signs detected")
                .build();
    }

    public String getMyUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        return auth.getName();
    }
}
