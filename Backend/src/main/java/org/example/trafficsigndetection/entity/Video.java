package org.example.trafficsigndetection.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.enums.VideoStatus;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(name = "videos")
public class Video {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Column(nullable = false, length = 255)
    String filename;

    @Column(nullable = false, length = 500)
    String filepath;

    @Column
    Long filesize;

    @Column(name = "duration_seconds")
    Integer durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    VideoStatus status = VideoStatus.UPLOADED;

    @Column(name = "uploaded_at", nullable = false)
    LocalDateTime uploadedAt;

    @Column(name = "processed_at")
    LocalDateTime processedAt;

    @JsonIgnore
    @OneToMany(mappedBy = "video", cascade = CascadeType.ALL, orphanRemoval = true)
    List<Detection> detections = new ArrayList<>();

    @OneToOne(mappedBy = "video", cascade = CascadeType.ALL)
    VideoStats videoStats;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
