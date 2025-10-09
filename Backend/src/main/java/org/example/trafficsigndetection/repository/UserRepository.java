package org.example.trafficsigndetection.repository;

import org.example.trafficsigndetection.entity.User;
import org.example.trafficsigndetection.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User,Long> {
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsernameAndRole(String username, Role role);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
}
