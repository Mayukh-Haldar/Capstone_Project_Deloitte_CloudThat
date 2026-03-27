import { financeApiPath } from "./api-config";
import { getAuthSession } from "./auth-storage";
import { ApiClientError, refreshAuthSession, request } from "./http-client";
export const financeApi = {
    getInvoiceDownloadUrl(paymentId) {
        return financeApiPath(`/payments/${paymentId}/invoice`);
    },
    async downloadInvoice(paymentId, fileName) {
        const download = async (retryOnUnauthorized = true) => {
            const session = getAuthSession();
            const headers = {};
            const isLocalDevelopment = typeof window !== "undefined" &&
                (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
            if (session?.accessToken) {
                headers.Authorization = `Bearer ${session.accessToken}`;
            }
            if (session?.user && isLocalDevelopment) {
                headers["x-user-id"] = session.user.id;
                headers["x-user-email"] = session.user.email;
                headers["x-user-roles"] = session.user.roles.join(",");
            }
            const response = await fetch(financeApiPath(`/payments/${paymentId}/invoice`), {
                method: "GET",
                headers
            });
            if (!response.ok) {
                if (retryOnUnauthorized && response.status === 401) {
                    const refreshed = await refreshAuthSession();
                    if (refreshed?.accessToken) {
                        return download(false);
                    }
                }
                let errorBody = null;
                try {
                    errorBody = await response.json();
                }
                catch {
                    errorBody = null;
                }
                throw new ApiClientError(errorBody?.message || "Unable to download invoice.", response.status, errorBody?.code, errorBody?.details);
            }
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = fileName || `invoice-${paymentId}.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        };
        await download();
    },
    async createBudget(eventId, payload) {
        const response = await request({
            url: financeApiPath(`/events/${eventId}/budget`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async getBudget(eventId) {
        const response = await request({
            url: financeApiPath(`/events/${eventId}/budget`),
            auth: true
        });
        return response.data;
    },
    async approveBudget(budgetId, approvedTotal) {
        const response = await request({
            url: financeApiPath(`/budgets/${budgetId}/approve`),
            method: "PUT",
            body: { approvedTotal },
            auth: true
        });
        return response.data;
    },
    async addBudgetItem(budgetId, payload) {
        const response = await request({
            url: financeApiPath(`/budgets/${budgetId}/items`),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async logExpense(payload) {
        const response = await request({
            url: financeApiPath("/expenses"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async getFinancialReport(eventId) {
        const response = await request({
            url: financeApiPath(`/events/${eventId}/reports/financial`),
            auth: true
        });
        return response.data;
    },
    async initiatePayment(payload) {
        const response = await request({
            url: financeApiPath("/payments"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async verifyPayment(payload) {
        const response = await request({
            url: financeApiPath("/payments/verify"),
            method: "POST",
            body: payload,
            auth: true
        });
        return response.data;
    },
    async listMyPayments() {
        const response = await request({
            url: financeApiPath("/payments/me"),
            auth: true
        });
        return response.data || [];
    }
};
