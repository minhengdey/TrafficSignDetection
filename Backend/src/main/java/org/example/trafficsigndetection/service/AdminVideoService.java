package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AdminVideoService {
    VideoRepository videoRepository;
    VideoProcessingService videoProcessingService;

    public List<Video> listVideos() {
        return videoRepository.findAll();
    }

    public Video getVideo(Long id) {
        return videoRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
    }

    public void deleteVideo(Long id) {
        Video v = videoRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
        videoRepository.delete(v);
    }

    public Video reprocessVideo(Long id) {
        Video v = videoRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));
        try {
            v.setStatus(VideoStatus.PROCESSING);
            videoRepository.save(v);
            // filename lưu URL cloud
            String url = v.getFilename();
            videoProcessingService.processVideoFromUrl(url);
            v.setStatus(VideoStatus.DONE);
            return videoRepository.save(v);
        } catch (Exception ex) {
            log.error("Reprocess video failed id={}", id, ex);
            v.setStatus(VideoStatus.FAILED);
            return videoRepository.save(v);
        }
    }
}
