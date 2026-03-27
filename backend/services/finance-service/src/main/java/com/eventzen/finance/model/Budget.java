package com.eventzen.finance.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "budgets")
public class Budget {

    @Id
    @Column(name = "budget_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "event_id", nullable = false, unique = true)
    private UUID eventId;

    @Column(name = "event_name", nullable = false, length = 180)
    private String eventName;

    @Column(nullable = false, length = 12)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BudgetStatus status;

    @Column(name = "estimated_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal estimatedTotal;

    @Column(name = "approved_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal approvedTotal;

    @Column(name = "actual_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal actualTotal;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "approved_by_user_id")
    private UUID approvedByUserId;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @OneToMany(mappedBy = "budget", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("title ASC")
    private List<BudgetItem> items = new ArrayList<>();

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public void addItem(BudgetItem item) {
        items.add(item);
        item.setBudget(this);
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getEventId() {
        return eventId;
    }

    public void setEventId(UUID eventId) {
        this.eventId = eventId;
    }

    public String getEventName() {
        return eventName;
    }

    public void setEventName(String eventName) {
        this.eventName = eventName;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public BudgetStatus getStatus() {
        return status;
    }

    public void setStatus(BudgetStatus status) {
        this.status = status;
    }

    public BigDecimal getEstimatedTotal() {
        return estimatedTotal;
    }

    public void setEstimatedTotal(BigDecimal estimatedTotal) {
        this.estimatedTotal = estimatedTotal;
    }

    public BigDecimal getApprovedTotal() {
        return approvedTotal;
    }

    public void setApprovedTotal(BigDecimal approvedTotal) {
        this.approvedTotal = approvedTotal;
    }

    public BigDecimal getActualTotal() {
        return actualTotal;
    }

    public void setActualTotal(BigDecimal actualTotal) {
        this.actualTotal = actualTotal;
    }

    public UUID getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(UUID createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public UUID getApprovedByUserId() {
        return approvedByUserId;
    }

    public void setApprovedByUserId(UUID approvedByUserId) {
        this.approvedByUserId = approvedByUserId;
    }

    public OffsetDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(OffsetDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public List<BudgetItem> getItems() {
        return items;
    }
}
