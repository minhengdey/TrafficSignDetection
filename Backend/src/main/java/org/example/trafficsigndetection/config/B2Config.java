package org.example.trafficsigndetection.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class B2Config {

        @Bean
        public S3Client s3Client(Environment env) {
                String endpoint = env.getProperty("b2.endpoint");
                String accessKey = env.getProperty("b2.access-key");
                String secretKey = env.getProperty("b2.secret-key");
                String region = env.getProperty("b2.region", "us-west-004");

                return S3Client.builder()
                                .endpointOverride(URI.create(endpoint))
                                .forcePathStyle(true) // Backblaze B2 requires path-style for many operations
                                .credentialsProvider(StaticCredentialsProvider.create(
                                                AwsBasicCredentials.create(accessKey, secretKey)))
                                .region(Region.of(region))
                                .build();
        }

        @Bean
        public S3Presigner s3Presigner(Environment env) {
                String endpoint = env.getProperty("b2.endpoint");
                String accessKey = env.getProperty("b2.access-key");
                String secretKey = env.getProperty("b2.secret-key");
                String region = env.getProperty("b2.region", "us-west-004");

                return S3Presigner.builder()
                                .endpointOverride(URI.create(endpoint))
                                .credentialsProvider(StaticCredentialsProvider.create(
                                                AwsBasicCredentials.create(accessKey, secretKey)))
                                .region(Region.of(region))
                                .build();
        }
}