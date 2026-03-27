import { authApiPath } from "./api-config";
import { ApiClientError, request } from "./http-client";
const getDebugTokens = (headers) => {
    return {
        emailVerificationToken: headers.get("X-Debug-Email-Verification-Token") || undefined,
        passwordResetToken: headers.get("X-Debug-Password-Reset-Token") || undefined
    };
};
export const authApi = {
    async register(payload) {
        const response = await request({
            url: authApiPath("/auth/register"),
            method: "POST",
            body: payload
        });
        return {
            data: response.data,
            debugTokens: getDebugTokens(response.headers)
        };
    },
    async login(payload) {
        const response = await request({
            url: authApiPath("/auth/login"),
            method: "POST",
            body: payload
        });
        return response.data;
    },
    async googleLogin(payload) {
        const response = await request({
            url: authApiPath("/auth/google/login"),
            method: "POST",
            body: payload
        });
        return response.data;
    },
    async me() {
        const response = await request({
            url: authApiPath("/auth/me"),
            auth: true
        });
        return response.data;
    },
    async updateProfile(payload) {
        const response = await request({
            url: authApiPath("/auth/me/profile"),
            method: "PATCH",
            body: payload,
            auth: true
        });
        return {
            user: response.data,
            debugTokens: getDebugTokens(response.headers)
        };
    },
    async logout(refreshToken) {
        try {
            await request({
                url: authApiPath("/auth/logout"),
                method: "POST",
                body: { refreshToken },
                auth: true
            });
        }
        catch (error) {
            if (error instanceof ApiClientError && error.status === 404) {
                return;
            }
            throw error;
        }
    },
    async setupMfa() {
        const response = await request({
            url: authApiPath("/auth/mfa/setup"),
            method: "POST",
            auth: true
        });
        return response.data;
    },
    async verifyMfa(code) {
        const response = await request({
            url: authApiPath("/auth/mfa/verify"),
            method: "POST",
            body: { code },
            auth: true
        });
        return response.data;
    },
    async resendEmailVerification(email) {
        const response = await request({
            url: authApiPath("/auth/email-verification/resend"),
            method: "POST",
            body: { email }
        });
        return {
            message: response.data?.message || "Verification email requested",
            debugTokens: getDebugTokens(response.headers)
        };
    },
    async confirmEmailVerification(token) {
        const response = await request({
            url: authApiPath("/auth/email-verification/confirm"),
            method: "POST",
            body: { token }
        });
        return response.data;
    },
    async forgotPassword(email) {
        const response = await request({
            url: authApiPath("/auth/forgot-password"),
            method: "POST",
            body: { email }
        });
        return {
            message: response.data?.message || "Password reset requested",
            debugTokens: getDebugTokens(response.headers)
        };
    },
    async resetPassword(token, newPassword) {
        const response = await request({
            url: authApiPath("/auth/reset-password"),
            method: "POST",
            body: { token, newPassword }
        });
        return response.data;
    },
    async listUsers(page = 0, size = 50) {
        const response = await request({
            url: authApiPath(`/users?page=${page}&size=${size}`),
            auth: true
        });
        return response.data;
    },
    async assignRoles(userId, roles) {
        const response = await request({
            url: authApiPath(`/users/${userId}/roles`),
            method: "PUT",
            body: { roles },
            auth: true
        });
        return response.data;
    },
    async deactivateUser(userId) {
        const response = await request({
            url: authApiPath(`/users/${userId}`),
            method: "DELETE",
            auth: true
        });
        return response.data;
    },
    async reactivateUser(userId) {
        const response = await request({
            url: authApiPath(`/users/${userId}/reactivate`),
            method: "PATCH",
            auth: true
        });
        return response.data;
    },
    async gdprDeleteUser(userId) {
        const response = await request({
            url: authApiPath(`/users/${userId}/gdpr/delete`),
            method: "DELETE",
            auth: true
        });
        return response.data;
    },
    async submitAccountRequest(type, reason) {
        const response = await request({
            url: authApiPath("/account-requests"),
            method: "POST",
            body: { type, reason },
            auth: true
        });
        return response.data;
    },
    async listMyAccountRequests() {
        const response = await request({
            url: authApiPath("/account-requests/me"),
            auth: true
        });
        return (response.data || []);
    },
    async cancelAccountRequest(requestId) {
        const response = await request({
            url: authApiPath(`/account-requests/${requestId}`),
            method: "DELETE",
            auth: true
        });
        return response.data;
    },
    async listAdminAccountRequests(status) {
        const suffix = status ? `?status=${status}` : "";
        const response = await request({
            url: authApiPath(`/account-requests/admin${suffix}`),
            auth: true
        });
        return (response.data || []);
    },
    async approveAccountRequest(requestId, adminComment) {
        const response = await request({
            url: authApiPath(`/account-requests/admin/${requestId}/approve`),
            method: "PATCH",
            body: { adminComment },
            auth: true
        });
        return response.data;
    },
    async rejectAccountRequest(requestId, adminComment) {
        const response = await request({
            url: authApiPath(`/account-requests/admin/${requestId}/reject`),
            method: "PATCH",
            body: { adminComment },
            auth: true
        });
        return response.data;
    },
    async requestPublicReactivation(email, reason) {
        const response = await request({
            url: authApiPath("/account-requests/public/reactivation"),
            method: "POST",
            body: { email, reason }
        });
        return response.data;
    },
    async getPublicReactivationStatus(email) {
        const response = await request({
            url: authApiPath(`/account-requests/public/reactivation/status?email=${encodeURIComponent(email)}`)
        });
        return response.data;
    }
};
