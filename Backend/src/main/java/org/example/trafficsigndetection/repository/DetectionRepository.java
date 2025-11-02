package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DetectionRepository extends JpaRepository<Detection, Long> {
    Page<Detection> findAllByOrderByDetectedAtDesc(Pageable pageable);

    int countAllByVideo(Video video);

    @Query(value = "SELECT AVG(confidence) FROM detections WHERE video_id = :videoId", nativeQuery = true)
    // Use wrapper Float because SQL AVG can return NULL when there are no rows
    Float findAverageConfidenceByVideoId(@Param("videoId") Long videoId);
}
