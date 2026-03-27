package com.eventzen.auth.repository;

import com.eventzen.auth.entity.RolePermission;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {

    boolean existsByRole_IdAndPermission_Id(UUID roleId, UUID permissionId);

    @EntityGraph(attributePaths = "permission")
    List<RolePermission> findAllByRole_Id(UUID roleId);
}
