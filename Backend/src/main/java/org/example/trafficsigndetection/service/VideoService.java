package org.example.trafficsigndetection.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.example.trafficsigndetection.repository.UserRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class VideoService {
    VideoRepository videoRepository;
    UserRepository userRepository;

    /**
     * Save a Video for the given username. Returns the saved Video if successful.
     */
    @Transactional
    public java.util.Optional<Video> saveVideoForUsername(String username, String filename, String filepath,
            Long filesize, Integer durationSeconds, VideoStatus status) {
        if (username == null) {
            log.debug("saveVideoForUsername called with null username - skipping save");
            return java.util.Optional.empty();
        }
        return userRepository.findByUsername(username).map(u -> {
            Video v = Video.builder()
                    .filename(filename)
                    .filepath(filepath)
                    .filesize(filesize)
                    .durationSeconds(durationSeconds)
                    .status(status == null ? VideoStatus.UPLOADED : status)
                    .user(u)
                    .build();
            Video saved = videoRepository.save(v);
            log.info("Saved video id={} filename={} for user={}", saved.getId(), saved.getFilename(), username);
            return saved;
        });
    }

    /**
     * Check whether a user with given username exists.
     */
    public boolean userExists(String username) {
        if (username == null)
            return false;
        return userRepository.findByUsername(username).isPresent();
    }
}
