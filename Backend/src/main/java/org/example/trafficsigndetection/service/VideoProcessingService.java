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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class VideoProcessingService implements InitializingBean {

    DetectionRepository detectionRepository;
    VideoRepository videoRepository;
    TrafficSignTypeRepository trafficSignTypeRepository;

    @Value("${roboflow.api.url:}")
    @NonFinal
    String ROBOFLOW_API_URL;

    @Value("${roboflow.api.key:}")
    @NonFinal
    String ROBOFLOW_API_KEY;

    @Value("${roboflow.project.id}")
    @NonFinal
    String ROBOFLOW_MODEL;

    @Value("${roboflow.model.version}")
    @NonFinal
    String ROBOFLOW_VERSION;

    @Value("${roboflow.temp-dir:D:/Bin/tmp/roboflow-video}")
    @NonFinal
    private String tempDir;

    @Value("${roboflow.ssl.insecure:false}")
    @NonFinal
    boolean ROBOFLOW_SSL_INSECURE;

    @NonFinal
    RestTemplate restTemplate;

    @Override
    public void afterPropertiesSet() throws Exception {
        if (ROBOFLOW_SSL_INSECURE) {
            // Build SSL context that trusts all certificates (for HttpClient 5.x)
            SSLConnectionSocketFactory sslSocketFactory = new SSLConnectionSocketFactory(
                    SSLContextBuilder.create()
                            .loadTrustMaterial(new TrustAllStrategy())
                            .build(),
                    (hostname, session) -> true // Trust all hostnames
            );

            HttpClientConnectionManager connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                    .setSSLSocketFactory(sslSocketFactory)
                    .build();

            CloseableHttpClient httpClient = HttpClients.custom()
                    .setConnectionManager(connectionManager)
                    .build();

            this.restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
        } else {
            this.restTemplate = new RestTemplate();
        }
    }

    public VideoResult processVideo(org.springframework.web.multipart.MultipartFile file) throws Exception {
        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);

        File temp = File.createTempFile("upload-", ".mp4", tmpDirPath.toFile());
        try {
            file.transferTo(temp);
            List<FrameResult> frames = extractAndDetect(temp, 1.0);
            return new VideoResult("ok", frames);
        } finally {
            try {
                Files.deleteIfExists(temp.toPath());
            } catch (Exception ignored) {
            }
        }
    }

    public VideoResult processVideoFromUrl(String url) throws Exception {
        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);

        File temp = File.createTempFile("cloud-", ".mp4", tmpDirPath.toFile());
        try (java.io.InputStream in = safeOpenStream(url)) {
            Files.copy(in, temp.toPath(), StandardCopyOption.REPLACE_EXISTING);
            List<FrameResult> frames = extractAndDetect(temp, 1.0);
            return new VideoResult("ok", frames);
        } finally {
            try {
                Files.deleteIfExists(temp.toPath());
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Overload that accepts an optional persisted videoId. If videoId is provided
     * we will persist parsed detections into the DB linked to that Video.
     */
    public VideoResult processVideoFromUrl(String url, Long videoId) throws Exception {
        VideoResult result = processVideoFromUrl(url);
        if (videoId != null && result != null && result.getFrames() != null && !result.getFrames().isEmpty()) {
            persistDetections(videoId, result.getFrames());
        }
        return result;
    }

    private void persistDetections(Long videoId, java.util.List<FrameResult> frames) {
        try {
            java.util.Optional<Video> opt = videoRepository.findById(videoId);
            if (opt.isEmpty()) {
                log.warn("persistDetections: video id {} not found", videoId);
                return;
            }
            Video video = opt.get();

            ObjectMapper mapper = new ObjectMapper();
            java.util.List<Detection> toSave = new java.util.ArrayList<>();

            for (FrameResult fr : frames) {
                String json = fr.getDetectionJson();
                if (json == null || json.isBlank())
                    continue;

                try {
                    JsonNode root = mapper.readTree(json);
                    // capture original image size if provided by the detection payload
                    int rootImgW = -1;
                    int rootImgH = -1;
                    if (root.has("image")) {
                        JsonNode img = root.get("image");
                        if (img.has("width"))
                            rootImgW = img.get("width").asInt(-1);
                        if (img.has("height"))
                            rootImgH = img.get("height").asInt(-1);
                    }

                    JsonNode preds = null;
                    if (root.has("predictions"))
                        preds = root.get("predictions");
                    else if (root.has("objects"))
                        preds = root.get("objects");
                    if (preds != null && preds.isArray()) {
                        for (JsonNode p : preds) {
                            String label = null;
                            if (p.has("class"))
                                label = p.get("class").asText();
                            else if (p.has("label"))
                                label = p.get("label").asText();
                            else if (p.has("name"))
                                label = p.get("name").asText();

                            Float conf = null;
                            if (p.has("confidence"))
                                conf = (float) p.get("confidence").asDouble();
                            else if (p.has("score"))
                                conf = (float) p.get("score").asDouble();

                            Integer bx = null, by = null, bw = null, bh = null;

                            if (p.has("x") && p.has("y") && p.has("width") && p.has("height")) {
                                double xv = p.get("x").asDouble();
                                double yv = p.get("y").asDouble();
                                double wv = p.get("width").asDouble();
                                double hv = p.get("height").asDouble();
                                // determine if values are normalized (0..1) or pixels (>1)
                                boolean normalized = (xv > 0 && xv <= 1.0) && (yv > 0 && yv <= 1.0)
                                        && (wv > 0 && wv <= 1.0)
                                        && (hv > 0 && hv <= 1.0);
                                if (normalized) {
                                    // If values are normalized, convert to pixel bbox if original image size known
                                    if (rootImgW > 0 && rootImgH > 0) {
                                        double px = xv * rootImgW;
                                        double py = yv * rootImgH;
                                        double pw = wv * rootImgW;
                                        double ph = hv * rootImgH;
                                        bx = (int) Math.round(px - pw / 2.0);
                                        by = (int) Math.round(py - ph / 2.0);
                                        bw = (int) Math.round(pw);
                                        bh = (int) Math.round(ph);
                                    }
                                } else {
                                    // pixel values already
                                    bx = (int) Math.round(xv - wv / 2.0);
                                    by = (int) Math.round(yv - hv / 2.0);
                                    bw = (int) Math.round(wv);
                                    bh = (int) Math.round(hv);
                                }
                            } else if (p.has("x_min") && p.has("y_min") && p.has("x_max") && p.has("y_max")) {
                                int xmin = p.get("x_min").asInt();
                                int ymin = p.get("y_min").asInt();
                                int xmax = p.get("x_max").asInt();
                                int ymax = p.get("y_max").asInt();
                                bx = xmin;
                                by = ymin;
                                bw = xmax - xmin;
                                bh = ymax - ymin;
                            }

                            Detection.DetectionBuilder dBuilder = Detection.builder()
                                    .video(video)
                                    .frameNumber((int) Math.round(fr.getTimeSeconds()))
                                    .label(label == null ? null
                                            : (label.length() > 200 ? label.substring(0, 200) : label))
                                    .confidence(conf)
                                    .bboxX(bx)
                                    .bboxY(by)
                                    .bboxW(bw)
                                    .bboxH(bh);

                            if (rootImgW > 0 && rootImgH > 0) {
                                dBuilder.origImageWidth(rootImgW).origImageHeight(rootImgH);
                            }
                            // We store only pixel bbox coordinates; normalized fields removed for
                            // consistency

                            Detection d = dBuilder.build();
                            TrafficSignType type = trafficSignTypeRepository.findByCode(d.getLabel())
                                    .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
                            d.setSignType(type);
                            toSave.add(d);
                            toSave.add(d);
                        }
                    } else {
                        // no predictions array found - store raw JSON (truncated) as a record
                        String lbl = json.length() > 200 ? json.substring(0, 200) : json;
                        TrafficSignType type = trafficSignTypeRepository.findByCode(lbl)
                                .orElseThrow(() -> new AppException(ErrorCode.SIGN_TYPE_NOT_FOUND));
                        Detection d = Detection.builder()
                                .video(video)
                                .frameNumber((int) Math.round(fr.getTimeSeconds()))
                                .label(lbl)
                                .signType(type)
                                .build();
                        toSave.add(d);
                    }
                } catch (Exception pe) {
                    log.warn("Failed parsing detection json for frame {}: {}", fr.getFrameIndex(), pe.getMessage());
                }
            }

            if (!toSave.isEmpty()) {
                detectionRepository.saveAll(toSave);
                log.info("Persisted {} detections for video id={}", toSave.size(), videoId);
            }

        } catch (Exception e) {
            log.error("persistDetections failed for videoId={}: {}", videoId, e.getMessage(), e);
        }
    }

    private java.io.InputStream safeOpenStream(String urlStr) throws Exception {
        // Try straightforward URL first
        try {
            java.net.URL url = new java.net.URL(urlStr);
            return url.openStream();
        } catch (java.net.MalformedURLException mfe) {
            // Try to parse components and re-encode path segments
            try {
                java.net.URL parsed = new java.net.URL(urlStr);
                String protocol = parsed.getProtocol();
                String host = parsed.getHost();
                int port = parsed.getPort();
                String path = parsed.getPath();
                String query = parsed.getQuery();

                // Encode each path segment
                String[] parts = path.split("/");
                StringBuilder encodedPath = new StringBuilder();
                for (String p : parts) {
                    if (p.isEmpty())
                        continue;
                    String enc = java.net.URLEncoder.encode(p, java.nio.charset.StandardCharsets.UTF_8.toString())
                            .replace("+", "%20");
                    encodedPath.append('/').append(enc);
                }
                if (path.endsWith("/"))
                    encodedPath.append('/');

                String hostPort = host + (port == -1 ? "" : ":" + port);
                java.net.URI uri = new java.net.URI(protocol, hostPort, encodedPath.toString(), query, null);
                return uri.toURL().openStream();
            } catch (Exception ex) {
                // As a last resort, try sanitizing common characters
                String sanitized = sanitizeUrlString(urlStr);
                return new java.net.URI(sanitized).toURL().openStream();
            }
        }
    }

    /**
     * Sanitize a URL string by encoding a small set of characters that commonly
     * break URI parsing (spaces, parentheses). This is a pragmatic fallback
     * for slightly malformed object keys returned by some storage services.
     */
    private String sanitizeUrlString(String url) {
        if (url == null)
            return null;
        // encode space and common unsafe characters in path
        return url.replace(" ", "%20").replace("(", "%28").replace(")", "%29");
    }

    private List<FrameResult> extractAndDetect(File videoFile, double secInterval) throws Exception {
        List<FrameResult> list = new ArrayList<>();
        String videoId = UUID.randomUUID().toString();

        Path tmpDirPath = Paths.get(tempDir);
        Files.createDirectories(tmpDirPath);

        try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoFile)) {
            grabber.start();

            // Get rotation metadata
            String rotateStr = null;
            try {
                rotateStr = grabber.getVideoMetadata("rotate");
                if (rotateStr == null) {
                    rotateStr = grabber.getMetadata("rotate");
                }
            } catch (Exception ignored) {
            }

            int rotation = 0;
            if (StringUtils.hasText(rotateStr)) {
                try {
                    rotation = Integer.parseInt(rotateStr.trim());
                } catch (NumberFormatException ignored) {
                }
            }

            double frameRate = grabber.getFrameRate() <= 0 ? 25.0 : grabber.getFrameRate();
            long total = grabber.getLengthInFrames();
            long interval = Math.max(1, Math.round(frameRate * secInterval));

            Java2DFrameConverter conv = new Java2DFrameConverter();
            try {
                Frame f;
                int frameIndex = 0;
                while ((f = grabber.grabImage()) != null) {
                    if (frameIndex % interval == 0) {
                        BufferedImage img = conv.convert(f);
                        if (img != null) {
                            // Rotate if needed
                            if (rotation != 0) {
                                img = rotateBufferedImage(img, rotation);
                            }

                            // Optional: Save frame for debugging
                            Path outputPath = tmpDirPath.resolve(String.format("frame-%s-%d.jpg", videoId, frameIndex));
                            try {
                                ImageIO.write(img, "jpg", outputPath.toFile());
                            } catch (Exception ignored) {
                            }

                            // Call Roboflow API
                            String json = callRoboflow(img);

                            double timeSec = frameRate > 0 ? (double) frameIndex / frameRate : frameIndex * secInterval;
                            list.add(new FrameResult(frameIndex, timeSec, json));

                            // Delete debug file
                            try {
                                Files.deleteIfExists(outputPath);
                            } catch (Exception ignored) {
                            }
                        }
                    }
                    frameIndex++;

                    // Safety break
                    if (total > 0 && frameIndex > total) {
                        break;
                    }
                }
            } finally {
                conv.close();
            }

            grabber.stop();
        }

        return list;
    }

    private String callRoboflow(BufferedImage img) throws IOException {
        if (ROBOFLOW_API_KEY == null || ROBOFLOW_API_KEY.isBlank()) {
            return "{\"error\":\"Roboflow API key is missing\"}";
        }

        // Convert image to JPEG bytes
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", baos);
        byte[] bytes = baos.toByteArray();

        // Encode to Base64
        String base64 = Base64.getEncoder().encodeToString(bytes);

        // Build detect URL
        String detectUrl;
        if (ROBOFLOW_API_URL != null && !ROBOFLOW_API_URL.isBlank()) {
            detectUrl = ROBOFLOW_API_URL;
            detectUrl = detectUrl.contains("api_key=") ? detectUrl
                    : (detectUrl + (detectUrl.contains("?") ? "&" : "?") + "api_key=" + ROBOFLOW_API_KEY);
        } else {
            detectUrl = String.format("https://detect.roboflow.com/%s/%s?api_key=%s",
                    ROBOFLOW_MODEL, ROBOFLOW_VERSION, ROBOFLOW_API_KEY);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);

        HttpEntity<String> request = new HttpEntity<>(base64, headers);

        try {
            ResponseEntity<String> resp = restTemplate.postForEntity(detectUrl, request, String.class);
            return resp.getBody();
        } catch (HttpClientErrorException he) {
            String body = he.getResponseBodyAsString();
            int status = he.getStatusCode().value();
            return String.format("{\"error\":\"http %d\",\"body\":%s}", status,
                    body != null ? escapeJson(body) : "\"\"");
        } catch (ResourceAccessException rae) {
            return String.format("{\"error\":\"resource_access\",\"message\":%s}", escapeJson(rae.getMessage()));
        } catch (Exception ex) {
            return String.format("{\"error\":\"exception\",\"message\":%s}", escapeJson(ex.getMessage()));
        }
    }

    private BufferedImage rotateBufferedImage(BufferedImage src, double degrees) {
        double radians = Math.toRadians(degrees);
        int w = src.getWidth();
        int h = src.getHeight();

        boolean swap = ((Math.abs(degrees) % 180) != 0);
        int newW = swap ? h : w;
        int newH = swap ? w : h;

        BufferedImage result = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = result.createGraphics();

        AffineTransform at = new AffineTransform();
        at.translate(newW / 2.0, newH / 2.0);
        at.rotate(radians);
        at.translate(-w / 2.0, -h / 2.0);

        g.drawRenderedImage(src, at);
        g.dispose();
        return result;
    }

    private String escapeJson(String s) {
        if (s == null) {
            return "\"\"";
        }
        String safe = s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
        return "\"" + safe + "\"";
    }
}