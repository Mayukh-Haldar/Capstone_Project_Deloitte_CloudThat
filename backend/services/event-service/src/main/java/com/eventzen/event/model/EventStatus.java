package com.eventzen.event.model;

public enum EventStatus {
    DRAFT,
    PUBLISHED,
    REGISTRATION_OPEN,
    REGISTRATION_CLOSED,
    ONGOING,
    COMPLETED,
    ARCHIVED;

    public boolean canTransitionTo(EventStatus next) {
        return next != null && next != this;
    }
}
