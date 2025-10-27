package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminVideoService {
    VideoRepository videoRepository;

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
        // Simple reprocess simulation: set status to UPLOADED and clear processedAt
        v.setStatus(org.example.trafficsigndetection.enums.VideoStatus.UPLOADED);
        v.setProcessedAt(null);
        return videoRepository.save(v);
    }
}
