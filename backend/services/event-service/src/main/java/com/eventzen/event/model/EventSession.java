package com.eventzen.event.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "event_sessions")
public class EventSession extends BaseEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false, length = 160)
    private String sessionTitle;

    @Column(length = 120)
    private String speakerName;

    @Column(length = 36)
    private String speakerId;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String speakerPhotoUrl;

    @Column(length = 2000)
    private String speakerBio;

    @Column(length = 120)
    private String speakerRole;

    @Column(length = 120)
    private String speakerCompany;

    @Column(length = 120)
    private String room;

    @Column(length = 80)
    private String sessionType;

    @Column(nullable = false)
    private OffsetDateTime startTime;

    @Column(nullable = false)
    private OffsetDateTime endTime;

    @Column
    private Integer capacity;

    @Column(length = 2000)
    private String description;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Event getEvent() {
        return event;
    }

    public void setEvent(Event event) {
        this.event = event;
    }

    public String getSessionTitle() {
        return sessionTitle;
    }

    public void setSessionTitle(String sessionTitle) {
        this.sessionTitle = sessionTitle;
    }

    public String getSpeakerName() {
        return speakerName;
    }

    public void setSpeakerName(String speakerName) {
        this.speakerName = speakerName;
    }

    public String getSpeakerId() {
        return speakerId;
    }

    public void setSpeakerId(String speakerId) {
        this.speakerId = speakerId;
    }

    public String getRoom() {
        return room;
    }

    public String getSpeakerPhotoUrl() {
        return speakerPhotoUrl;
    }

    public void setSpeakerPhotoUrl(String speakerPhotoUrl) {
        this.speakerPhotoUrl = speakerPhotoUrl;
    }

    public String getSpeakerBio() {
        return speakerBio;
    }

    public void setSpeakerBio(String speakerBio) {
        this.speakerBio = speakerBio;
    }

    public String getSpeakerRole() {
        return speakerRole;
    }

    public void setSpeakerRole(String speakerRole) {
        this.speakerRole = speakerRole;
    }

    public String getSpeakerCompany() {
        return speakerCompany;
    }

    public void setSpeakerCompany(String speakerCompany) {
        this.speakerCompany = speakerCompany;
    }

    public void setRoom(String room) {
        this.room = room;
    }

    public String getSessionType() {
        return sessionType;
    }

    public void setSessionType(String sessionType) {
        this.sessionType = sessionType;
    }

    public OffsetDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(OffsetDateTime startTime) {
        this.startTime = startTime;
    }

    public OffsetDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(OffsetDateTime endTime) {
        this.endTime = endTime;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
