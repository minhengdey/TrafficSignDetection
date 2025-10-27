package org.example.trafficsigndetection.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.config.CustomJwtDecoder;
import org.example.trafficsigndetection.dto.request.LoginRequest;
import org.example.trafficsigndetection.dto.request.UpdateRequest;
import org.example.trafficsigndetection.dto.request.UserRequest;
import org.example.trafficsigndetection.dto.response.LoginResponse;
import org.example.trafficsigndetection.dto.response.UserResponse;
import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.enums.ErrorCode;
import org.example.trafficsigndetection.exception.AppException;
import org.example.trafficsigndetection.mapper.UserMapper;
import org.example.trafficsigndetection.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthService {
    UserRepository userRepository;
    UserMapper userMapper;
    PasswordEncoder passwordEncoder;
    CustomJwtDecoder jwtDecoder;

    @NonFinal
    @Value("${signer_key}")
    String SIGNER_KEY;

    public UserResponse register (UserRequest request) {
        if (userRepository.existsByUsername(request.getUsername()) ||
                userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }
        User user = userMapper.toEntity(request);
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        return userMapper.toResponse(userRepository.save(user));
    }

    public LoginResponse login (LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return LoginResponse.builder()
                    .token(generateToken(user))
                    .build();
        }
        throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    public UserResponse getMyInfo (String token) {
        Jwt decodedJwt = jwtDecoder.decode(token);
        Long userId = Long.valueOf(decodedJwt.getSubject());
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return userMapper.toResponse(user);
    }

    public UserResponse updateMyInfo (String token, UpdateRequest request) {
        Jwt decodedJwt = jwtDecoder.decode(token);
        Long userId = Long.valueOf(decodedJwt.getSubject());
        User user = userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail()) && !userRepository.existsByEmail(user.getEmail())) {
            user.setEmail(request.getEmail());
        }
        if (request.getUsername() != null && !request.getUsername().equals(user.getUsername()) && !userRepository.existsByUsername(user.getUsername())) {
            user.setUsername(request.getUsername());
        }
        if (request.getPassword() != null && request.getPassword().length() < 8) {
            throw new AppException(ErrorCode.PASSWORD_INVALID);
        } else if (request.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        user.setUpdatedAt(LocalDateTime.now());

        return userMapper.toResponse(userRepository.save(user));
    }

    public String generateToken(User user) {
        JWSHeader jwsHeader = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet jwtClaimsSet = new JWTClaimsSet.Builder()
                .subject(String.valueOf(user.getId()))
                .issuer("minhanh.com")
                .issueTime(new Date())
                .expirationTime(new Date(
                        Instant.now().plus(1000, ChronoUnit.HOURS).toEpochMilli()
                ))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", user.getRole())
                .build();
        Payload payload = new Payload(jwtClaimsSet.toJSONObject());
        JWSObject jwsObject = new JWSObject(jwsHeader, payload);
        try {
            jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Cannot create token", e);
            throw new RuntimeException(e);
        }
    }
}
