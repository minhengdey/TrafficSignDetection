package org.example.trafficsigndetection.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.io.InputStream;
import java.util.UUID;

@Service
public class B2Service {

    private final S3Client s3;
    private final S3Presigner presigner;

    @Value("${b2.bucket}")
    private String bucket;

    @Value("${b2.endpoint}")
    private String endpoint; // ví dụ: https://s3.us-west-004.backblazeb2.com

    public B2Service(S3Client s3, S3Presigner presigner) {
        this.s3 = s3;
        this.presigner = presigner;
    }

    // Simple record to return multipart init info
    public static record MultipartInit(String key, String uploadId) {
    }

    /**
     * Upload đơn giản (server-side) - phù hợp file nhỏ/ vừa.
     * Trả về object key đã lưu trên bucket.
     */
    public String uploadSimple(MultipartFile file) throws IOException {
        String key = "uploads/" + UUID.randomUUID() + "-" + file.getOriginalFilename();

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
                .build();

        s3.putObject(putReq, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        return key;
    }

    /**
     * Tạo URL trực tiếp cho object (virtual-host style).
     * Lưu ý: nếu bucket private, URL này sẽ không truy cập được (cần presigned
     * GET).
     * Format: {endpoint}/{bucket}/{key}
     */
    public String getObjectUrl(String key) {
        // endpoint ví dụ: https://s3.us-west-004.backblazeb2.com
        // object url: https://s3.us-west-004.backblazeb2.com/<bucket>/<key>
        String normalizedEndpoint = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
        return normalizedEndpoint + "/" + bucket + "/" + key;
    }

    /**
     * Tạo presigned GET URL (nếu bucket private). validFor: Duration của URL.
     */
    public String presignGetUrl(String key, Duration validFor) {
        GetObjectRequest getReq = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        GetObjectPresignRequest presignGetReq = GetObjectPresignRequest.builder()
                .getObjectRequest(getReq)
                .signatureDuration(validFor)
                .build();

        PresignedGetObjectRequest presignedGet = presigner.presignGetObject(presignGetReq);
        return presignedGet.url().toString();
    }

    /**
     * Initiate a multipart upload and return the key + uploadId for the client to
     * use.
     */
    public MultipartInit initiateMultipartUpload(String originalFilename, String contentType) {
        String key = "uploads/" + UUID.randomUUID() + "-" + originalFilename;

        CreateMultipartUploadRequest req = CreateMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType == null ? "application/octet-stream" : contentType)
                .build();

        CreateMultipartUploadResponse resp = s3.createMultipartUpload(req);
        return new MultipartInit(key, resp.uploadId());
    }

    /**
     * Simple call to verify we can access the configured bucket; throws explicit
     * error if not.
     */
    public void assertBucketAccessible() {
        try {
            s3.listObjectsV2(ListObjectsV2Request.builder().bucket(bucket).maxKeys(1).build());
        } catch (S3Exception ex) {
            String msg = "B2 bucket is not authorized or not accessible: " + bucket +
                    ". Check credentials, bucket name, application key permissions (read/write), and region.";
            throw S3Exception.builder()
                    .awsErrorDetails(ex.awsErrorDetails())
                    .statusCode(ex.statusCode())
                    .message(msg)
                    .build();
        }
    }

    /**
     * Upload a single part to an existing multipart upload. The InputStream will be
     * read
     * and forwarded to S3. This keeps memory usage low by streaming.
     */
    public String uploadPart(String key, String uploadId, int partNumber, InputStream data, long size)
            throws IOException {
        UploadPartRequest uploadPartRequest = UploadPartRequest.builder()
                .bucket(bucket)
                .key(key)
                .uploadId(uploadId)
                .partNumber(partNumber)
                .build();

        UploadPartResponse resp = s3.uploadPart(uploadPartRequest, RequestBody.fromInputStream(data, size));
        // return ETag to client for completion
        return resp.eTag();
    }

    /**
     * Complete multipart upload using parts info provided by client (partNumber +
     * etag).
     */
    public void completeMultipartUpload(String key, String uploadId, List<CompletedPart> parts) {
        CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder()
                .parts(parts)
                .build();

        CompleteMultipartUploadRequest completeReq = CompleteMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(key)
                .uploadId(uploadId)
                .multipartUpload(completedMultipartUpload)
                .build();

        s3.completeMultipartUpload(completeReq);
    }

    public void abortMultipartUpload(String key, String uploadId) {
        AbortMultipartUploadRequest req = AbortMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(key)
                .uploadId(uploadId)
                .build();
        s3.abortMultipartUpload(req);
    }

    // Nếu cần, giữ các phương thức multipartUploadServerSide(...) ở phiên bản trước
    // để upload file lớn.
}