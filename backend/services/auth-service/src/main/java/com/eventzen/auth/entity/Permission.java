package com.eventzen.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @Column(name = "permission_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "permission_name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, length = 100)
    private String module;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "resource_type", length = 100)
    private String resourceType;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }

    public static Permission of(String name, String module, String action, String resourceType) {
        Permission permission = new Permission();
        permission.name = name;
        permission.module = module;
        permission.action = action;
        permission.resourceType = resourceType;
        return permission;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
