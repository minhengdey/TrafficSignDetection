package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.Detection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DetectionRepository extends JpaRepository<Detection,Long> {
    
}
