package org.example.trafficsigndetection.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.DetectionResponse;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.VideoMapper;
import org.example.trafficsigndetection.repository.DetectionRepository;
import org.example.trafficsigndetection.repository.UserRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class VideoService {
    VideoRepository videoRepository;
    UserRepository userRepository;
    VideoMapper videoMapper;
    VideoProcessingService videoProcessingService;
    DetectionService detectionService;

    public Page<VideoResponse> listVideos(Pageable pageable) {
        Page<Video> videos = videoRepository.findAllByOrderByUploadedAtDesc(pageable);
        List<VideoResponse> responses = videos.getContent()
                .stream().map(videoMapper::toResponse).toList();
        return new PageImpl<>(responses, pageable, videos.getTotalElements());
    }

    public VideoResponse getVideo(Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));

        return videoMapper.toResponse(video);
    }

    @Transactional(rollbackOn = AppException.class)
    public void deleteVideo(Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
        videoRepository.delete(video);
    }

    @Transactional(rollbackOn = AppException.class)
    public VideoResponse reprocessVideo(Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
        try {
            video.setStatus(VideoStatus.PROCESSING);
            videoRepository.save(video);
            String url = video.getFilepath();
            videoProcessingService.processVideoFromUrl(url, video.getId());
            video.setStatus(VideoStatus.DONE);
            video.setUploadedAt(LocalDateTime.now());
            return videoMapper.toResponse(videoRepository.save(video));
        } catch (Exception ex) {
            log.error("Reprocess video failed id={}", id, ex);
            video.setStatus(VideoStatus.FAILED);
            video.setUploadedAt(LocalDateTime.now());
            videoRepository.save(video);
            throw new AppException(ErrorCode.REPROCESS_VIDEO_ERROR);
        }
    }

    @Transactional(rollbackOn = AppException.class)
    public VideoResponse saveVideoForUsername(String username, Video video) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        video.setUser(user);

        return videoMapper.toResponse(videoRepository.save(video));
    }

    public Page<VideoResponse> getVideosByUsername(String username, Pageable pageable) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Page<Video> videos = videoRepository.findAllByUserOrderByUploadedAtDesc(user, pageable);
        List<VideoResponse> responses = videos.getContent()
                .stream().map(videoMapper::toResponse).toList();
        return new PageImpl<>(responses, pageable, videos.getTotalElements());
    }

    public int getTotalUploadsByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return videoRepository.countAllByUser(user);
    }

    public int getSignsDetectedByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        List<Video> videos = videoRepository.findAllByUser(user);
        int totalCount = 0;

        for (Video video : videos) {
            totalCount += detectionService.countDetectionsByVideoId(video.getId());
        }

        return totalCount;
    }
}
