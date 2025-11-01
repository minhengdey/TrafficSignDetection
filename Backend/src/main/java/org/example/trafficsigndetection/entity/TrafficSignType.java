package org.example.trafficsigndetection.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(name = "traffic_sign_types")
public class TrafficSignType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
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
    @OneToMany(mappedBy = "signType")
    List<Detection> detections = new ArrayList<>();

    public TrafficSignType(String code, String name_en, String description) {
        this.code = code;
        this.name_en = name_en;
        this.description = description;
    }
}

