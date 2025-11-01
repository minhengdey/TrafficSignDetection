package org.example.trafficsigndetection.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.response.VideoResponse;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.VideoMapper;
import org.example.trafficsigndetection.repository.UserRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class VideoService {
    VideoRepository videoRepository;
    UserRepository userRepository;
    VideoMapper videoMapper;

    @Transactional
    public Optional<Video> saveVideoForUsername(String username, String filename, String filepath,
                                                Long filesize, VideoStatus status) {
        if (!userRepository.existsByUsername(username)) {
            log.debug("saveVideoForUsername called with null username - skipping save");
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }
        return userRepository.findByUsername(username).map(u -> {
            Video v = Video.builder()
                    .filename(filename)
                    .filepath(filepath)
                    .filesize(filesize)
                    .status(status == null ? VideoStatus.UPLOADED : status)
                    .user(u)
                    .build();
            Video saved = videoRepository.save(v);
            log.info("Saved video id={} filename={} for user={}", saved.getId(), saved.getFilename(), username);
            return saved;
        });
    }

    public VideoResponse findByVideoId(Long videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
        return videoMapper.toResponse(video);
    }
}
