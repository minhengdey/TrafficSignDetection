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
import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.dto.response.ApiResponse;
import org.example.trafficsigndetection.dto.response.LoginResponse;
import org.example.trafficsigndetection.dto.response.UserResponse;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.service.AuthService;
import org.example.trafficsigndetection.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.text.ParseException;

@RestController
@RequestMapping(value = "/api/auth")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthController {
    AuthService authService;

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
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(60 * 60 * 24);
        response.addCookie(cookie);
        return ApiResponse.<LoginResponse>builder()
                .result(loginResponse)
                .code(1000)
                .build();
    }

    @GetMapping(value = "/me")
    public ApiResponse<UserResponse> getMyInfo (HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        String jwtToken;
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    jwtToken = cookie.getValue();
                    return ApiResponse.<UserResponse>builder()
                            .result(authService.getMyInfo(jwtToken))
                            .code(1000)
                            .build();
                }
            }
        }
        throw new AppException(ErrorCode.COOKIE_NOT_FOUND);
    }

    @PutMapping("/updateMyInfo")
    public ApiResponse<UserResponse>  updateMyInfo(HttpServletRequest request, @Valid @RequestBody UserRequest userRequest) {
        Cookie[] cookies = request.getCookies();
        String jwtToken;
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    jwtToken = cookie.getValue();
                    return ApiResponse.<UserResponse>builder()
                            .result(authService.updateMyInfo(jwtToken, userRequest))
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

        Cookie cookie = new Cookie("jwt", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ApiResponse.<Void>builder()
                .code(1000)
                .message("Logout thành công!")
                .build();
    }

}
