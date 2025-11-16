package org.example.trafficsigndetection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.dto.video.FrameResult;
import org.example.trafficsigndetection.entity.Detection;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.entity.Video;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.example.trafficsigndetection.dto.video.VideoResult;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Frame;
import org.bytedeco.javacv.Java2DFrameConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class VideoProcessingService {
    static double DEFAULT_FRAME_RATE = 25.0;
    static double DEFAULT_INTERVAL_SECONDS = 1.0;
    static String IMAGE_FORMAT = "jpg";
    static String TEMP_FILE_PREFIX = "cloud-";
    static String TEMP_FILE_SUFFIX = ".mp4";

    VideoRepository videoRepository;
    TrafficSignTypeRepository trafficSignTypeRepository;
    ObjectMapper objectMapper;

    @Value("${roboflow.api.key:}")
    @NonFinal
    String roboflowApiKey;

    @Value("${roboflow.project.id}")
    @NonFinal
    String roboflowModel;

    @Value("${roboflow.model.version}")
    @NonFinal
    String roboflowVersion;

    @Value("${temp-dir:D:/Bin/tmp/roboflow-video}")
    @NonFinal
    String tempDir;

    RestTemplate restTemplate = new RestTemplate();

    public VideoResult processVideoFromUrl(String url, Long videoId) throws Exception {
        // Tạo đường dẫn tạm để lưu video từ cloud về
        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);
        File tempFile = File.createTempFile(TEMP_FILE_PREFIX, TEMP_FILE_SUFFIX, tmpDirPath.toFile());

        VideoResult result;
        try {
            // Tải video từ url và lưu vào đường dẫn tạm vừa tạo
            try (InputStream in = new URL(url).openStream()) {
                Files.copy(in, tempFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }

            List<FrameResult> frames = new ArrayList<>(); // Danh sách kết quả của từng frame
            try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(tempFile)) {
                grabber.start(); // Bắt đầu đọc video từ file tạm

                // Lấy frameRate (số frame/s) của video, nếu không thì dùng giá trị mặc định
                double frameRate = grabber.getFrameRate() <= 0 ? DEFAULT_FRAME_RATE : grabber.getFrameRate();
                // Tính khoảng cách giữa các frame cần trích xuất (tính bằng số frame thực tế)
                long frameInterval = Math.max(1, Math.round(frameRate * DEFAULT_INTERVAL_SECONDS));
                long totalFrames = grabber.getLengthInFrames(); // Tổng số frame toàn bộ video

                try (Java2DFrameConverter converter = new Java2DFrameConverter()) {
                    Frame frame;
                    int frameIndex = 0;
                    // Lấy từng frame ảnh của video
                    while ((frame = grabber.grabImage()) != null) {
                        if (frameIndex % frameInterval == 0) {
                            // Convert từ frame sang BufferedImage
                            BufferedImage image = converter.convert(frame);
                            if (image != null) {
                                // Kê quả trả về sau khi gửi thành công frame lên roboflow detect (json)
                                String detectionJson = "";

                                // Kiểm tra API key trước khi gửi
                                if (roboflowApiKey == null || roboflowApiKey.isBlank()) {
                                    throw new AppException(ErrorCode.DETECTION_ERROR); // Nếu chưa cấu hình API key -> báo lỗi
                                }

                                try {
                                    // Chuyển ảnh sang mảng byte theo định dạng jpg
                                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                                    ImageIO.write(image, IMAGE_FORMAT, outputStream);
                                    byte[] imageBytes = outputStream.toByteArray();
                                    String base64Image = Base64.getEncoder().encodeToString(imageBytes); // Mã hóa base64

                                    // Lấy đường dẫn endpoint API roboflow để gửi ảnh lên để dêtct
                                    String detectUrl = String.format("https://detect.roboflow.com/%s/%s?api_key=%s",
                                            roboflowModel, roboflowVersion, roboflowApiKey);

                                    // Tạo header và gửi ảnh lên API roboflow nhận diện
                                    HttpHeaders headers = new HttpHeaders();
                                    headers.setContentType(MediaType.TEXT_PLAIN);
                                    HttpEntity<String> request = new HttpEntity<>(base64Image, headers);
                                    ResponseEntity<String> response = restTemplate.postForEntity(detectUrl, request,
                                            String.class);
                                    detectionJson = response.getBody(); // Kết quả trả về dạng JSON

                                    log.info("Detection json: {}", detectionJson);
                                } catch (Exception e) {
                                }

                                double timeSeconds = frameRate > 0 ? (double) frameIndex / frameRate : frameIndex;
                                // Thêm kết quả frame vào danh sách trả về
                                frames.add(new FrameResult(frameIndex, timeSeconds, detectionJson));
                            }
                        }
                        frameIndex++;

                        // Nếu đã đọc quá tổng số frame thì dừng
                        if (totalFrames > 0 && frameIndex > totalFrames) {
                            break;
                        }
                    }
                }
                grabber.stop(); // Kết thúc xử lý và đóng file video
            }
            // Trả về kết quả, frame đã nhận diện biển báo
            result = new VideoResult("ok", frames);
        } finally {
            // Xóa file tạm đã tạo lúc đầu sau khi xử lý xong
            try {
                Files.deleteIfExists(tempFile.toPath());
            } catch (Exception e) {
            }
        }

        // Lưu kết quả nhận diện frame vào bảng Detection
        if (videoId != null && result.getFrames() != null && !result.getFrames().isEmpty()) {
            Video video = videoRepository.findById(videoId)
                    .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));

            List<Detection> detections = new ArrayList<>(); // Danh sách detection của tất cả frame
            // Parse kết quả đối với từng frame
            for (FrameResult frame : result.getFrames()) {
                if (!(frame.getDetectionJson() != null && !frame.getDetectionJson().isBlank())) {
                    continue; // Nếu không có kết quả json thì bỏ qua frame đó
                }
                try {
                    JsonNode root = objectMapper.readTree(frame.getDetectionJson()); // Parse JSON
                    ImageDimensions imageDims;
                    JsonNode imageNode = root.get("image");
                    int width = imageNode.has("width") ? imageNode.get("width").asInt(-1) : -1;
                    int height = imageNode.has("height") ? imageNode.get("height").asInt(-1) : -1;

                    imageDims = new ImageDimensions(width, height); // Kích thước ảnh gốc
                    JsonNode predictions = root.get("predictions");
                    // Phân tích chi tiết từng predictions và lưu vào bảng detection
                    for (JsonNode prediction : predictions) {
                        try {
                            String label = prediction.get("class").asText();
                            Float confidence = (float) prediction.get("confidence").asDouble();

                            // Chuyển từ giá trị parse được json vừa nãy vào BoundingBox để vẽ
                            double x = prediction.get("x").asDouble();
                            double y = prediction.get("y").asDouble();
                            double predictionWidth = prediction.get("width").asDouble();
                            double predictionHeight = prediction.get("height").asDouble();

                            BoundingBox bbox = new BoundingBox(
                                    (int) Math.round(x - predictionWidth / 2.0),
                                    (int) Math.round(y - predictionHeight / 2.0),
                                    (int) Math.round(predictionWidth),
                                    (int) Math.round(predictionHeight));

                            // Tìm loại biển báo vừa detect đuợc ở trong DB
                            TrafficSignType signType = trafficSignTypeRepository.findByCode(label)
                                    .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

                            Detection detection = Detection.builder()
                                    .video(video)
                                    .frameNumber((int) Math.round(frame.getTimeSeconds()))
                                    .label(label)
                                    .confidence(confidence)
                                    .signType(signType)
                                    .bboxX(bbox.x)
                                    .bboxY(bbox.y)
                                    .bboxW(bbox.width)
                                    .bboxH(bbox.height)
                                    .origImageWidth(imageDims.width)
                                    .origImageHeight(imageDims.height)
                                    .build();
                            detections.add(detection);
                        } catch (Exception e) {
                            log.warn("Failed to parse prediction: {}", e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse detection JSON for frame {}: {}",
                            frame.getFrameIndex(), e.getMessage());
                }
            }
            // Xóa hết các kết quả cũ của video, lưu lại kết quả mới vào DB
            if (!detections.isEmpty()) {
                List<Detection> existing = video.getDetections();
                existing.clear();
                for (Detection d : detections) {
                    d.setVideo(video);
                    existing.add(d);
                }
                video.setStatus(VideoStatus.DONE);
                video.setUploadedAt(LocalDateTime.now());
                video.setDetections(existing);
                videoRepository.save(video);
            }
        }
        return result; // Kết quả trả về gồm trạng thái và danh sách frame đã xử lý
    }

    // Record lưu thông tin kích thước của ảnh
    private record ImageDimensions(int width, int height) {
    }

    // Record lưu bounding box của kết quả dêtc
    private record BoundingBox(int x, int y, int width, int height) {
    }
}