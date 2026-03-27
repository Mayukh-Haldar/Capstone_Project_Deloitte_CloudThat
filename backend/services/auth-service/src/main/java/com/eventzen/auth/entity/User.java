package com.eventzen.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(length = 20)
    private String phone;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "is_mfa_enabled", nullable = false)
    private boolean mfaEnabled;

    @Column(name = "mfa_secret", length = 512)
    private String mfaSecret;

    @Column(name = "password_reset_token_hash", length = 64)
    private String passwordResetTokenHash;

    @Column(name = "password_reset_token_expires_at")
    private Instant passwordResetTokenExpiresAt;

    @Column(name = "email_verification_token_hash", length = 64)
    private String emailVerificationTokenHash;

    @Column(name = "email_verification_token_expires_at")
    private Instant emailVerificationTokenExpiresAt;

    @Column(name = "google_subject", unique = true, length = 255)
    private String googleSubject;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public static User register(String firstName, String lastName, String email, String passwordHash, String phone) {
        User user = new User();
        user.firstName = firstName;
        user.lastName = lastName;
        user.email = email.toLowerCase();
        user.passwordHash = passwordHash;
        user.phone = phone;
        return user;
    }

    public static User bootstrapAdmin(String firstName, String lastName, String email, String passwordHash) {
        User user = register(firstName, lastName, email, passwordHash, null);
        user.emailVerified = true;
        return user;
    }

    public static User seededAccount(UUID id, String firstName, String lastName, String email, String passwordHash, String phone) {
        User user = register(firstName, lastName, email, passwordHash, phone);
        user.id = id;
        user.emailVerified = true;
        user.active = true;
        return user;
    }

    public static User localDevStub(UUID id, String email) {
        User user = new User();
        user.id = id;
        user.firstName = "Local";
        user.lastName = "User";
        user.email = email.toLowerCase();
        user.passwordHash = "LOCAL_DEV_ONLY";
        user.emailVerified = true;
        user.active = true;
        user.createdAt = Instant.now();
        user.updatedAt = user.createdAt;
        return user;
    }

    public UUID getId() {
        return id;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public String getMfaSecret() {
        return mfaSecret;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public String getPasswordResetTokenHash() {
        return passwordResetTokenHash;
    }

    public Instant getPasswordResetTokenExpiresAt() {
        return passwordResetTokenExpiresAt;
    }

    public String getEmailVerificationTokenHash() {
        return emailVerificationTokenHash;
    }

    public Instant getEmailVerificationTokenExpiresAt() {
        return emailVerificationTokenExpiresAt;
    }

    public String getGoogleSubject() {
        return googleSubject;
    }

    public void setMfaSecret(String mfaSecret) {
        this.mfaSecret = mfaSecret;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public void deactivate() {
        this.active = false;
    }

    public void reactivate() {
        this.active = true;
    }

    public void setPasswordResetToken(String tokenHash, Instant expiresAt) {
        this.passwordResetTokenHash = tokenHash;
        this.passwordResetTokenExpiresAt = expiresAt;
    }

    public void clearPasswordResetToken() {
        this.passwordResetTokenHash = null;
        this.passwordResetTokenExpiresAt = null;
    }

    public void setEmailVerificationToken(String tokenHash, Instant expiresAt) {
        this.emailVerificationTokenHash = tokenHash;
        this.emailVerificationTokenExpiresAt = expiresAt;
    }

    public void clearEmailVerificationToken() {
        this.emailVerificationTokenHash = null;
        this.emailVerificationTokenExpiresAt = null;
    }

    public void markEmailVerified() {
        this.emailVerified = true;
        clearEmailVerificationToken();
    }

    public void updatePassword(String passwordHash) {
        this.passwordHash = passwordHash;
        clearPasswordResetToken();
    }

    public void linkGoogleSubject(String googleSubject) {
        this.googleSubject = googleSubject;
    }

    public void updateProfile(String firstName, String lastName, String email, String phone) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email.toLowerCase();
        this.phone = phone;
    }

    public void markEmailUnverified() {
        this.emailVerified = false;
    }

    public void gdprDelete(String replacementEmail) {
        this.firstName = "Deleted";
        this.lastName = "User";
        this.email = replacementEmail;
        this.phone = null;
        this.passwordHash = "GDPR_DELETED";
        this.active = false;
        this.emailVerified = false;
        this.mfaEnabled = false;
        this.mfaSecret = null;
        this.passwordResetTokenHash = null;
        this.passwordResetTokenExpiresAt = null;
        this.emailVerificationTokenHash = null;
        this.emailVerificationTokenExpiresAt = null;
        this.googleSubject = null;
        this.deletedAt = Instant.now();
    }
}
