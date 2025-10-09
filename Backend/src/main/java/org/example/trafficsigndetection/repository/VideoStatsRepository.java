package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.VideoStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VideoStatsRepository extends JpaRepository<VideoStats,Long> {
    
}
