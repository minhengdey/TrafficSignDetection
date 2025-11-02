package org.example.trafficsigndetection.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrafficSignTypeRequest {
    String name_vi;
    String name_en;
    String description;
}
