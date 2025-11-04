package org.example.trafficsigndetection.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrafficSignTypeResponse {
    Integer id;
    String code;
    String name_vi;
    String name_en;
    String description;
}
