package com.eventzen.auth.repository;

import com.eventzen.auth.entity.UserRole;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    @EntityGraph(attributePaths = "role")
    List<UserRole> findAllByUser_Id(UUID userId);

    void deleteAllByUser_Id(UUID userId);

    boolean existsByUser_IdAndRole_Id(UUID userId, UUID roleId);
}
