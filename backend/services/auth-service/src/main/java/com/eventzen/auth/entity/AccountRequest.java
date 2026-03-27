package com.eventzen.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_requests")
public class AccountRequest {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 32)
    private AccountRequestType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_status", nullable = false, length = 32)
    private AccountRequestStatus status = AccountRequestStatus.PENDING;

    @Column(name = "reason", length = 1000)
    private String reason;

    @Column(name = "admin_comment", length = 1000)
    private String adminComment;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public static AccountRequest submit(User user, AccountRequestType type, String reason) {
        AccountRequest request = new AccountRequest();
        request.user = user;
        request.type = type;
        request.reason = normalize(reason);
        return request;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public AccountRequestType getType() {
        return type;
    }

    public AccountRequestStatus getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public String getAdminComment() {
        return adminComment;
    }

    public UUID getReviewedBy() {
        return reviewedBy;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void approve(UUID adminUserId, String comment) {
        this.status = AccountRequestStatus.APPROVED;
        this.reviewedBy = adminUserId;
        this.reviewedAt = Instant.now();
        this.adminComment = normalize(comment);
    }

    public void reject(UUID adminUserId, String comment) {
        this.status = AccountRequestStatus.REJECTED;
        this.reviewedBy = adminUserId;
        this.reviewedAt = Instant.now();
        this.adminComment = normalize(comment);
    }

    public void cancel() {
        this.status = AccountRequestStatus.CANCELED;
        this.reviewedAt = Instant.now();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
