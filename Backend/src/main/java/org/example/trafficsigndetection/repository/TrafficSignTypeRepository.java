package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.TrafficSignType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TrafficSignTypeRepository extends JpaRepository<TrafficSignType,Long> {
    
}
