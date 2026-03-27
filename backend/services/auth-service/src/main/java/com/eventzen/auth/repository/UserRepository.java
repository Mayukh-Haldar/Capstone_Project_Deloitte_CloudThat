package com.eventzen.auth.repository;

import com.eventzen.auth.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);

    Optional<User> findByPasswordResetTokenHash(String tokenHash);

    Optional<User> findByEmailVerificationTokenHash(String tokenHash);

    Optional<User> findByGoogleSubject(String googleSubject);
}
