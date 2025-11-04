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
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class B2Service {

    S3Client s3;
    S3Presigner presigner;

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