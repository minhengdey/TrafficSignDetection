package org.example.trafficsigndetection.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Data
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(name = "traffic_sign_types")
public class TrafficSignType {
    @Id
    Integer id;

    @Column(nullable = false, unique = true, length = 50)
    String code;

    @Column(nullable = false, length = 200)
    String name_vi;

    @Column(nullable = false, length = 200)
    String name_en;

    @Column(columnDefinition = "TEXT")
    String description;

    @JsonIgnore
    @OneToMany(mappedBy = "signType", cascade = CascadeType.ALL, orphanRemoval = true)
    List<Detection> detections = new ArrayList<>();
}

