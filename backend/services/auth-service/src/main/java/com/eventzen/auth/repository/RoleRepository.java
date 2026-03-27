package com.eventzen.auth.repository;

import com.eventzen.auth.entity.Role;
import com.eventzen.auth.security.RoleName;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByName(RoleName name);

    List<Role> findAllByNameIn(Collection<RoleName> names);
}
