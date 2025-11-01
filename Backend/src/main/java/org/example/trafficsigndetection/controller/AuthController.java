package org.example.trafficsigndetection.controller;

import com.nimbusds.jose.JOSEException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.request.LoginRequest;
import org.example.trafficsigndetection.dto.request.LogoutRequest;
import org.example.trafficsigndetection.dto.request.UpdateRequest;
import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.LoginResponse;
import org.example.trafficsigndetection.dto.response.UserResponse;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.AuthService;
import org.example.trafficsigndetection.repository.InvalidatedTokenRepository;
import org.springframework.web.bind.annotation.*;

import java.text.ParseException;

@RestController
@RequestMapping(value = "/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthController {
    AuthService authService;
    InvalidatedTokenRepository invalidatedTokenRepository;

    @PostMapping(value = "/register")
    public ApiResponse<UserResponse> register(@Valid @RequestBody UserRequest userRequest) {
        return ApiResponse.<UserResponse>builder()
                .code(1000)
                .message("Successfully registered user")
                .result(authService.register(userRequest))
                .build();
    }

    @PostMapping(value = "/login")
    public ApiResponse<LoginResponse> authenticate (@RequestBody @Valid LoginRequest request, HttpServletResponse response) {
        LoginResponse loginResponse = authService.login(request);
        Cookie cookie = new Cookie("jwt", loginResponse.getToken());
        cookie.setHttpOnly(true);  // Ensure the cookie is HttpOnly to prevent XSS attacks
        cookie.setSecure(false);  // Make sure cookie is sent only over HTTPS
        cookie.setPath("/");  // Cookie is available to all paths
        cookie.setMaxAge(60 * 60 * 24);  // Expiration time, e.g., 1 day
        response.addCookie(cookie);
        return ApiResponse.<LoginResponse>builder()
                .result(loginResponse)
                .code(1000)
                .build();
    }

    @GetMapping(value = "/me")
    public ApiResponse<Object> getMyInfo (HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        String jwtToken = null;
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) { // Cookie chứa JWT
                    jwtToken = cookie.getValue();
                    return ApiResponse.builder()
                            .result(authService.getMyInfo(jwtToken))
                            .code(1000)
                            .build();
                }
            }
        }
        throw new AppException(ErrorCode.COOKIE_NOT_FOUND);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response)
            throws ParseException, JOSEException {

        // Lấy JWT từ cookie
        String jwtToken = null;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    jwtToken = cookie.getValue();
                    break;
                }
            }
        }

        authService.logout(LogoutRequest.builder()
                .token(jwtToken).build());

        // Xóa cookie JWT bằng cách đặt thời gian sống = 0
        Cookie cookie = new Cookie("jwt", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Đổi thành true nếu dùng HTTPS
        cookie.setPath("/");
        cookie.setMaxAge(0); // Hết hạn ngay lập tức
        response.addCookie(cookie);

        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Logout thành công!")
                .build();
    }

}
