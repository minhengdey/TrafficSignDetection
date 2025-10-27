package org.example.trafficsigndetection.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.example.trafficsigndetection.dto.request.LoginRequest;
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
    public ApiResponse<LoginResponse> authenticate(@RequestBody @Valid LoginRequest request,
            HttpServletResponse response) {
        LoginResponse loginResponse = authService.login(request);
        Cookie cookie = new Cookie("jwt", loginResponse.getToken());
        cookie.setHttpOnly(true); // Ensure the cookie is HttpOnly to prevent XSS attacks
        cookie.setSecure(false); // Make sure cookie is sent only over HTTPS
        cookie.setPath("/"); // Cookie is available to all paths
        cookie.setMaxAge(60 * 60 * 24); // Expiration time, e.g., 1 day
        response.addCookie(cookie);
        return ApiResponse.<LoginResponse>builder()
                .result(loginResponse)
                .code(1000)
                .build();
    }

    @GetMapping(value = "/me")
    public ApiResponse<UserResponse> getMyInfo(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        String jwtToken = null;
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

    @PutMapping(value = "/updateMyInfo")
    public ApiResponse<UserResponse> updateMyInfo(HttpServletRequest request,
            @RequestBody UpdateRequest updateRequest) {
        Cookie[] cookies = request.getCookies();
        String jwtToken = null;
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    jwtToken = cookie.getValue();
                    return ApiResponse.<UserResponse>builder()
                            .result(authService.updateMyInfo(jwtToken, updateRequest))
                            .code(1000)
                            .build();
                }
            }
        }
        throw new AppException(ErrorCode.COOKIE_NOT_FOUND);
    }

    @PostMapping(value = "/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    String token = cookie.getValue();
                    try {
                        com.nimbusds.jwt.SignedJWT signedJWT = com.nimbusds.jwt.SignedJWT.parse(token);
                        String jti = signedJWT.getJWTClaimsSet().getJWTID();
                        java.util.Date exp = signedJWT.getJWTClaimsSet().getExpirationTime();
                        org.example.trafficsigndetection.entity.InvalidatedToken it = org.example.trafficsigndetection.entity.InvalidatedToken
                                .builder()
                                .id(jti)
                                .expiryTime(exp)
                                .build();
                        invalidatedTokenRepository.save(it);
                    } catch (Exception ex) {
                        // ignore parse errors
                    }
                    // clear cookie
                    Cookie clear = new Cookie("jwt", "");
                    clear.setHttpOnly(true);
                    clear.setPath("/");
                    clear.setMaxAge(0);
                    response.addCookie(clear);
                    break;
                }
            }
        }
        return ApiResponse.<Void>builder().code(1000).message("Logged out").build();
    }

}
