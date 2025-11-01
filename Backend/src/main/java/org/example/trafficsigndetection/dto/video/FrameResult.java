package org.example.trafficsigndetection.dto.video;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FrameResult {
    private long frameIndex;
    private double timeSeconds;
    private String detectionJson;
}
