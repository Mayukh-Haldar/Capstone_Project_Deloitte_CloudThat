package com.eventzen.auth.repository;

import com.eventzen.auth.entity.Permission;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByName(String name);

    default Permission findOrCreate(String name, String module, String action, String resourceType) {
        return findByName(name).orElseGet(() -> save(Permission.of(name, module, action, resourceType)));
    }
}
