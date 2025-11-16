package org.example.trafficsigndetection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.type.TypeReference;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class FrameDetectionService {
    ObjectMapper objectMapper;
    TrafficSignTypeRepository trafficSignTypeRepository;

    @NonFinal
    @Value("${roboflow.api.key:}")
    String roboflowApiKey;

    @NonFinal
    @Value("${roboflow.project.id}")
    String roboflowModel;

    @NonFinal
    @Value("${roboflow.model.version}")
    String roboflowVersion;

    RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> detectFromBase64(String base64Image) {
        if (roboflowApiKey == null || roboflowApiKey.isBlank()) {
            log.error("Roboflow API key not configured");
            throw new AppException(ErrorCode.DETECTION_ERROR);
        }

        try {
            String detectUrl = String.format("https://detect.roboflow.com/%s/%s?api_key=%s",
                    roboflowModel, roboflowVersion, roboflowApiKey);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            HttpEntity<String> request = new HttpEntity<>(base64Image, headers);

            String response = restTemplate.postForObject(detectUrl, request, String.class);

            log.info("Response from Roboflow: {}", response);

            JsonNode root = objectMapper.readTree(response); // Parse JSON

            List<TrafficSignType> trafficSignTypes = new ArrayList<>();

            JsonNode predictions = root.get("predictions");
            // Phân tích chi tiết từng predictions và lưu vào bảng detection
            for (JsonNode prediction : predictions) {
                try {
                    String label = prediction.get("class").asText();

                    // Tìm loại biển báo vừa detect đuợc ở trong DB
                    TrafficSignType signType = trafficSignTypeRepository.findByCode(label)
                            .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

                    trafficSignTypes.add(signType);
                } catch (Exception e) {
                    log.warn("Failed to parse prediction: {}", e.getMessage());
                }
            }

            Map<String, Object> map = new HashMap<>();
            map.put("types", trafficSignTypes);
            map.put("predictions", predictions);

            return map;
        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("frame detection failed", e);
            throw new AppException(ErrorCode.ROBOFLOW_ERROR);
        }
    }
}
