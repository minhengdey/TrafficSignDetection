package org.example.trafficsigndetection.service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class B2Service {
    S3Client s3;

    @NonFinal
    @Value("${b2.bucket}")
    String bucket;

    @NonFinal
    @Value("${b2.endpoint}")
    String endpoint;

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

    public String getObjectUrl(String key) {
        String normalizedEndpoint = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
        return normalizedEndpoint + "/" + bucket + "/" + key;
    }

    public void assertBucketAccessible() {
        try {
            s3.listObjectsV2(ListObjectsV2Request.builder().bucket(bucket).maxKeys(1).build());
        } catch (S3Exception ex) {
            throw S3Exception.builder()
                    .awsErrorDetails(ex.awsErrorDetails())
                    .statusCode(ex.statusCode())
                    .message(ex.getMessage())
                    .build();
        }
    }
}