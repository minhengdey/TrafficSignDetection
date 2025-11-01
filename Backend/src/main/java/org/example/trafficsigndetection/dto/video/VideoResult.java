package org.example.trafficsigndetection.dto.video;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class VideoResult {
    private String status;
    private List<FrameResult> frames;
}
