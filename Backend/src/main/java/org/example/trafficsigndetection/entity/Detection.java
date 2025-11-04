package org.example.trafficsigndetection.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
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
    @JsonIgnore
    Video video;

    @Column(name = "frame_number")
    Integer frameNumber;

    @JsonIgnore
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

    @Column(name = "orig_image_w")
    Integer origImageWidth;

    @Column(name = "orig_image_h")
    Integer origImageHeight;

    @Column(name = "detected_at", nullable = false)
    LocalDateTime detectedAt;

    @PrePersist
    protected void onCreate() {
        detectedAt = LocalDateTime.now();
    }
}
