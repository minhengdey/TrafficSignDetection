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
import org.example.trafficsigndetection.repository.DetectionRepository;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.example.trafficsigndetection.repository.VideoRepository;
import org.example.trafficsigndetection.dto.video.VideoResult;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Frame;
import org.bytedeco.javacv.Java2DFrameConverter;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.io.HttpClientConnectionManager;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.client5.http.ssl.TrustAllStrategy;
import org.apache.hc.core5.ssl.SSLContextBuilder;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
public class VideoProcessingService implements InitializingBean {

    static double DEFAULT_FRAME_RATE = 25.0;
    static double DEFAULT_INTERVAL_SECONDS = 1.0;
    static int MAX_LABEL_LENGTH = 200;
    static String IMAGE_FORMAT = "jpg";
    static String TEMP_FILE_PREFIX = "cloud-";
    static String TEMP_FILE_SUFFIX = ".mp4";

    DetectionRepository detectionRepository;
    VideoRepository videoRepository;
    TrafficSignTypeRepository trafficSignTypeRepository;
    ObjectMapper objectMapper;

    @Value("${roboflow.api.url:}")
    @NonFinal
    String roboflowApiUrl;

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

    @Value("${roboflow.ssl.insecure:false}")
    @NonFinal
    boolean roboflowSslInsecure;

    @NonFinal
    RestTemplate restTemplate;

    @Override
    public void afterPropertiesSet() throws Exception {
        this.restTemplate = roboflowSslInsecure ? createInsecureRestTemplate() : new RestTemplate();
        log.info("VideoProcessingService initialized - SSL insecure: {}, tempDir: {}",
                roboflowSslInsecure, tempDir);
    }

    public VideoResult processVideoFromUrl(String url, Long videoId) throws Exception {
        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);

        File tempFile = File.createTempFile(TEMP_FILE_PREFIX, TEMP_FILE_SUFFIX, tmpDirPath.toFile());
        VideoResult result;

        try {
            downloadVideo(url, tempFile);
            List<FrameResult> frames = extractAndDetect(tempFile, DEFAULT_INTERVAL_SECONDS);
            result = new VideoResult("ok", frames);
        } finally {
            cleanupTempFile(tempFile);
        }

        if (videoId != null && hasValidFrames(result)) {
            persistDetections(videoId, result.getFrames());
        }

        return result;
    }

    private void persistDetections(Long videoId, List<FrameResult> frames) {
        try {
            Video video = videoRepository.findById(videoId)
                    .orElseThrow(() -> new AppException(ErrorCode.VIDEO_NOT_FOUND));

            List<Detection> detections = parseDetectionsFromFrames(video, frames);

            if (!detections.isEmpty()) {
                List<Detection> existing = video.getDetections();
                existing.clear();
                for (Detection d : detections) {
                    d.setVideo(video);
                    existing.add(d);
                }
                video.setStatus(VideoStatus.DONE);
                video.setUploadedAt(LocalDateTime.now());
                videoRepository.save(video);
                log.info("Persisted {} detections for video id={}", detections.size(), videoId);
            }

        } catch (Exception e) {
            log.error("Failed to persist detections for videoId={}", videoId, e);
        }
    }

    private List<Detection> parseDetectionsFromFrames(Video video, List<FrameResult> frames) {
        List<Detection> detections = new ArrayList<>();

        for (FrameResult frame : frames) {
            if (!hasValidDetectionJson(frame)) {
                continue;
            }

            try {
                JsonNode root = objectMapper.readTree(frame.getDetectionJson());
                ImageDimensions imageDims = extractImageDimensions(root);
                JsonNode predictions = extractPredictions(root);

                if (predictions != null && predictions.isArray()) {
                    detections.addAll(parsePredictions(video, frame, predictions, imageDims));
                } else {
                    detections.add(createFallbackDetection(video, frame));
                }

            } catch (Exception e) {
                log.warn("Failed to parse detection JSON for frame {}: {}",
                        frame.getFrameIndex(), e.getMessage());
            }
        }

        return detections;
    }

    private List<Detection> parsePredictions(Video video, FrameResult frame,
                                             JsonNode predictions, ImageDimensions imageDims) {

        List<Detection> detections = new ArrayList<>();

        for (JsonNode prediction : predictions) {
            try {
                String label = extractLabel(prediction);
                Float confidence = extractConfidence(prediction);
                BoundingBox bbox = extractBoundingBox(prediction, imageDims);

                Detection detection = buildDetection(video, frame, label, confidence, bbox, imageDims);
                detections.add(detection);

            } catch (Exception e) {
                log.warn("Failed to parse prediction: {}", e.getMessage());
            }
        }

        return detections;
    }

    private Detection buildDetection(Video video, FrameResult frame, String label,
                                     Float confidence, BoundingBox bbox, ImageDimensions imageDims) {

        String truncatedLabel = truncateLabel(label);
        TrafficSignType signType = trafficSignTypeRepository.findByCode(truncatedLabel)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        Detection.DetectionBuilder builder = Detection.builder()
                .video(video)
                .frameNumber((int) Math.round(frame.getTimeSeconds()))
                .label(truncatedLabel)
                .confidence(confidence)
                .signType(signType);

        if (bbox != null) {
            builder.bboxX(bbox.x)
                    .bboxY(bbox.y)
                    .bboxW(bbox.width)
                    .bboxH(bbox.height);
        }

        if (imageDims.isValid()) {
            builder.origImageWidth(imageDims.width)
                    .origImageHeight(imageDims.height);
        }

        return builder.build();
    }

    private Detection createFallbackDetection(Video video, FrameResult frame) {
        String label = truncateLabel(frame.getDetectionJson());
        TrafficSignType signType = trafficSignTypeRepository.findByCode(label)
                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));

        return Detection.builder()
                .video(video)
                .frameNumber((int) Math.round(frame.getTimeSeconds()))
                .label(label)
                .signType(signType)
                .build();
    }

    private List<FrameResult> extractAndDetect(File videoFile, double intervalSeconds) throws Exception {
        List<FrameResult> results;
        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);

        try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoFile)) {
            grabber.start();

            int rotation = extractRotation(grabber);
            double frameRate = getFrameRate(grabber);
            long frameInterval = calculateFrameInterval(frameRate, intervalSeconds);

            results = processVideoFrames(grabber, frameRate, frameInterval, rotation);

            grabber.stop();
        }

        return results;
    }

    private List<FrameResult> processVideoFrames(FFmpegFrameGrabber grabber, double frameRate,
                                                 long frameInterval, int rotation) throws Exception {

        List<FrameResult> results = new ArrayList<>();
        long totalFrames = grabber.getLengthInFrames();

        try (Java2DFrameConverter converter = new Java2DFrameConverter()) {
            Frame frame;
            int frameIndex = 0;

            while ((frame = grabber.grabImage()) != null) {
                if (shouldProcessFrame(frameIndex, frameInterval)) {
                    BufferedImage image = converter.convert(frame);

                    if (image != null) {
                        if (rotation != 0) {
                            image = rotateImage(image, rotation);
                        }

                        String detectionJson = callRoboflow(image);
                        double timeSeconds = calculateTimeSeconds(frameIndex, frameRate);

                        results.add(new FrameResult(frameIndex, timeSeconds, detectionJson));
                    }
                }

                frameIndex++;

                if (shouldBreak(frameIndex, totalFrames)) {
                    break;
                }
            }
        }

        return results;
    }

    private String callRoboflow(BufferedImage image) {
        if (!isRoboflowConfigured()) {
            return "{\"error\":\"Roboflow API key is missing\"}";
        }

        try {
            String base64Image = encodeImageToBase64(image);
            String detectUrl = buildRoboflowUrl();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);

            HttpEntity<String> request = new HttpEntity<>(base64Image, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(detectUrl, request, String.class);

            return response.getBody();

        } catch (HttpClientErrorException e) {
            return formatHttpError(e);
        } catch (ResourceAccessException e) {
            return formatResourceAccessError(e);
        } catch (Exception e) {
            return formatGenericError(e);
        }
    }

    private void downloadVideo(String url, File destination) throws Exception {
        try (InputStream in = openStream(url)) {
            Files.copy(in, destination.toPath(), StandardCopyOption.REPLACE_EXISTING);
            log.debug("Downloaded video from {} to {}", url, destination);
        }
    }

    private InputStream openStream(String urlString) throws Exception {
        try {
            return new URL(urlString).openStream();
        } catch (Exception e) {
            return openStreamWithEncoding(urlString);
        }
    }

    private InputStream openStreamWithEncoding(String urlString) throws Exception {
        try {
            URL url = new URL(urlString);
            String protocol = url.getProtocol();
            String host = url.getHost();
            int port = url.getPort();
            String path = url.getPath();
            String query = url.getQuery();

            String encodedPath = encodePath(path);
            String hostPort = port == -1 ? host : host + ":" + port;

            return new URI(protocol, hostPort, encodedPath, query, null).toURL().openStream();
        } catch (Exception e) {
            String sanitized = sanitizeUrl(urlString);
            return new URI(sanitized).toURL().openStream();
        }
    }

    private RestTemplate createInsecureRestTemplate() throws Exception {
        SSLConnectionSocketFactory sslSocketFactory = new SSLConnectionSocketFactory(
                SSLContextBuilder.create()
                        .loadTrustMaterial(new TrustAllStrategy())
                        .build(),
                (hostname, session) -> true
        );

        HttpClientConnectionManager connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                .setSSLSocketFactory(sslSocketFactory)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .build();

        return new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
    }

    private BufferedImage rotateImage(BufferedImage source, double degrees) {
        double radians = Math.toRadians(degrees);
        int originalWidth = source.getWidth();
        int originalHeight = source.getHeight();

        boolean swapDimensions = (Math.abs(degrees) % 180) != 0;
        int newWidth = swapDimensions ? originalHeight : originalWidth;
        int newHeight = swapDimensions ? originalWidth : originalHeight;

        BufferedImage rotated = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rotated.createGraphics();

        AffineTransform transform = new AffineTransform();
        transform.translate(newWidth / 2.0, newHeight / 2.0);
        transform.rotate(radians);
        transform.translate(-originalWidth / 2.0, -originalHeight / 2.0);

        graphics.drawRenderedImage(source, transform);
        graphics.dispose();

        return rotated;
    }

    private ImageDimensions extractImageDimensions(JsonNode root) {
        if (!root.has("image")) {
            return ImageDimensions.invalid();
        }

        JsonNode imageNode = root.get("image");
        int width = imageNode.has("width") ? imageNode.get("width").asInt(-1) : -1;
        int height = imageNode.has("height") ? imageNode.get("height").asInt(-1) : -1;

        return new ImageDimensions(width, height);
    }

    private JsonNode extractPredictions(JsonNode root) {
        if (root.has("predictions")) {
            return root.get("predictions");
        }
        if (root.has("objects")) {
            return root.get("objects");
        }
        return null;
    }

    private String extractLabel(JsonNode prediction) {
        if (prediction.has("class")) {
            return prediction.get("class").asText();
        }
        if (prediction.has("label")) {
            return prediction.get("label").asText();
        }
        if (prediction.has("name")) {
            return prediction.get("name").asText();
        }
        return null;
    }

    private Float extractConfidence(JsonNode prediction) {
        if (prediction.has("confidence")) {
            return (float) prediction.get("confidence").asDouble();
        }
        if (prediction.has("score")) {
            return (float) prediction.get("score").asDouble();
        }
        return null;
    }

    private BoundingBox extractBoundingBox(JsonNode prediction, ImageDimensions imageDims) {
        if (prediction.has("x") && prediction.has("y") &&
                prediction.has("width") && prediction.has("height")) {

            double x = prediction.get("x").asDouble();
            double y = prediction.get("y").asDouble();
            double width = prediction.get("width").asDouble();
            double height = prediction.get("height").asDouble();

            return createBoundingBox(x, y, width, height, imageDims);
        }

        if (prediction.has("x_min") && prediction.has("y_min") &&
                prediction.has("x_max") && prediction.has("y_max")) {

            int xMin = prediction.get("x_min").asInt();
            int yMin = prediction.get("y_min").asInt();
            int xMax = prediction.get("x_max").asInt();
            int yMax = prediction.get("y_max").asInt();

            return new BoundingBox(xMin, yMin, xMax - xMin, yMax - yMin);
        }

        return null;
    }

    private BoundingBox createBoundingBox(double x, double y, double width, double height,
                                          ImageDimensions imageDims) {

        boolean isNormalized = isNormalizedCoordinates(x, y, width, height);

        if (isNormalized && imageDims.isValid()) {
            return denormalizeBoundingBox(x, y, width, height, imageDims);
        } else if (!isNormalized) {
            return new BoundingBox(
                    (int) Math.round(x - width / 2.0),
                    (int) Math.round(y - height / 2.0),
                    (int) Math.round(width),
                    (int) Math.round(height)
            );
        }

        return null;
    }

    private BoundingBox denormalizeBoundingBox(double x, double y, double width, double height,
                                               ImageDimensions imageDims) {

        double pixelX = x * imageDims.width;
        double pixelY = y * imageDims.height;
        double pixelWidth = width * imageDims.width;
        double pixelHeight = height * imageDims.height;

        return new BoundingBox(
                (int) Math.round(pixelX - pixelWidth / 2.0),
                (int) Math.round(pixelY - pixelHeight / 2.0),
                (int) Math.round(pixelWidth),
                (int) Math.round(pixelHeight)
        );
    }

    private int extractRotation(FFmpegFrameGrabber grabber) {
        String rotationStr = null;
        try {
            rotationStr = grabber.getVideoMetadata("rotate");
            if (rotationStr == null) {
                rotationStr = grabber.getMetadata("rotate");
            }
        } catch (Exception e) {
            log.debug("Failed to extract rotation metadata", e);
        }

        if (StringUtils.hasText(rotationStr)) {
            try {
                return Integer.parseInt(rotationStr.trim());
            } catch (NumberFormatException e) {
                log.warn("Invalid rotation value: {}", rotationStr);
            }
        }

        return 0;
    }

    private String encodeImageToBase64(BufferedImage image) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ImageIO.write(image, IMAGE_FORMAT, outputStream);
        byte[] imageBytes = outputStream.toByteArray();
        return Base64.getEncoder().encodeToString(imageBytes);
    }

    private String buildRoboflowUrl() {
        if (StringUtils.hasText(roboflowApiUrl)) {
            return roboflowApiUrl.contains("api_key=")
                    ? roboflowApiUrl
                    : roboflowApiUrl + (roboflowApiUrl.contains("?") ? "&" : "?") + "api_key=" + roboflowApiKey;
        }

        return String.format("https://detect.roboflow.com/%s/%s?api_key=%s",
                roboflowModel, roboflowVersion, roboflowApiKey);
    }

    private String encodePath(String path) {
        String[] segments = path.split("/");
        StringBuilder encoded = new StringBuilder();

        for (String segment : segments) {
            if (!segment.isEmpty()) {
                String encodedSegment = URLEncoder.encode(segment, StandardCharsets.UTF_8)
                        .replace("+", "%20");
                encoded.append('/').append(encodedSegment);
            }
        }

        if (path.endsWith("/")) {
            encoded.append('/');
        }

        return encoded.toString();
    }

    private String sanitizeUrl(String url) {
        if (url == null) {
            return null;
        }
        return url.replace(" ", "%20")
                .replace("(", "%28")
                .replace(")", "%29");
    }

    private String truncateLabel(String label) {
        if (label == null) {
            return null;
        }
        return label.length() > MAX_LABEL_LENGTH
                ? label.substring(0, MAX_LABEL_LENGTH)
                : label;
    }

    private String formatHttpError(HttpClientErrorException exception) {
        String body = exception.getResponseBodyAsString();
        int status = exception.getStatusCode().value();
        return String.format("{\"error\":\"http %d\",\"body\":%s}",
                status, escapeJson(body));
    }

    private String formatResourceAccessError(ResourceAccessException exception) {
        return String.format("{\"error\":\"resource_access\",\"message\":%s}",
                escapeJson(exception.getMessage()));
    }

    private String formatGenericError(Exception exception) {
        return String.format("{\"error\":\"exception\",\"message\":%s}",
                escapeJson(exception.getMessage()));
    }

    private String escapeJson(String text) {
        if (text == null) {
            return "\"\"";
        }
        String escaped = text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
        return "\"" + escaped + "\"";
    }

    private void cleanupTempFile(File file) {
        try {
            Files.deleteIfExists(file.toPath());
        } catch (Exception e) {
            log.warn("Failed to cleanup temp file: {}", file, e);
        }
    }

    private double getFrameRate(FFmpegFrameGrabber grabber) {
        double rate = grabber.getFrameRate();
        return rate <= 0 ? DEFAULT_FRAME_RATE : rate;
    }

    private long calculateFrameInterval(double frameRate, double intervalSeconds) {
        return Math.max(1, Math.round(frameRate * intervalSeconds));
    }

    private double calculateTimeSeconds(int frameIndex, double frameRate) {
        return frameRate > 0 ? (double) frameIndex / frameRate : frameIndex;
    }

    private boolean shouldProcessFrame(int frameIndex, long interval) {
        return frameIndex % interval == 0;
    }

    private boolean shouldBreak(int currentFrame, long totalFrames) {
        return totalFrames > 0 && currentFrame > totalFrames;
    }

    private boolean hasValidFrames(VideoResult result) {
        return result != null && result.getFrames() != null && !result.getFrames().isEmpty();
    }

    private boolean hasValidDetectionJson(FrameResult frame) {
        return frame.getDetectionJson() != null && !frame.getDetectionJson().isBlank();
    }

    private boolean isRoboflowConfigured() {
        return roboflowApiKey != null && !roboflowApiKey.isBlank();
    }

    private boolean isNormalizedCoordinates(double x, double y, double width, double height) {
        return (x > 0 && x <= 1.0) && (y > 0 && y <= 1.0) &&
                (width > 0 && width <= 1.0) && (height > 0 && height <= 1.0);
    }

    private record ImageDimensions(int width, int height) {

        boolean isValid() {
                return width > 0 && height > 0;
            }

            static ImageDimensions invalid() {
                return new ImageDimensions(-1, -1);
            }
        }

    private record BoundingBox(int x, int y, int width, int height) {
    }
}