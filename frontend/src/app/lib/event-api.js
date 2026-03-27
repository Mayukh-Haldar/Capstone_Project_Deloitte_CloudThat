import { eventApiPath } from "./api-config";
import { request } from "./http-client";
export const getEventStatusLabel = (status) => {
    switch (status) {
        case "DRAFT":
            return "Draft Event";
        case "PUBLISHED":
            return "Published Event";
        case "REGISTRATION_OPEN":
            return "Registration Open";
        case "REGISTRATION_CLOSED":
            return "Registrations Closed";
        case "ONGOING":
            return "Ongoing Event";
        case "COMPLETED":
            return "Completed Event";
        case "ARCHIVED":
            return "Archived Event";
        default:
            return String(status).split("_").join(" ");
    }
};
export const isRegistrationOpen = (status) => status === "REGISTRATION_OPEN";
export const isPubliclyDiscoverableEvent = (status) => status === "PUBLISHED" || status === "REGISTRATION_OPEN" || status === "REGISTRATION_CLOSED" || status === "ONGOING" || status === "COMPLETED";
export const eventApi = {
    async listCategories() {
        const response = await request({ url: eventApiPath("/categories") });
        return (response.data || []);
    },
    async listEvents(params) {
        const query = new URLSearchParams();
        if (params?.q)
            query.set("q", params.q);
        if (params?.category)
            query.set("category", params.category);
        if (params?.city)
            query.set("city", params.city);
        if (params?.status)
            query.set("status", params.status);
        if (params?.organizerId)
            query.set("organizerId", params.organizerId);
        query.set("page", String(params?.page ?? 0));
        query.set("size", String(params?.size ?? 12));
        const response = await request({
            url: `${eventApiPath("/events")}?${query.toString()}`
        });
        return response.data;
    },
    async getEvent(eventId) {
        const response = await request({ url: eventApiPath(`/events/${eventId}`) });
        return response.data;
    },
    async createEvent(payload) {
        const response = await request({
            url: eventApiPath("/events"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async updateEvent(eventId, payload) {
        const response = await request({
            url: eventApiPath(`/events/${eventId}`),
            method: "PUT",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async deleteEvent(eventId) {
        await request({
            url: eventApiPath(`/events/${eventId}`),
            method: "DELETE",
            auth: true
        });
    },
    async uploadBannerImage(file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await request({
            url: eventApiPath("/events/uploads/banner-image"),
            method: "POST",
            body: formData,
            auth: true
        });
        return response.data;
    },
    async uploadSpeakerPhoto(file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await request({
            url: eventApiPath("/events/uploads/speaker-photo"),
            method: "POST",
            body: formData,
            auth: true
        });
        return response.data;
    },
    async addSession(eventId, payload) {
        const response = await request({
            url: eventApiPath(`/events/${eventId}/sessions`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async updateSession(eventId, sessionId, payload) {
        const response = await request({
            url: eventApiPath(`/events/${eventId}/sessions/${sessionId}`),
            method: "PUT",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async deleteSession(eventId, sessionId) {
        await request({
            url: eventApiPath(`/events/${eventId}/sessions/${sessionId}`),
            method: "DELETE",
            auth: true
        });
    },
    async transitionStatus(eventId, status) {
        const response = await request({
            url: eventApiPath(`/events/${eventId}/status`),
            method: "PATCH",
            body: { status },
            auth: true
        });
        return response.data;
    }
};
