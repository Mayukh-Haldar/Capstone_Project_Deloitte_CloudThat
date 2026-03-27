package com.eventzen.auth.config;

import com.eventzen.auth.entity.Permission;
import com.eventzen.auth.entity.Role;
import com.eventzen.auth.entity.RolePermission;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.entity.UserRole;
import com.eventzen.auth.repository.PermissionRepository;
import com.eventzen.auth.repository.RolePermissionRepository;
import com.eventzen.auth.repository.RoleRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.security.RoleName;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    private static final List<VendorSeedAccount> VENDOR_ACCOUNTS = List.of(
            new VendorSeedAccount(
                    UUID.fromString("92000000-0000-0000-0000-000000000001"),
                    "PulseCraft",
                    "AV",
                    "bookings@pulsecraftav.example",
                    "Vendor#PulseCraftAV2026",
                    "+91-90000-10001"
            ),
            new VendorSeedAccount(
                    UUID.fromString("92000000-0000-0000-0000-000000000002"),
                    "Northstar",
                    "Catering",
                    "hello@northstarcatering.example",
                    "Vendor#NorthstarCatering2026",
                    "+91-90000-10002"
            ),
            new VendorSeedAccount(
                    UUID.fromString("92000000-0000-0000-0000-000000000003"),
                    "Canvas",
                    "Bloom",
                    "studio@canvasbloom.example",
                    "Vendor#CanvasBloom2026",
                    "+91-90000-10003"
            ),
            new VendorSeedAccount(
                    UUID.fromString("92000000-0000-0000-0000-000000000004"),
                    "ShieldLine",
                    "Security",
                    "ops@shieldline.example",
                    "Vendor#ShieldLine2026",
                    "+91-90000-10004"
            )
    );

    @Bean
    CommandLineRunner seedAuthData(
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            RolePermissionRepository rolePermissionRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            AuthBootstrapProperties bootstrapProperties
    ) {
        return args -> {
            Map<RoleName, Role> roles = new EnumMap<>(RoleName.class);
            for (RoleName roleName : RoleName.values()) {
                Role role = roleRepository.findByName(roleName)
                        .orElseGet(() -> roleRepository.save(Role.create(roleName, roleName.getDescription())));
                roles.put(roleName, role);
            }

            List<Permission> permissions = List.of(
                    permissionRepository.findOrCreate("auth:read", "auth", "read", "service"),
                    permissionRepository.findOrCreate("auth:write", "auth", "write", "service"),
                    permissionRepository.findOrCreate("user:read", "users", "read", "user"),
                    permissionRepository.findOrCreate("user:write", "users", "write", "user"),
                    permissionRepository.findOrCreate("event:create", "events", "create", "event"),
                    permissionRepository.findOrCreate("event:read", "events", "read", "event"),
                    permissionRepository.findOrCreate("budget:read", "budget", "read", "budget")
            );

            grant(rolePermissionRepository, roles.get(RoleName.ADMIN), permissions);
            grant(rolePermissionRepository, roles.get(RoleName.ORGANIZER), filter(permissions, "auth:read", "event:create", "event:read", "budget:read"));
            grant(rolePermissionRepository, roles.get(RoleName.VENDOR), filter(permissions, "auth:read", "event:read"));
            grant(rolePermissionRepository, roles.get(RoleName.ATTENDEE), filter(permissions, "auth:read"));

            User admin = userRepository.findByEmailIgnoreCase(bootstrapProperties.adminEmail())
                    .orElseGet(() -> userRepository.save(User.bootstrapAdmin(
                            bootstrapProperties.adminFirstName(),
                            bootstrapProperties.adminLastName(),
                            bootstrapProperties.adminEmail(),
                            passwordEncoder.encode(bootstrapProperties.adminPassword())
                    )));

            if (!userRoleRepository.existsByUser_IdAndRole_Id(admin.getId(), roles.get(RoleName.ADMIN).getId())) {
                userRoleRepository.save(UserRole.of(admin, roles.get(RoleName.ADMIN), admin.getId()));
            }

            for (VendorSeedAccount seed : VENDOR_ACCOUNTS) {
                User vendorUser = userRepository.findById(seed.id())
                        .or(() -> userRepository.findByEmailIgnoreCase(seed.email()))
                        .orElseGet(() -> userRepository.save(User.seededAccount(
                                seed.id(),
                                seed.firstName(),
                                seed.lastName(),
                                seed.email(),
                                passwordEncoder.encode(seed.password()),
                                seed.phone()
                        )));

                for (RoleName roleName : Arrays.asList(RoleName.ORGANIZER, RoleName.VENDOR)) {
                    Role role = roles.get(roleName);
                    if (!userRoleRepository.existsByUser_IdAndRole_Id(vendorUser.getId(), role.getId())) {
                        userRoleRepository.save(UserRole.of(vendorUser, role, admin.getId()));
                    }
                }
            }
        };
    }

    private static List<Permission> filter(List<Permission> permissions, String... names) {
        return permissions.stream()
                .filter(permission -> List.of(names).contains(permission.getName()))
                .toList();
    }

    private static void grant(RolePermissionRepository repository, Role role, List<Permission> permissions) {
        for (Permission permission : permissions) {
            if (!repository.existsByRole_IdAndPermission_Id(role.getId(), permission.getId())) {
                repository.save(RolePermission.of(role, permission));
            }
        }
    }

    private record VendorSeedAccount(
            UUID id,
            String firstName,
            String lastName,
            String email,
            String password,
            String phone
    ) {
    }
}
