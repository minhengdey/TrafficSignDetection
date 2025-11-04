package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.entity.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video,Long> {
    Page<Video> findAllByOrderByUploadedAtDesc(Pageable pageable);
    Page<Video> findAllByUserOrderByUploadedAtDesc(User user, Pageable pageable);
    int countAllByUser(User user);
    List<Video> findAllByUser(User user);

}
