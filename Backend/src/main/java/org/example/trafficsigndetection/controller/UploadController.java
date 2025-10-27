package org.example.trafficsigndetection.controller;

import org.example.trafficsigndetection.service.B2Service;
import org.example.trafficsigndetection.service.VideoService;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.enums.VideoStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiConsumer;
import java.util.function.IntConsumer;

@RestController
@Slf4j
@RequestMapping("/api/upload")
public class UploadController {

    // Constants
    private static final long SIMPLE_UPLOAD_THRESHOLD = 100L * 1024L * 1024L; // 100MB
    private static final int DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    private static final int DEFAULT_UPLOAD_TIMEOUT_MINUTES = 30;
    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final long INITIAL_RETRY_BACKOFF_MS = 500L;
    private static final long MAX_RETRY_BACKOFF_MS = 4000L;
    private static final Duration PRESIGNED_URL_DURATION = Duration.ofMinutes(30);

    private final B2Service b2Service;
    private final VideoService videoService;
    private final ObjectMapper objectMapper;

    // Thread pool for parallel part uploads - configurable, defaults to 2x CPU cores
    private final ExecutorService uploadExecutor;

    // Background executor for orchestrating uploads
    private final ExecutorService backgroundExecutor;

    // Temp base directory for storing uploads and parts
    private final Path tempBaseDirectory;

    // Configurable chunk size (default 10MB for optimal performance)
    private final int chunkSize;

    // Configurable upload timeout
    private final int uploadTimeoutMinutes;

    public UploadController(B2Service b2Service, VideoService videoService) {
        this.b2Service = b2Service;
        this.videoService = videoService;
        this.objectMapper = new ObjectMapper();

        // Initialize thread pools
        int threadPoolSize = Math.max(2, Integer.parseInt(
                System.getProperty("ttd.uploadThreads",
                        String.valueOf(Runtime.getRuntime().availableProcessors() * 2))));
        this.uploadExecutor = Executors.newFixedThreadPool(threadPoolSize);
        this.backgroundExecutor = Executors.newCachedThreadPool();

        // Initialize temp directory
        this.tempBaseDirectory = Path.of(System.getProperty("java.io.tmpdir"), "ttd-uploads");
        try {
            Files.createDirectories(tempBaseDirectory);
            log.info("Created temp directory: {}", tempBaseDirectory);
        } catch (IOException e) {
            log.error("Failed to create temp directory: {}", tempBaseDirectory, e);
            throw new RuntimeException("Failed to initialize upload controller", e);
        }

        // Load configurations
        this.chunkSize = Integer.parseInt(
                System.getProperty("ttd.chunkSize", String.valueOf(DEFAULT_CHUNK_SIZE)));
        this.uploadTimeoutMinutes = Integer.parseInt(
                System.getProperty("ttd.uploadTimeoutMinutes", String.valueOf(DEFAULT_UPLOAD_TIMEOUT_MINUTES)));

        log.info("UploadController initialized - threadPoolSize={}, chunkSize={}, timeout={}min",
                threadPoolSize, chunkSize, uploadTimeoutMinutes);
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down UploadController executors");
        shutdownExecutor(uploadExecutor, "uploadExecutor");
        shutdownExecutor(backgroundExecutor, "backgroundExecutor");
    }

    private void shutdownExecutor(ExecutorService executor, String name) {
        try {
            executor.shutdown();
            if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                log.warn("{} did not terminate gracefully, forcing shutdown", name);
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            log.error("Interrupted while shutting down {}", name, e);
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    @PostMapping()
    public ResponseEntity<?> handleUpload(
            @RequestParam(value = "action", required = false, defaultValue = "upload") String action,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "returnPresignedGet", required = false, defaultValue = "false") boolean returnPresignedGet,
            @RequestParam(value = "filename", required = false) String filename,
            @RequestParam(value = "contentType", required = false) String contentType,
            @RequestParam(value = "uploadId", required = false) String uploadId,
            @RequestParam(value = "partNumber", required = false) Integer partNumber,
            HttpServletRequest request) {

        try {
            return switch (Objects.requireNonNullElse(action, "upload")) {
                case "upload" -> handleDirectUpload(file, returnPresignedGet, request);
                case "init" -> handleInitMultipart(filename, contentType);
                case "part" -> handleUploadPart(uploadId, partNumber, request);
                case "complete" -> handleCompleteMultipart(request);
                case "abort" -> handleAbortUpload(uploadId, request);
                default -> ResponseEntity.badRequest()
                        .body(Map.of("error", "Unknown action: " + action));
            };
        } catch (IOException e) {
            log.error("IO error handling upload action: {}", action, e);
            return ResponseEntity.status(500).body(Map.of("error", "IO error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error handling upload action: {}", action, e);
            return ResponseEntity.status(500).body(Map.of("error", "Internal error: " + e.getMessage()));
        }
    }

    private ResponseEntity<?> handleDirectUpload(MultipartFile file, boolean returnPresignedGet,
                                                 HttpServletRequest request) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is required"));
        }

        String username = getAuthenticatedUsername();
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        }

        if (!videoService.userExists(username)) {
            return ResponseEntity.status(403).body(Map.of("error", "User not found", "username", username));
        }

        // Verify bucket access early
        try {
            b2Service.assertBucketAccessible();
        } catch (Exception ex) {
            log.error("Bucket access verification failed", ex);
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Bucket access failed",
                    "details", ex.getMessage()));
        }

        long fileSize = file.getSize();
        boolean forceMultipart = "true".equals(request.getParameter("forceMultipart"));

        if (fileSize <= SIMPLE_UPLOAD_THRESHOLD && !forceMultipart) {
            return handleSimpleUpload(file, username, returnPresignedGet);
        } else {
            return handleLargeFileUpload(file, username);
        }
    }

    private ResponseEntity<?> handleSimpleUpload(MultipartFile file, String username, boolean returnPresignedGet) {
        try {
            String keySaved = b2Service.uploadSimple(file);
            String url = b2Service.getObjectUrl(keySaved);

            // Persist video metadata
            try {
                videoService.saveVideoForUsername(username,
                        url,
                        keySaved, file.getSize(), null, VideoStatus.UPLOADED);
            } catch (Exception ex) {
                log.error("Failed to save video metadata for username={}", username, ex);
            }

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("key", keySaved);
            response.put("url", url);

            if (returnPresignedGet) {
                String presignedGet = b2Service.presignGetUrl(keySaved, PRESIGNED_URL_DURATION);
                response.put("presignedGetUrl", presignedGet);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Simple upload failed", e);
            return ResponseEntity.status(500).body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    private ResponseEntity<?> handleLargeFileUpload(MultipartFile file, String username) throws IOException {
        String sessionId = UUID.randomUUID().toString();
        Path sessionDir = tempBaseDirectory.resolve(sessionId);
        Files.createDirectories(sessionDir);
        Path outFile = sessionDir.resolve("upload.bin");

        // Save uploaded file to temp
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, outFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }

        String originalFilename = file.getOriginalFilename();
        String originalContentType = file.getContentType();
        long fileSize = file.getSize();

        // Submit background upload task
        CompletableFuture.runAsync(() -> {
            try {
                uploadFileInParallel(outFile, originalFilename, originalContentType, sessionDir, username);
            } catch (Exception ex) {
                log.error("Background upload failed for session={}", sessionId, ex);
                cleanupDirectory(sessionDir);
            }
        }, backgroundExecutor);

        return ResponseEntity.accepted().body(Map.of(
                "uploadId", sessionId,
                "message", "File accepted, uploading in parallel",
                "fileSize", fileSize,
                "estimatedChunks", (fileSize + chunkSize - 1) / chunkSize));
    }

    private ResponseEntity<?> handleInitMultipart(String filename, String contentType) throws IOException {
        if (filename == null || filename.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Filename is required for init"));
        }

        // Validate filename for security
        if (!isValidFilename(filename)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid filename"));
        }

        // Verify bucket access early
        try {
            b2Service.assertBucketAccessible();
        } catch (Exception ex) {
            log.error("Bucket access verification failed during init", ex);
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Bucket access failed",
                    "details", ex.getMessage()));
        }

        var init = b2Service.initiateMultipartUpload(filename, contentType);

        // Create session directory
        String sessionId = UUID.randomUUID().toString();
        Path sessionDir = tempBaseDirectory.resolve(sessionId);
        Files.createDirectories(sessionDir);

        // Store metadata
        String username = getAuthenticatedUsername();
        Map<String, Object> metadata = new java.util.HashMap<>();
        metadata.put("key", init.key());
        metadata.put("uploadId", init.uploadId());
        metadata.put("filename", filename);
        metadata.put("contentType", contentType != null ? contentType : "application/octet-stream");
        metadata.put("username", username);

        Path metaFile = sessionDir.resolve("metadata.json");
        objectMapper.writeValue(metaFile.toFile(), metadata);

        // Initialize progress
        writeProgress(sessionDir, "initialized", 0, 0, init.key(), init.uploadId(), null);

        return ResponseEntity.ok(Map.of(
                "sessionId", sessionId,
                "key", init.key(),
                "uploadId", init.uploadId(),
                "recommendedChunkSize", chunkSize));
    }

    private ResponseEntity<?> handleUploadPart(String uploadId, Integer partNumber,
                                               HttpServletRequest request) throws IOException {
        if (uploadId == null || partNumber == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "uploadId (sessionId) and partNumber required"));
        }

        Path uploadDir = tempBaseDirectory.resolve(uploadId);
        if (!Files.exists(uploadDir)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid uploadId or session expired"));
        }

        // Verify session ownership
        String username = getAuthenticatedUsername();
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        }

        if (!verifySessionOwnership(uploadDir, username)) {
            return ResponseEntity.status(403).body(Map.of("error", "Upload session owner mismatch"));
        }

        // Save part to temp
        Path partFile = uploadDir.resolve(String.format("part-%05d.bin", partNumber));
        try (InputStream in = request.getInputStream()) {
            Files.copy(in, partFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }

        // Update progress
        updatePartProgress(uploadDir);

        return ResponseEntity.ok(Map.of(
                "ok", true,
                "part", partNumber,
                "size", Files.size(partFile)));
    }

    private ResponseEntity<?> handleCompleteMultipart(HttpServletRequest request) throws IOException {
        @SuppressWarnings("unchecked")
        Map<String, Object> body = objectMapper.readValue(request.getInputStream(), Map.class);
        String sessionId = (String) body.get("uploadId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> partsList = (List<Map<String, Object>>) body.get("parts");

        if (sessionId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "uploadId (sessionId) required"));
        }

        Path uploadDir = tempBaseDirectory.resolve(sessionId);
        Path metaFile = uploadDir.resolve("metadata.json");

        if (!Files.exists(metaFile)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid session or metadata not found"));
        }

        // Verify session ownership
        String username = getAuthenticatedUsername();
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        }

        if (!verifySessionOwnership(uploadDir, username)) {
            return ResponseEntity.status(403).body(Map.of("error", "Upload session owner mismatch"));
        }

        // Submit parallel completion job
        CompletableFuture.runAsync(() -> {
            try {
                completeMultipartInParallel(uploadDir, metaFile, partsList);
            } catch (Exception ex) {
                log.error("Failed to complete multipart upload for session={}", sessionId, ex);
                cleanupDirectory(uploadDir);
            }
        }, backgroundExecutor);

        return ResponseEntity.accepted().body(Map.of(
                "ok", true,
                "message", "Completing upload in parallel",
                "totalParts", partsList != null ? partsList.size() : 0));
    }

    private ResponseEntity<?> handleAbortUpload(String uploadId, HttpServletRequest request) {
        String uid = uploadId != null ? uploadId : request.getParameter("uploadId");
        if (uid == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "uploadId required"));
        }

        Path uploadDir = tempBaseDirectory.resolve(uid);
        cleanupDirectory(uploadDir);

        return ResponseEntity.ok(Map.of("ok", true, "message", "Upload aborted and cleaned up"));
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam("uploadId") String uploadId) {
        if (uploadId == null || uploadId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "uploadId required"));
        }

        try {
            Path sessionDir = tempBaseDirectory.resolve(uploadId);
            Path progressFile = sessionDir.resolve("progress.json");

            if (!Files.exists(progressFile)) {
                return ResponseEntity.ok(Map.of(
                        "status", "unknown",
                        "message", "No progress yet"));
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> progress = objectMapper.readValue(progressFile.toFile(), Map.class);
            return ResponseEntity.ok(progress);
        } catch (Exception e) {
            log.error("Failed to get status for uploadId={}", uploadId, e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Upload file in parallel chunks for maximum speed
     */
    private void uploadFileInParallel(Path file, String filename, String contentType,
                                      Path sessionDir, String username) throws Exception {

        var init = b2Service.initiateMultipartUpload(filename, contentType);
        String key = init.key();
        String s3UploadId = init.uploadId();

        long totalSize = Files.size(file);
        int totalParts = (int) ((totalSize + chunkSize - 1) / chunkSize);

        log.info("Starting parallel upload: {} ({} bytes, {} parts)", filename, totalSize, totalParts);

        // Initialize progress
        writeProgress(sessionDir, "uploading", 0, totalParts, key, s3UploadId, null);

        // Create futures for all part uploads
        List<CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart>> futures = new ArrayList<>();
        AtomicInteger completedCount = new AtomicInteger(0);

        // Submit all parts for parallel upload
        for (int i = 0; i < totalParts; i++) {
            final int partNumber = i + 1;
            final long offset = (long) i * chunkSize;
            final long remain = totalSize - offset;
            final int thisSize = (int) Math.min(chunkSize, remain);

            CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future =
                    CompletableFuture.supplyAsync(() -> uploadPart(
                            file, key, s3UploadId, partNumber, offset, thisSize,
                            sessionDir, completedCount, totalParts), uploadExecutor);

            futures.add(future);
        }

        // Wait for all parts to complete
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .get(uploadTimeoutMinutes, TimeUnit.MINUTES);
        } catch (TimeoutException e) {
            log.error("Upload timeout exceeded for file: {}", filename);
            futures.forEach(f -> f.cancel(true));
            throw new RuntimeException("Upload timeout exceeded", e);
        }

        // Collect all completed parts
        List<software.amazon.awssdk.services.s3.model.CompletedPart> completedParts = new ArrayList<>();
        for (CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future : futures) {
            completedParts.add(future.get());
        }

        // Sort by part number
        completedParts.sort(java.util.Comparator.comparingInt(
                software.amazon.awssdk.services.s3.model.CompletedPart::partNumber));

        // Complete the multipart upload
        b2Service.completeMultipartUpload(key, s3UploadId, completedParts);

        log.info("Upload completed successfully: {}", filename);

        // Write final progress
        String url = b2Service.getObjectUrl(key);
        writeProgress(sessionDir, "completed", totalParts, totalParts, key, s3UploadId, url);

        // Persist video metadata
        persistVideoMetadata(username, url, key, totalSize);

        // Cleanup
        cleanupDirectory(sessionDir);
    }

    private software.amazon.awssdk.services.s3.model.CompletedPart uploadPart(
            Path file, String key, String s3UploadId, int partNumber,
            long offset, int size, Path sessionDir,
            AtomicInteger completedCount, int totalParts) {

        long startNs = System.nanoTime();
        try (var raf = new java.io.RandomAccessFile(file.toFile(), "r");
             var channel = raf.getChannel()) {

            channel.position(offset);
            InputStream rawIn = java.nio.channels.Channels.newInputStream(channel);
            InputStream boundedIn = new BoundedInputStream(rawIn, size);

            String eTag = uploadPartWithRetry(key, s3UploadId, partNumber, boundedIn, size, DEFAULT_MAX_RETRIES);
            long durMs = (System.nanoTime() - startNs) / 1_000_000L;

            log.debug("Uploaded part={}, size={}B, time={}ms", partNumber, size, durMs);

            // Update progress
            int done = completedCount.incrementAndGet();
            writeProgress(sessionDir, "uploading", done, totalParts, key, s3UploadId, null);

            return software.amazon.awssdk.services.s3.model.CompletedPart.builder()
                    .partNumber(partNumber)
                    .eTag(eTag)
                    .build();
        } catch (Exception e) {
            log.error("Failed to upload part {}", partNumber, e);
            throw new RuntimeException("Failed to upload part " + partNumber, e);
        }
    }

    /**
     * Complete multipart upload by uploading parts in parallel
     */
    private void completeMultipartInParallel(Path uploadDir, Path metaFile,
                                             List<Map<String, Object>> partsList) throws Exception {

        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = objectMapper.readValue(metaFile.toFile(), Map.class);

        String key = (String) metadata.get("key");
        String s3UploadId = (String) metadata.get("uploadId");

        log.info("Completing upload in parallel: {} ({} parts)", key, partsList.size());

        AtomicInteger completed = new AtomicInteger(0);
        writeProgress(uploadDir, "uploading", 0, partsList.size(), key, s3UploadId, null);

        // Create futures for parallel part uploads
        List<CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart>> futures = new ArrayList<>();

        for (Map<String, Object> partInfo : partsList) {
            final int partNumber = ((Number) partInfo.get("partNumber")).intValue();

            CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future =
                    CompletableFuture.supplyAsync(() -> uploadSavedPart(
                            uploadDir, key, s3UploadId, partNumber, completed, partsList.size()), uploadExecutor);

            futures.add(future);
        }

        // Wait for all parts
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .get(uploadTimeoutMinutes, TimeUnit.MINUTES);

        // Collect completed parts
        List<software.amazon.awssdk.services.s3.model.CompletedPart> completedParts = new ArrayList<>();
        for (CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future : futures) {
            completedParts.add(future.get());
        }

        completedParts.sort(java.util.Comparator.comparingInt(
                software.amazon.awssdk.services.s3.model.CompletedPart::partNumber));

        b2Service.completeMultipartUpload(key, s3UploadId, completedParts);

        log.info("Upload completed successfully: {}", key);

        // Write final progress
        String url = b2Service.getObjectUrl(key);
        writeProgress(uploadDir, "completed", partsList.size(), partsList.size(), key, s3UploadId, url);

        // Persist video metadata
        Object maybeUser = metadata.get("username");
        if (maybeUser instanceof String username && username != null) {
            long totalSize = calculateTotalSize(uploadDir);
            persistVideoMetadata(username, url, key, totalSize);
        }

        // Cleanup
        cleanupDirectory(uploadDir);
    }

    private software.amazon.awssdk.services.s3.model.CompletedPart uploadSavedPart(
            Path uploadDir, String key, String s3UploadId, int partNumber,
            AtomicInteger completed, int totalParts) {

        long startNs = System.nanoTime();
        try {
            Path partFile = uploadDir.resolve(String.format("part-%05d.bin", partNumber));
            long size = Files.size(partFile);

            try (InputStream in = Files.newInputStream(partFile, StandardOpenOption.READ)) {
                String eTag = uploadPartWithRetry(key, s3UploadId, partNumber, in, size, DEFAULT_MAX_RETRIES);
                long durMs = (System.nanoTime() - startNs) / 1_000_000L;

                log.debug("Uploaded part={}, size={}B, time={}ms", partNumber, size, durMs);

                int done = completed.incrementAndGet();
                writeProgress(uploadDir, "uploading", done, totalParts, key, s3UploadId, null);

                return software.amazon.awssdk.services.s3.model.CompletedPart.builder()
                        .partNumber(partNumber)
                        .eTag(eTag)
                        .build();
            }
        } catch (Exception e) {
            log.error("Failed to upload part {}", partNumber, e);
            throw new RuntimeException("Failed to upload part " + partNumber, e);
        }
    }

    /**
     * Upload part with retry logic
     */
    private String uploadPartWithRetry(String key, String uploadId, int partNumber,
                                       InputStream data, long size, int maxRetries) throws IOException, InterruptedException {
        int attempt = 0;
        long backoffMs = INITIAL_RETRY_BACKOFF_MS;

        while (true) {
            attempt++;
            try {
                // Note: B2Service.uploadPart should handle closing the InputStream properly
                return b2Service.uploadPart(key, uploadId, partNumber, data, size);
            } catch (Exception ex) {
                if (attempt >= maxRetries) {
                    if (ex instanceof software.amazon.awssdk.services.s3.model.S3Exception s3e) {
                        log.error("Part {} failed with S3 status={}, code={}",
                                partNumber, s3e.statusCode(), s3e.awsErrorDetails().errorCode());
                    } else {
                        log.error("Part {} failed: {}", partNumber, ex.getMessage());
                    }
                    if (ex instanceof RuntimeException re) {
                        throw re;
                    }
                    throw new RuntimeException("Failed to upload part after " + maxRetries + " attempts", ex);
                }

                log.warn("Part {} upload attempt {} failed, retrying after {}ms", partNumber, attempt, backoffMs);
                Thread.sleep(backoffMs);
                backoffMs = Math.min(MAX_RETRY_BACKOFF_MS, backoffMs * 2);
            }
        }
    }

    /**
     * Cleanup temporary directory
     */
    private void cleanupDirectory(Path directory) {
        try {
            if (Files.exists(directory)) {
                Files.walk(directory)
                        .sorted(java.util.Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(file -> {
                            if (!file.delete()) {
                                log.warn("Failed to delete file: {}", file);
                            }
                        });
            }
        } catch (Exception e) {
            log.error("Failed to cleanup directory: {}", directory, e);
        }
    }

    /**
     * Write progress to file
     */
    private void writeProgress(Path sessionDir, String status, int completedParts, int totalParts,
                               String key, String uploadId, String url) {
        try {
            Path progressFile = sessionDir.resolve("progress.json");
            Map<String, Object> progress = new java.util.HashMap<>();
            progress.put("status", status);
            progress.put("completedParts", completedParts);
            progress.put("totalParts", totalParts);
            progress.put("key", key);
            progress.put("uploadId", uploadId);
            if (url != null) {
                progress.put("url", url);
            }
            objectMapper.writeValue(progressFile.toFile(), progress);
        } catch (Exception e) {
            log.error("Failed to write progress", e);
        }
    }

    /**
     * Update part upload progress
     */
    private void updatePartProgress(Path uploadDir) {
        try {
            Path metaFile = uploadDir.resolve("metadata.json");
            if (!Files.exists(metaFile)) {
                return;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> meta = objectMapper.readValue(metaFile.toFile(), Map.class);
            String key = (String) meta.get("key");
            String s3UploadId = (String) meta.get("uploadId");

            long partCount = Files.list(uploadDir)
                    .filter(p -> p.getFileName().toString().startsWith("part-"))
                    .count();

            writeProgress(uploadDir, "receiving_parts", (int) partCount, (int) partCount, key, s3UploadId, null);
        } catch (Exception e) {
            log.error("Failed to update part progress", e);
        }
    }

    /**
     * Calculate total size of all parts in upload directory
     */
    private long calculateTotalSize(Path uploadDir) {
        try {
            return Files.list(uploadDir)
                    .filter(p -> p.getFileName().toString().startsWith("part-"))
                    .mapToLong(p -> {
                        try {
                            return Files.size(p);
                        } catch (IOException e) {
                            log.warn("Failed to get size of part file: {}", p, e);
                            return 0L;
                        }
                    })
                    .sum();
        } catch (IOException e) {
            log.error("Failed to calculate total size", e);
            return 0L;
        }
    }

    /**
     * Persist video metadata for user
     */
    private void persistVideoMetadata(String username, String url, String key, long size) {
        if (username == null) {
            return;
        }

        try {
            var saved = videoService.saveVideoForUsername(username, url, key, size, null, VideoStatus.UPLOADED);
            if (saved.isEmpty()) {
                log.debug("Video not saved for username={}", username);
            } else {
                log.info("Video metadata persisted for username={}, key={}", username, key);
            }
        } catch (Exception ex) {
            log.error("Failed to persist video metadata for username={}", username, ex);
        }
    }

    /**
     * Get authenticated username from security context
     */
    private String getAuthenticatedUsername() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null ? auth.getName() : null;
        } catch (Exception e) {
            log.error("Failed to get authenticated username", e);
            return null;
        }
    }

    /**
     * Verify session ownership
     */
    private boolean verifySessionOwnership(Path uploadDir, String username) {
        try {
            Path metaFile = uploadDir.resolve("metadata.json");
            if (!Files.exists(metaFile)) {
                return true; // No metadata, allow
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> meta = objectMapper.readValue(metaFile.toFile(), Map.class);
            Object maybeUser = meta.get("username");

            if (maybeUser instanceof String sessionOwner) {
                return username.equals(sessionOwner);
            }
            return true; // No owner info, allow
        } catch (Exception e) {
            log.error("Failed to verify session ownership", e);
            return false;
        }
    }

    /**
     * Validate filename for security (prevent path traversal)
     */
    private boolean isValidFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return false;
        }

        // Check for path traversal attempts
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return false;
        }

        // Check for null bytes
        if (filename.indexOf('\0') != -1) {
            return false;
        }

        // Basic length check
        return filename.length() <= 255;
    }

    /**
     * Bounded InputStream that reads only a specific number of bytes
     */
    private static class BoundedInputStream extends java.io.FilterInputStream {
        private long remaining;

        protected BoundedInputStream(InputStream in, long maxBytes) {
            super(in);
            this.remaining = maxBytes;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int b = super.read();
            if (b != -1) {
                remaining--;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int toRead = (int) Math.min(len, remaining);
            int r = super.read(b, off, toRead);
            if (r > 0) {
                remaining -= r;
            }
            return r;
        }

        @Override
        public long skip(long n) throws IOException {
            long toSkip = Math.min(n, remaining);
            long skipped = super.skip(toSkip);
            remaining -= skipped;
            return skipped;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(super.available(), remaining);
        }
    }
}