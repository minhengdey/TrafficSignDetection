package org.example.trafficsigndetection.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.B2Service;
import org.example.trafficsigndetection.service.UserService;
import org.example.trafficsigndetection.service.VideoService;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@Slf4j
@RequestMapping("/api/upload")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UploadController {

    static long MAX_FILE_SIZE = 100L * 1024L * 1024L;
    static Duration PRESIGNED_URL_DURATION = Duration.ofHours(24);

    B2Service b2Service;
    VideoService videoService;
    UserService userService;

    @PostMapping()
    public ApiResponse<?> handleUpload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.VIDEO_ERROR);
        }

        String username = getAuthenticatedUsername();

        if (!userService.existsByUsername(username)) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        long fileSize = file.getSize();
        if (fileSize > MAX_FILE_SIZE) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE);
        }

        b2Service.assertBucketAccessible();

        return handleSimpleUpload(file, username);
    }

    private ApiResponse<?> handleSimpleUpload(MultipartFile file, String username) {
        try {
            String keySaved = b2Service.uploadSimple(file);
            String url = b2Service.getObjectUrl(keySaved);

            Video video = Video.builder()
                    .filesize(file.getSize())
                    .filepath(url)
                    .filename(LocalDateTime.now()
                            .format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
                            + "_" + username)
                    .status(VideoStatus.UPLOADED)
                    .build();
            VideoResponse savedVideo = videoService.saveVideoForUsername(username, video);

            Map<String, Object> response = new HashMap<>();
            response.put("key", keySaved);
            response.put("url", url);

            if (savedVideo == null) {
                throw new AppException(ErrorCode.VIDEO_NOT_FOUND);
            }

            response.put("videoId", savedVideo.getId());

            try {
                String presignedGet = b2Service.presignGetUrl(keySaved, PRESIGNED_URL_DURATION);
                response.put("presignedGetUrl", presignedGet);
            } catch (Exception ex) {
                log.warn("Failed to generate presignedGetUrl for key {}: {}", keySaved, ex.getMessage());
                throw new AppException(ErrorCode.FILE_UPLOAD_ERROR);
            }

            return ApiResponse.<Map<String, Object>>builder()
                    .message("Successfully uploaded video")
                    .code(1000)
                    .result(response)
                    .build();
        } catch (Exception e) {
            log.error("Simple upload failed", e);
            throw new AppException(ErrorCode.FILE_UPLOAD_ERROR);
        }
    }

    private String getAuthenticatedUsername() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) {
                throw new AppException(ErrorCode.UNAUTHENTICATED);
            }
            return auth.getName();
        } catch (Exception e) {
            log.error("Failed to get authenticated username", e);
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
    }
}