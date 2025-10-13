package org.example.trafficsigndetection.controller;

import org.example.trafficsigndetection.service.B2Service;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
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

@RestController
@RequestMapping("/api/upload")
@CrossOrigin(origins = "*") // dev: sửa origin khi deploy
public class UploadController {

    private final B2Service b2Service;

    // Thread pool for parallel part uploads - configurable, defaults to 2x CPU
    private final ExecutorService uploadExecutor = Executors.newFixedThreadPool(
            Math.max(2, Integer.parseInt(System.getProperty(
                    "ttd.uploadThreads",
                    String.valueOf(Runtime.getRuntime().availableProcessors() * 2)))));

    // Background executor for orchestrating uploads
    private final ExecutorService backgroundExec = Executors.newCachedThreadPool();

    // temp base dir for storing uploads and parts
    private final Path tempBase = Path.of(System.getProperty("java.io.tmpdir"), "ttd-uploads");

    // Configurable chunk size (default 10MB for optimal performance)
    private final int chunkSize = Integer.parseInt(
            System.getProperty("ttd.chunkSize", String.valueOf(10 * 1024 * 1024)));

    public UploadController(B2Service b2Service) {
        this.b2Service = b2Service;
        try {
            Files.createDirectories(tempBase);
        } catch (Exception ignored) {
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
            switch (Objects.requireNonNullElse(action, "upload")) {
                case "upload": {
                    // Main upload endpoint with automatic chunking and parallel upload
                    if (file == null || file.isEmpty()) {
                        return ResponseEntity.badRequest().body(Map.of("error", "file is required"));
                    }
                    // verify bucket access early
                    try {
                        b2Service.assertBucketAccessible();
                    } catch (Exception ex) {
                        return ResponseEntity.status(403).body(Map.of(
                                "error", "bucket access failed",
                                "details", ex.getMessage()));
                    }

                    final long SIMPLE_LIMIT = 100L * 1024L * 1024L; // 100MB threshold
                    long fileSize = file.getSize();

                    if (fileSize <= SIMPLE_LIMIT && !"true".equals(request.getParameter("forceMultipart"))) {
                        // Simple direct upload for small files
                        String keySaved = b2Service.uploadSimple(file);
                        String url = b2Service.getObjectUrl(keySaved);
                        if (returnPresignedGet) {
                            String presignedGet = b2Service.presignGetUrl(keySaved, Duration.ofMinutes(30));
                            return ResponseEntity.ok(Map.of(
                                    "key", keySaved,
                                    "url", url,
                                    "presignedGetUrl", presignedGet));
                        } else {
                            return ResponseEntity.ok(Map.of("key", keySaved, "url", url));
                        }
                    }

                    // Large file: parallel chunked upload
                    String sessionId = UUID.randomUUID().toString();
                    Path sessionDir = tempBase.resolve(sessionId);
                    Files.createDirectories(sessionDir);
                    Path outFile = sessionDir.resolve("upload.bin");

                    // Save uploaded file to temp
                    try (var in = file.getInputStream();
                            var out = Files.newOutputStream(outFile, StandardOpenOption.CREATE,
                                    StandardOpenOption.TRUNCATE_EXISTING)) {
                        in.transferTo(out);
                    }

                    String originalFilename = file.getOriginalFilename();
                    String originalContentType = file.getContentType();

                    // Submit background job for parallel upload
                    CompletableFuture.runAsync(() -> {
                        try {
                            uploadFileInParallel(outFile, originalFilename, originalContentType, sessionDir);
                        } catch (Exception ex) {
                            ex.printStackTrace();
                            cleanupDirectory(sessionDir);
                        }
                    }, backgroundExec);

                    return ResponseEntity.accepted().body(Map.of(
                            "uploadId", sessionId,
                            "message", "file accepted, uploading in parallel",
                            "fileSize", fileSize,
                            "estimatedChunks", (fileSize + chunkSize - 1) / chunkSize));
                }

                case "init": {
                    // Initialize multipart upload for client-side chunking
                    if (filename == null || filename.isBlank()) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "filename is required for init"));
                    }
                    // verify bucket access early to catch UnauthorizedAccess quickly
                    try {
                        b2Service.assertBucketAccessible();
                    } catch (Exception ex) {
                        return ResponseEntity.status(403).body(Map.of(
                                "error", "bucket access failed",
                                "details", ex.getMessage()));
                    }
                    var init = b2Service.initiateMultipartUpload(filename, contentType);

                    // Create session directory for tracking
                    String sessionId = UUID.randomUUID().toString();
                    Path sessionDir = tempBase.resolve(sessionId);
                    Files.createDirectories(sessionDir);

                    // Store metadata
                    Path metaFile = sessionDir.resolve("metadata.json");
                    Map<String, Object> metadata = Map.of(
                            "key", init.key(),
                            "uploadId", init.uploadId(),
                            "filename", filename,
                            "contentType", contentType != null ? contentType : "application/octet-stream");
                    new ObjectMapper().writeValue(metaFile.toFile(), metadata);

                    // Initialize progress
                    Path progressFile = sessionDir.resolve("progress.json");
                    Map<String, Object> progress = Map.of(
                            "status", "initialized",
                            "completedParts", 0,
                            "totalParts", 0,
                            "key", init.key(),
                            "uploadId", init.uploadId());
                    new ObjectMapper().writeValue(progressFile.toFile(), progress);

                    return ResponseEntity.ok(Map.of(
                            "sessionId", sessionId,
                            "key", init.key(),
                            "uploadId", init.uploadId(),
                            "recommendedChunkSize", chunkSize));
                }

                case "part": {
                    // Upload a single part (for client-side chunked uploads)
                    if (uploadId == null || partNumber == null) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "uploadId (sessionId) and partNumber required"));
                    }

                    Path uploadDir = tempBase.resolve(uploadId);
                    if (!Files.exists(uploadDir)) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "Invalid uploadId or session expired"));
                    }

                    // Save part to temp
                    try (var in = request.getInputStream()) {
                        Files.createDirectories(uploadDir);
                        Path partFile = uploadDir.resolve(String.format("part-%05d.bin", partNumber));
                        try (var out = Files.newOutputStream(partFile, StandardOpenOption.CREATE,
                                StandardOpenOption.TRUNCATE_EXISTING)) {
                            in.transferTo(out);
                        }
                        // Update progress snapshot (best-effort)
                        try {
                            Path metaFile = uploadDir.resolve("metadata.json");
                            @SuppressWarnings("unchecked")
                            Map<String, Object> meta = new ObjectMapper().readValue(metaFile.toFile(), Map.class);
                            String key = (String) meta.get("key");
                            String s3UploadId = (String) meta.get("uploadId");
                            long done = Files.list(uploadDir)
                                    .filter(p -> p.getFileName().toString().startsWith("part-")).count();
                            Path progressFile = uploadDir.resolve("progress.json");
                            Map<String, Object> progress = Map.of(
                                    "status", "receiving_parts",
                                    "completedParts", (int) done,
                                    "totalParts", (int) done,
                                    "key", key,
                                    "uploadId", s3UploadId);
                            new ObjectMapper().writeValue(progressFile.toFile(), progress);
                        } catch (Exception ignored) {
                        }
                        return ResponseEntity.ok(Map.of(
                                "ok", true,
                                "part", partNumber,
                                "size", Files.size(partFile)));
                    }
                }

                case "complete": {
                    // Complete multipart upload with parallel part upload to B2
                    ObjectMapper mapper = new ObjectMapper();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> body = mapper.readValue(request.getInputStream(), Map.class);
                    String sessionId = (String) body.get("uploadId");
                    var partsList = (List<?>) body.get("parts");

                    if (sessionId == null) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "uploadId (sessionId) required"));
                    }

                    Path uploadDir = tempBase.resolve(sessionId);
                    Path metaFile = uploadDir.resolve("metadata.json");

                    if (!Files.exists(metaFile)) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "Invalid session or metadata not found"));
                    }

                    // Submit parallel completion job
                    CompletableFuture.runAsync(() -> {
                        try {
                            completeMultipartInParallel(uploadDir, metaFile, partsList);
                        } catch (Exception ex) {
                            ex.printStackTrace();
                            cleanupDirectory(uploadDir);
                        }
                    }, backgroundExec);

                    return ResponseEntity.accepted().body(Map.of(
                            "ok", true,
                            "message", "completing upload in parallel",
                            "totalParts", partsList.size()));
                }

                case "abort": {
                    // Abort multipart upload and cleanup
                    String uid = uploadId != null ? uploadId : request.getParameter("uploadId");
                    if (uid == null) {
                        return ResponseEntity.badRequest().body(Map.of("error", "uploadId required"));
                    }

                    Path uploadDir = tempBase.resolve(uid);
                    cleanupDirectory(uploadDir);

                    return ResponseEntity.ok(Map.of("ok", true, "message", "upload aborted and cleaned up"));
                }

                default:
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "unknown action: " + action));
            }
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam("uploadId") String uploadId) {
        if (uploadId == null || uploadId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "uploadId required"));
        }
        try {
            Path sessionDir = tempBase.resolve(uploadId);
            Path progressFile = sessionDir.resolve("progress.json");
            if (!Files.exists(progressFile)) {
                return ResponseEntity.ok(Map.of(
                        "status", "unknown",
                        "message", "no progress yet"));
            }
            ObjectMapper mapper = new ObjectMapper();
            @SuppressWarnings("unchecked")
            Map<String, Object> progress = mapper.readValue(progressFile.toFile(), Map.class);
            return ResponseEntity.ok(progress);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Upload file in parallel chunks for maximum speed
     */
    private void uploadFileInParallel(Path file, String filename, String contentType, Path sessionDir)
            throws Exception {

        var init = b2Service.initiateMultipartUpload(filename, contentType);
        String key = init.key();
        String s3UploadId = init.uploadId();

        long totalSize = Files.size(file);
        int totalParts = (int) ((totalSize + chunkSize - 1) / chunkSize);

        System.out.println("Starting parallel upload: " + filename +
                " (" + totalSize + " bytes, " + totalParts + " parts)");

        // progress file
        Path progressFile = sessionDir.resolve("progress.json");
        java.util.function.BiConsumer<Integer, Integer> writeProgress = (done, total) -> {
            try {
                Map<String, Object> progress = Map.of(
                        "status", "uploading",
                        "completedParts", done,
                        "totalParts", total,
                        "key", key,
                        "uploadId", s3UploadId);
                new ObjectMapper().writeValue(progressFile.toFile(), progress);
            } catch (Exception ignored) {
            }
        };
        writeProgress.accept(0, totalParts);

        // Create futures for all part uploads
        List<CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart>> futures = new ArrayList<>();

        // Submit all parts for parallel upload
        for (int i = 0; i < totalParts; i++) {
            final int partNumber = i + 1;
            final long offset = (long) i * chunkSize;
            final long remain = totalSize - offset;
            final int thisSize = (int) Math.min(chunkSize, remain);

            CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future = CompletableFuture
                    .supplyAsync(() -> {
                        long startNs = System.nanoTime();
                        try (var raf = new java.io.RandomAccessFile(file.toFile(), "r");
                                var channel = raf.getChannel()) {
                            channel.position(offset);
                            java.io.InputStream rawIn = java.nio.channels.Channels.newInputStream(channel);
                            java.io.InputStream bounded = new java.io.FilterInputStream(rawIn) {
                                private long remaining = thisSize;

                                @Override
                                public int read() throws java.io.IOException {
                                    if (remaining <= 0)
                                        return -1;
                                    int b = super.read();
                                    if (b != -1)
                                        remaining--;
                                    return b;
                                }

                                @Override
                                public int read(byte[] b, int off, int len) throws java.io.IOException {
                                    if (remaining <= 0)
                                        return -1;
                                    int toRead = (int) Math.min(len, remaining);
                                    int r = super.read(b, off, toRead);
                                    if (r > 0)
                                        remaining -= r;
                                    return r;
                                }
                            };

                            String eTag = uploadPartWithRetry(key, s3UploadId, partNumber, bounded, thisSize, 3);
                            long durMs = (System.nanoTime() - startNs) / 1_000_000L;
                            System.out.println(
                                    "[upload] part=" + partNumber + ", size=" + thisSize + "B, time=" + durMs + "ms");

                            // update progress
                            int done = (int) futures.stream().filter(CompletableFuture::isDone).count() + 1;
                            writeProgress.accept(done, totalParts);
                            return software.amazon.awssdk.services.s3.model.CompletedPart.builder()
                                    .partNumber(partNumber)
                                    .eTag(eTag)
                                    .build();
                        } catch (Exception e) {
                            throw new RuntimeException("Failed to upload part " + partNumber, e);
                        }
                    }, uploadExecutor);

            futures.add(future);
        }

        // Wait for all parts to complete
        CompletableFuture<Void> allOf = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));

        try {
            allOf.get(30, TimeUnit.MINUTES); // Timeout for very large files
        } catch (TimeoutException e) {
            // Cancel remaining uploads
            futures.forEach(f -> f.cancel(true));
            throw new RuntimeException("Upload timeout exceeded", e);
        }

        // Collect all completed parts
        List<software.amazon.awssdk.services.s3.model.CompletedPart> completedParts = new ArrayList<>();
        for (CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future : futures) {
            completedParts.add(future.get());
        }

        // Sort by part number
        completedParts.sort(java.util.Comparator
                .comparingInt(software.amazon.awssdk.services.s3.model.CompletedPart::partNumber));

        // Complete the multipart upload
        b2Service.completeMultipartUpload(key, s3UploadId, completedParts);

        System.out.println("Upload completed successfully: " + filename);

        // write final progress
        try {
            Map<String, Object> progress = Map.of(
                    "status", "completed",
                    "completedParts", totalParts,
                    "totalParts", totalParts,
                    "key", key,
                    "uploadId", s3UploadId,
                    "url", b2Service.getObjectUrl(key));
            new ObjectMapper().writeValue(progressFile.toFile(), progress);
        } catch (Exception ignored) {
        }

        // Cleanup
        cleanupDirectory(sessionDir);
    }

    /**
     * Complete multipart upload by uploading parts in parallel
     */
    private void completeMultipartInParallel(Path uploadDir, Path metaFile, List<?> partsList)
            throws Exception {

        ObjectMapper mapper = new ObjectMapper();
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = mapper.readValue(metaFile.toFile(), Map.class);

        String key = (String) metadata.get("key");
        String s3UploadId = (String) metadata.get("uploadId");

        System.out.println("Completing upload in parallel: " + key + " (" + partsList.size() + " parts)");

        // progress file
        Path progressFile = uploadDir.resolve("progress.json");
        java.util.concurrent.atomic.AtomicInteger completed = new java.util.concurrent.atomic.AtomicInteger(0);
        java.util.function.IntConsumer writeProgress = (done) -> {
            try {
                Map<String, Object> progress = Map.of(
                        "status", "uploading",
                        "completedParts", done,
                        "totalParts", partsList.size(),
                        "key", key,
                        "uploadId", s3UploadId);
                new ObjectMapper().writeValue(progressFile.toFile(), progress);
            } catch (Exception ignored) {
            }
        };
        writeProgress.accept(0);

        // Create futures for parallel part uploads
        List<CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart>> futures = new ArrayList<>();

        for (Object o : partsList) {
            Map<?, ?> m = (Map<?, ?>) o;
            final int partNumber = ((Number) m.get("partNumber")).intValue();

            CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future = CompletableFuture
                    .supplyAsync(() -> {
                        long startNs = System.nanoTime();
                        try {
                            Path partFile = uploadDir.resolve(String.format("part-%05d.bin", partNumber));
                            long size = Files.size(partFile);
                            try (var in = Files.newInputStream(partFile, StandardOpenOption.READ)) {
                                String eTag = uploadPartWithRetry(key, s3UploadId, partNumber, in, size, 3);
                                long durMs = (System.nanoTime() - startNs) / 1_000_000L;
                                System.out.println(
                                        "[upload] part=" + partNumber + ", size=" + size + "B, time=" + durMs + "ms");
                                int done = completed.incrementAndGet();
                                writeProgress.accept(done);
                                return software.amazon.awssdk.services.s3.model.CompletedPart.builder()
                                        .partNumber(partNumber)
                                        .eTag(eTag)
                                        .build();
                            }
                        } catch (Exception e) {
                            throw new RuntimeException("Failed to upload part " + partNumber, e);
                        }
                    }, uploadExecutor);

            futures.add(future);
        }

        // Wait for all parts
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .get(30, TimeUnit.MINUTES);

        // Collect completed parts
        List<software.amazon.awssdk.services.s3.model.CompletedPart> completedParts = new ArrayList<>();
        for (CompletableFuture<software.amazon.awssdk.services.s3.model.CompletedPart> future : futures) {
            completedParts.add(future.get());
        }

        completedParts.sort(java.util.Comparator
                .comparingInt(software.amazon.awssdk.services.s3.model.CompletedPart::partNumber));

        b2Service.completeMultipartUpload(key, s3UploadId, completedParts);

        System.out.println("Upload completed successfully: " + key);

        // Final progress
        try {
            Map<String, Object> progress = Map.of(
                    "status", "completed",
                    "completedParts", partsList.size(),
                    "totalParts", partsList.size(),
                    "key", key,
                    "uploadId", s3UploadId,
                    "url", b2Service.getObjectUrl(key));
            new ObjectMapper().writeValue(progressFile.toFile(), progress);
        } catch (Exception ignored) {
        }

        // Cleanup
        cleanupDirectory(uploadDir);
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
                        .forEach(java.io.File::delete);
            }
        } catch (Exception e) {
            System.err.println("Failed to cleanup directory: " + directory);
            e.printStackTrace();
        }
    }

    private String uploadPartWithRetry(String key, String uploadId, int partNumber,
            java.io.InputStream data, long size, int maxRetries) throws IOException, InterruptedException {
        int attempt = 0;
        long backoffMs = 500;
        while (true) {
            attempt++;
            try {
                return b2Service.uploadPart(key, uploadId, partNumber, data, size);
            } catch (Exception ex) {
                if (attempt >= maxRetries) {
                    if (ex instanceof software.amazon.awssdk.services.s3.model.S3Exception s3e) {
                        System.err.println("[upload] part=" + partNumber + " failed with S3 status=" + s3e.statusCode()
                                + ", code=" + s3e.awsErrorDetails().errorCode());
                    } else {
                        System.err.println("[upload] part=" + partNumber + " failed: " + ex.getMessage());
                    }
                    if (ex instanceof RuntimeException re)
                        throw re;
                    throw new RuntimeException(ex);
                }
                // simple backoff then retry
                Thread.sleep(backoffMs);
                backoffMs = Math.min(4000, backoffMs * 2);
            }
        }
    }
}