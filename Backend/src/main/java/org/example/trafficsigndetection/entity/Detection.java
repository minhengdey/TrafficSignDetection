package org.example.trafficsigndetection.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(name = "detections")
public class Detection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false)
    Video video;

    @Column(name = "frame_number")
    Integer frameNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sign_type_id")
    TrafficSignType signType;

    @Column(length = 200)
    String label;

    @Column
    Float confidence;

    @Column(name = "bbox_x")
    Integer bboxX;

    @Column(name = "bbox_y")
    Integer bboxY;

    @Column(name = "bbox_w")
    Integer bboxW;

    @Column(name = "bbox_h")
    Integer bboxH;

    @Column(name = "cropped_image_path", length = 500)
    String croppedImagePath;

    @Column(name = "detected_at", nullable = false)
    LocalDateTime detectedAt;

    @PrePersist
    protected void onCreate() {
        detectedAt = LocalDateTime.now();
    }
}

