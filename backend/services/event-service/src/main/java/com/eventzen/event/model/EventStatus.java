package com.eventzen.event.model;

public enum EventStatus {
    PENDING_APPROVAL,
    DRAFT,
    PUBLISHED,
    REGISTRATION_OPEN,
    REGISTRATION_CLOSED,
    ONGOING,
    COMPLETED,
    ARCHIVED,
    DISABLED_BY_VENDOR,
    DISABLED_BY_ADMIN;

    public boolean isDisabled() {
        return this == DISABLED_BY_VENDOR || this == DISABLED_BY_ADMIN;
    }

    public boolean canTransitionTo(EventStatus next) {
        return next != null && next != this;
    }
}
