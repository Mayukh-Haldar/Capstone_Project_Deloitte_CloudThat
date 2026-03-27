package com.eventzen.event.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "events")
public class Event extends BaseEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID organizerId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private EventCategory category;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 80)
    private String eventType;

    @Column(nullable = false, length = 4000)
    private String description;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String bannerImageUrl;

    @Column(nullable = false)
    private OffsetDateTime startTime;

    @Column(nullable = false)
    private OffsetDateTime endTime;

    @Column(nullable = false)
    private Integer expectedAttendees;

    @Column(nullable = false)
    private Integer capacity;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal estimatedBudget;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EventStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecurrenceRule recurrenceRule = RecurrenceRule.NONE;

    @Column(length = 36)
    private String venueId;

    @Column(length = 200)
    private String venueName;

    @Column(length = 120)
    private String venueCity;

    @Column(length = 36)
    private String venueBookingId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "event_tags", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "tag_name", nullable = false, length = 60)
    private Set<String> tags = new LinkedHashSet<>();

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("startTime ASC")
    private List<EventSession> sessions;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<EventAgendaItem> agendaItems;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOrganizerId() {
        return organizerId;
    }

    public void setOrganizerId(UUID organizerId) {
        this.organizerId = organizerId;
    }

    public EventCategory getCategory() {
        return category;
    }

    public void setCategory(EventCategory category) {
        this.category = category;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getBannerImageUrl() {
        return bannerImageUrl;
    }

    public void setBannerImageUrl(String bannerImageUrl) {
        this.bannerImageUrl = bannerImageUrl;
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

    public Integer getExpectedAttendees() {
        return expectedAttendees;
    }

    public void setExpectedAttendees(Integer expectedAttendees) {
        this.expectedAttendees = expectedAttendees;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public BigDecimal getEstimatedBudget() {
        return estimatedBudget;
    }

    public void setEstimatedBudget(BigDecimal estimatedBudget) {
        this.estimatedBudget = estimatedBudget;
    }

    public EventStatus getStatus() {
        return status;
    }

    public void setStatus(EventStatus status) {
        this.status = status;
    }

    public RecurrenceRule getRecurrenceRule() {
        return recurrenceRule;
    }

    public void setRecurrenceRule(RecurrenceRule recurrenceRule) {
        this.recurrenceRule = recurrenceRule;
    }

    public String getVenueId() {
        return venueId;
    }

    public void setVenueId(String venueId) {
        this.venueId = venueId;
    }

    public String getVenueName() {
        return venueName;
    }

    public void setVenueName(String venueName) {
        this.venueName = venueName;
    }

    public String getVenueCity() {
        return venueCity;
    }

    public void setVenueCity(String venueCity) {
        this.venueCity = venueCity;
    }

    public String getVenueBookingId() {
        return venueBookingId;
    }

    public void setVenueBookingId(String venueBookingId) {
        this.venueBookingId = venueBookingId;
    }

    public Set<String> getTags() {
        return tags;
    }

    public void setTags(Set<String> tags) {
        this.tags = tags;
    }

    public List<EventSession> getSessions() {
        return sessions;
    }

    public void setSessions(List<EventSession> sessions) {
        this.sessions = sessions;
    }

    public List<EventAgendaItem> getAgendaItems() {
        return agendaItems;
    }

    public void setAgendaItems(List<EventAgendaItem> agendaItems) {
        this.agendaItems = agendaItems;
    }
}
