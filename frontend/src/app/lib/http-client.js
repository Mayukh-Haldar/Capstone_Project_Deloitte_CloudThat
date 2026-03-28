import { authApiPath } from "./api-config";
import { clearAuthSession, getAuthSession, setAuthSession } from "./auth-storage";
export class ApiClientError extends Error {
    constructor(message, status, code, details) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
const parseResponse = async (response) => {
    if (response.status === 204) {
        return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return null;
    }
    return response.json();
};
const createRequestHeaders = (headers, body, auth, session) => {
    const mergedHeaders = { ...headers };
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const isLocalDevelopment = typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (body !== undefined && !isFormData) {
        mergedHeaders["Content-Type"] = "application/json";
    }
    if (auth && session?.accessToken) {
        mergedHeaders.Authorization = `Bearer ${session.accessToken}`;
    }
    if (auth && session?.user && isLocalDevelopment) {
        mergedHeaders["x-user-id"] = session.user.id;
        mergedHeaders["x-user-email"] = session.user.email;
        mergedHeaders["x-user-roles"] = session.user.roles.join(",");
    }
    return { mergedHeaders, isFormData };
};
let refreshSessionPromise = null;
export const refreshAuthSession = async () => {
    if (refreshSessionPromise) {
        return refreshSessionPromise;
    }
    refreshSessionPromise = (async () => {
        const session = getAuthSession();
        if (!session?.refreshToken) {
            return null;
        }
        const response = await fetch(authApiPath("/auth/refresh"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: session.refreshToken })
        });
        if (!response.ok) {
            clearAuthSession();
            return null;
        }
        const payload = (await response.json());
        setAuthSession(payload);
        return getAuthSession();
    })();
    try {
        return await refreshSessionPromise;
    }
    finally {
        refreshSessionPromise = null;
    }
};
const shouldRetryAfterRefresh = (status, errorBody) => {
    if (status === 401) {
        return true;
    }
    if (status !== 403) {
        return false;
    }
    const message = (errorBody?.message || errorBody?.error || "").toLowerCase();
    return (errorBody?.code === "AUTH-403" ||
        errorBody?.code === "AUTH-1002" ||
        message.includes("insufficient permissions"));
};
const sendRequest = async ({ url, method = "GET", body, headers = {}, auth = false, retryOnUnauthorized = true }) => {
    const session = getAuthSession();
    const { mergedHeaders, isFormData } = createRequestHeaders(headers, body, auth, session);
    const response = await fetch(url, {
        method,
        headers: mergedHeaders,
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
    });
    if (!response.ok) {
        const errorBody = await parseResponse(response);
        if (auth && retryOnUnauthorized && shouldRetryAfterRefresh(response.status, errorBody)) {
            const refreshed = await refreshAuthSession();
            if (refreshed?.accessToken) {
                return sendRequest({
                    url,
                    method,
                    body,
                    headers,
                    auth,
                    retryOnUnauthorized: false
                });
            }
        }
        if (auth && response.status === 403 && errorBody?.code === "AUTH-1002" && (errorBody?.message || "").toLowerCase().includes("inactive")) {
            clearAuthSession();
        }
        const errorMessage = errorBody?.message || errorBody?.error || "Request failed";
        throw new ApiClientError(errorMessage, response.status, errorBody?.code, errorBody?.details);
    }
    return response;
};
export const request = async (options) => {
    const response = await sendRequest(options);
    const data = await parseResponse(response);
    return { data, headers: response.headers };
};
export const requestBlob = async (options) => {
    const response = await sendRequest(options);
    return { data: await response.blob(), headers: response.headers };
};
