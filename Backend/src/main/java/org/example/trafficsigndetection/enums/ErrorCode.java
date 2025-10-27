package org.example.trafficsigndetection.enums;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE)
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error", HttpStatus.INTERNAL_SERVER_ERROR),
    USER_EXISTED(1001, "User existed", HttpStatus.BAD_REQUEST),
    USERNAME_INVALID(1002, "Username cannot be blank", HttpStatus.BAD_REQUEST),
    PASSWORD_INVALID(1003, "Password must be at least 8 characters", HttpStatus.BAD_REQUEST),
    EMAIL_INVALID(1004, "Email invalid", HttpStatus.BAD_REQUEST),
    INVALID_KEY(1005, "Key invalid", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(1006, "You do not have permission", HttpStatus.FORBIDDEN),
    USER_NOT_FOUND(1007, "User not found", HttpStatus.NOT_FOUND),
    UNAUTHENTICATED(1008, "Unauthenticated", HttpStatus.UNAUTHORIZED),
    FILE_UPLOAD_ERROR(1009, "Cannot upload file", HttpStatus.BAD_REQUEST),
    VIDEO_NOT_FOUND(1011, "Video not found", HttpStatus.NOT_FOUND),
    SIGN_TYPE_NOT_FOUND(1012, "Sign type not found", HttpStatus.NOT_FOUND),
    DETECTION_NOT_FOUND(1013, "Detection not found", HttpStatus.NOT_FOUND),
    COOKIE_NOT_FOUND(1010, "Cookie not found", HttpStatus.BAD_REQUEST),
    ;

    int code;
    String message;
    HttpStatusCode statusCode;

    ErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
