package org.example.trafficsigndetection.exception;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.enums.ErrorCode;

@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AppException extends RuntimeException {
    ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
