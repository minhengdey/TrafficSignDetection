package org.example.trafficsigndetection.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.Role;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    Long id;
    String username;
    String email;
    Role role;
    LocalDateTime createdAt;
    List<Video> videos;
}