package org.example.trafficsigndetection.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MultipartException;

import java.util.Map;

@ControllerAdvice
@Slf4j
public class MultipartExceptionHandler {

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<?> handleMultipartException(MultipartException ex, HttpServletRequest request) {
        try {
            String ct = request.getHeader("Content-Type");
            String cl = request.getHeader("Content-Length");
            log.warn("MultipartException parsing request: content-type='{}' content-length='{}' uri='{}'", ct, cl,
                    request.getRequestURI());
        } catch (Exception e) {
            log.warn("MultipartException and failed to read headers: {}", e.getMessage());
        }

        log.warn("Multipart parsing failed: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Failed to parse multipart request", "message", ex.getMessage()));
    }
}
