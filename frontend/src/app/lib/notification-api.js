import { notificationApiPath } from "./api-config";
import { request } from "./http-client";
const get = async (path) => {
    const response = await request({
        url: notificationApiPath(path),
        auth: true
    });
    return response.data;
};
export const notificationApi = {
    async list(params) {
        const search = new URLSearchParams();
        if (params?.page !== undefined)
            search.set("page", String(params.page));
        if (params?.size !== undefined)
            search.set("size", String(params.size));
        if (params?.unreadOnly)
            search.set("unreadOnly", "true");
        if (params?.channel)
            search.set("channel", params.channel);
        const suffix = search.toString() ? `?${search.toString()}` : "";
        return get(`/notifications${suffix}`);
    },
    async markRead(id, read = true) {
        const response = await request({
            url: notificationApiPath(`/notifications/${id}/read`),
            method: "PATCH",
            body: { read },
            auth: true
        });
        return response.data;
    },
    async remove(id) {
        await request({
            url: notificationApiPath(`/notifications/${id}`),
            method: "DELETE",
            auth: true
        });
    },
    async getById(id) {
        return get(`/notifications/${id}`);
    },
    async getPreferences() {
        return get("/notifications/preferences");
    },
    async updatePreferences(payload) {
        const response = await request({
            url: notificationApiPath("/notifications/preferences"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async listPushTokens() {
        return get("/notifications/push-tokens");
    },
    async registerPushToken(token, platform = "web") {
        const response = await request({
            url: notificationApiPath("/notifications/push-tokens"),
            method: "POST",
            body: { token, platform },
            auth: true
        });
        return response.data;
    },
    async removePushToken(token, platform = "web") {
        await request({
            url: notificationApiPath("/notifications/push-tokens"),
            method: "DELETE",
            body: { token, platform },
            auth: true
        });
    },
    async subscribeNewsletter(email) {
        const response = await request({
            url: notificationApiPath("/notifications/newsletter/subscribe"),
            method: "POST",
            body: { email },
            auth: false
        });
        return response.data;
    }
};
