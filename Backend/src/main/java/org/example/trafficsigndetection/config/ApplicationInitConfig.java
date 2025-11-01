package org.example.trafficsigndetection.config;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.enums.Role;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.example.trafficsigndetection.repository.UserRepository;
import org.example.trafficsigndetection.service.RoboflowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Configuration
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ApplicationInitConfig {
    PasswordEncoder passwordEncoder;
    RoboflowService roboflowService;

    @Bean
    ApplicationRunner init(UserRepository usersRepository, TrafficSignTypeRepository trafficSignTypeRepository) {
        return args -> {
            if (!usersRepository.existsByUsernameAndRole("admin", Role.ADMIN)) {
                User user = User.builder()
                        .username("admin")
                        .email("admin@gmail.com")
                        .role(Role.ADMIN)
                        .password(passwordEncoder.encode("admin123"))
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                usersRepository.save(user);
                log.warn("Admin has been created");
            }

            if (trafficSignTypeRepository.count() == 0) {
                roboflowService.importClassesToDb();
                log.info("All traffic sign types have been imported");
            }
        };
    }
}
