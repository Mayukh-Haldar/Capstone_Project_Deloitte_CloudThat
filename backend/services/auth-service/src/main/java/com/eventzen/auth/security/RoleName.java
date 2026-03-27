package com.eventzen.auth.security;

public enum RoleName {
    ADMIN("Platform administrator with full access"),
    ORGANIZER("Event organizer with event and finance access"),
    VENDOR("Vendor account with limited event visibility"),
    ATTENDEE("Customer account for registration and ticketing");

    private final String description;

    RoleName(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
