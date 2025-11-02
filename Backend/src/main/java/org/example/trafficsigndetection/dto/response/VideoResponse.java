package org.example.trafficsigndetection.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.enums.VideoStatus;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class VideoResponse {
    Long id;
    User user;
    String filename;
    String filepath;
    Long filesize;
    VideoStatus status;
    LocalDateTime uploadedAt;
    List<DetectionResponse> detections;
}
