package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.TrafficSignType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TrafficSignTypeRepository extends JpaRepository<TrafficSignType,Long> {
    Optional<TrafficSignType> findByCode(String code);
    Page<TrafficSignType> findAll(Pageable pageable);
}
