package org.example.trafficsigndetection.config;

import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

import jakarta.servlet.MultipartConfigElement;

@Configuration
public class MultipartConfig {

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        // allow up to 10 GB by default for very large uploads; adjust as needed
        factory.setMaxFileSize(DataSize.ofGigabytes(10));
        factory.setMaxRequestSize(DataSize.ofGigabytes(10));
        String tmp = System.getProperty("java.io.tmpdir");
        factory.setLocation(tmp);
        return factory.createMultipartConfig();
    }
}