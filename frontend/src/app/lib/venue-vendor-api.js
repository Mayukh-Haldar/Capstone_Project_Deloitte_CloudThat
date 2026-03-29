import { venueVendorApiPath } from "./api-config";
import { request } from "./http-client";
export const venueVendorApi = {
    async listVenues(params) {
        const query = new URLSearchParams();
        if (params?.city)
            query.set("city", params.city);
        if (params?.minCapacity)
            query.set("minCapacity", String(params.minCapacity));
        if (params?.page)
            query.set("page", String(params.page));
        if (params?.limit)
            query.set("limit", String(params.limit));
        const url = `${venueVendorApiPath("/venues")}${query.size ? `?${query.toString()}` : ""}`;
        const response = await request({ url });
        return response.data;
    },
    async createVenue(payload) {
        const response = await request({
            url: venueVendorApiPath("/venues"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async checkAvailability(venueId, payload) {
        const query = new URLSearchParams({
            start: payload.start,
            end: payload.end
        });
        if (payload.hallIds?.length) {
            query.set("hallIds", payload.hallIds.join(","));
        }
        const response = await request({
            url: `${venueVendorApiPath(`/venues/${venueId}/availability`)}?${query.toString()}`,
            auth: true
        });
        return response.data;
    },
    async createBooking(venueId, payload) {
        const response = await request({
            url: venueVendorApiPath(`/venues/${venueId}/book`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async listBookings(params) {
        const query = new URLSearchParams();
        if (params?.venueId)
            query.set("venueId", params.venueId);
        if (params?.eventId)
            query.set("eventId", params.eventId);
        if (params?.bookingStatus)
            query.set("bookingStatus", params.bookingStatus);
        if (typeof params?.upcomingOnly === "boolean")
            query.set("upcomingOnly", String(params.upcomingOnly));
        if (params?.page)
            query.set("page", String(params.page));
        if (params?.limit)
            query.set("limit", String(params.limit));
        const response = await request({
            url: `${venueVendorApiPath("/venues/bookings")}${query.size ? `?${query.toString()}` : ""}`,
            auth: true
        });
        return response.data;
    },
    async confirmVenueBookingPayment(bookingId, payload) {
        const response = await request({
            url: venueVendorApiPath(`/venues/internal/bookings/${bookingId}/confirm-payment`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async cancelBooking(bookingId, payload) {
        const response = await request({
            url: venueVendorApiPath(`/venues/bookings/${bookingId}/cancel`),
            method: "POST",
            body: payload || {},
            auth: true
        });
        return response.data;
    },
    async deleteBooking(bookingId) {
        const response = await request({
            url: venueVendorApiPath(`/venues/bookings/${bookingId}`),
            method: "DELETE",
            auth: true
        });
        return response.data;
    },
    async listVendors(params) {
        const query = new URLSearchParams();
        if (params?.serviceType)
            query.set("serviceType", params.serviceType);
        if (typeof params?.minRating === "number")
            query.set("minRating", String(params.minRating));
        if (params?.page)
            query.set("page", String(params.page));
        if (params?.limit)
            query.set("limit", String(params.limit));
        const response = await request({
            url: `${venueVendorApiPath("/vendors")}${query.size ? `?${query.toString()}` : ""}`,
            auth: true
        });
        return response.data;
    },
    async createVendor(payload) {
        const response = await request({
            url: venueVendorApiPath("/vendors"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async addVendorReview(vendorId, payload) {
        const response = await request({
            url: venueVendorApiPath(`/vendors/${vendorId}/reviews`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async getVendorEventIds(vendorId) {
        const response = await request({
            url: venueVendorApiPath(`/vendors/${vendorId}/events`),
            auth: true
        });
        return response.data.eventIds;
    }
};
