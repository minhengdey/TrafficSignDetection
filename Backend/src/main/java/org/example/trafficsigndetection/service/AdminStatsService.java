package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.repository.DetectionRepository;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.example.trafficsigndetection.repository.UserRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminStatsService {
    VideoRepository videoRepository;
    DetectionRepository detectionRepository;
    TrafficSignTypeRepository trafficSignTypeRepository;
    UserRepository userRepository;

    public Map<String, Object> overview() {
        Map<String, Object> map = new HashMap<>();
        map.put("totalUsers", userRepository.count());
        map.put("totalVideos", videoRepository.count());
        map.put("totalDetections", detectionRepository.count());
        map.put("totalSignTypes", trafficSignTypeRepository.count());
        return map;
    }

    public Map<String, Object> detectionsOverTime() {
        // Simple grouping by date from detections.detectedAt
        List<Object[]> rows = detectionRepository.findAll().stream()
                .collect(Collectors.groupingBy(d -> d.getDetectedAt().toLocalDate(), Collectors.counting()))
                .entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(e -> new Object[] { e.getKey().toString(), e.getValue() })
                .collect(Collectors.toList());

        List<String> labels = new ArrayList<>();
        List<Long> values = new ArrayList<>();
        for (Object[] r : rows) {
            labels.add((String) r[0]);
            values.add((Long) r[1]);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("labels", labels);
        out.put("values", values);
        return out;
    }

    public Map<String, Object> topSigns() {
        Map<String, Long> counts = detectionRepository.findAll().stream()
                .map(d -> d.getSignType() != null ? d.getSignType().getName() : d.getLabel())
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));

        List<Map.Entry<String, Long>> list = counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue())).limit(10).collect(Collectors.toList());
        List<String> labels = list.stream().map(Map.Entry::getKey).collect(Collectors.toList());
        List<Long> values = list.stream().map(Map.Entry::getValue).collect(Collectors.toList());
        Map<String, Object> out = new HashMap<>();
        out.put("labels", labels);
        out.put("values", values);
        return out;
    }

    public Map<String, Object> videosByStatus() {
        Map<String, Long> counts = videoRepository.findAll().stream()
                .collect(Collectors.groupingBy(v -> v.getStatus().name(), Collectors.counting()));
        List<String> labels = new ArrayList<>(counts.keySet());
        List<Long> values = labels.stream().map(counts::get).collect(Collectors.toList());
        Map<String, Object> out = new HashMap<>();
        out.put("labels", labels);
        out.put("values", values);
        return out;
    }
}
