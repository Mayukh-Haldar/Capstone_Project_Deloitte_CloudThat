package com.eventzen.auth.entity;

import com.eventzen.auth.security.RoleName;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @Column(name = "role_id", nullable = false, updatable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_name", nullable = false, unique = true, length = 50)
    private RoleName name;

    @Column(length = 255)
    private String description;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }

    public static Role create(RoleName name, String description) {
        Role role = new Role();
        role.name = name;
        role.description = description;
        return role;
    }

    public UUID getId() {
        return id;
    }

    public RoleName getName() {
        return name;
    }
}
