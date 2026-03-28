import { ticketingApiPath } from "./api-config";
import { request, requestBlob } from "./http-client";
export const ticketingApi = {
    async listTicketTypes(eventId) {
        const response = await request({
            url: `${ticketingApiPath("/ticket-types")}?eventId=${encodeURIComponent(eventId)}`
        });
        return (response.data || []);
    },
    async createTicketType(eventId, payload) {
        const response = await request({
            url: ticketingApiPath(`/events/${eventId}/ticket-types`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async updateTicketType(eventId, ticketTypeId, payload) {
        const response = await request({
            url: ticketingApiPath(`/events/${eventId}/ticket-types/${encodeURIComponent(ticketTypeId)}`),
            method: "PUT",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async deleteTicketType(eventId, ticketTypeId) {
        await request({
            url: ticketingApiPath(`/events/${eventId}/ticket-types/${encodeURIComponent(ticketTypeId)}`),
            method: "DELETE",
            auth: true
        });
    },
    async createRegistration(payload, idempotencyKey) {
        const response = await request({
            url: ticketingApiPath("/registrations"),
            method: "POST",
            body: payload,
            auth: true,
            headers: { "Idempotency-Key": idempotencyKey }
        });
        return response.data;
    },
    async listMyRegistrations() {
        const response = await request({
            url: ticketingApiPath("/registrations/me"),
            auth: true
        });
        return (response.data || []);
    },
    async downloadRegistrationTicketPass(registrationId) {
        return requestBlob({
            url: ticketingApiPath(`/registrations/${registrationId}/ticket-pass`),
            auth: true
        });
    },
    async cancelRegistration(registrationId, reason) {
        const body = reason ? { cancellationReason: reason } : undefined;
        await request({
            url: ticketingApiPath(`/registrations/${registrationId}`),
            method: "DELETE",
            auth: true,
            body
        });
    },
    async joinWaitlist(eventId, payload) {
        const response = await request({
            url: ticketingApiPath(`/events/${eventId}/waitlist`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async getCheckInStats(eventId) {
        const response = await request({
            url: ticketingApiPath(`/events/${eventId}/checkin/stats`),
            auth: true
        });
        return response.data;
    },
    async scanCheckIn(payload) {
        const response = await request({
            url: ticketingApiPath("/checkin/scan"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async getSeatMap(ticketTypeId, eventId) {
        const response = await request({
            url: `${ticketingApiPath(`/ticket-types/${encodeURIComponent(ticketTypeId)}/seat-map`)}?eventId=${encodeURIComponent(eventId)}`
        });
        return response.data;
    },
    async reserveSeat(ticketTypeId, eventId, seatRow, seatColumn) {
        const response = await request({
            url: `${ticketingApiPath(`/ticket-types/${encodeURIComponent(ticketTypeId)}/seats/reserve`)}?eventId=${encodeURIComponent(eventId)}`,
            method: "POST",
            body: { seatRow, seatColumn },
            auth: true
        });
        return response.data;
    },
    async cancelReservation(ticketTypeId, reservationId) {
        await request({
            url: ticketingApiPath(`/ticket-types/${encodeURIComponent(ticketTypeId)}/seats/reserve/${encodeURIComponent(reservationId)}`),
            method: "DELETE",
            auth: true
        });
    }
};
