package org.example.trafficsigndetection.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.entity.Video;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DetectionResponse {
    Long id;
    Video video;
    Integer frameNumber;
    TrafficSignType signType;
    String label;
    Float confidence;
    Integer bboxX;
    Integer bboxY;
    Integer bboxW;
    Integer bboxH;
    Integer origImageWidth;
    Integer origImageHeight;
    LocalDateTime detectedAt;
}
