import { useEffect, useState } from "react";
const AUTH_STORAGE_KEY = "eventzen.auth.session.v1";
const AUTH_CHANGE_EVENT = "eventzen-auth-change";
const PROFILE_PHOTO_STORAGE_KEY = "eventzen.profile.photos.v1";
const getStoredProfilePhotos = () => {
    if (typeof window === "undefined") {
        return {};
    }
    const raw = window.localStorage.getItem(PROFILE_PHOTO_STORAGE_KEY);
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        window.localStorage.removeItem(PROFILE_PHOTO_STORAGE_KEY);
        return {};
    }
};
const setStoredProfilePhotos = (photos) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, JSON.stringify(photos));
};
const hydrateProfilePhoto = (user) => {
    const storedPhotos = getStoredProfilePhotos();
    const storedPhoto = storedPhotos[user.id];
    return {
        ...user,
        profilePhotoUrl: user.profilePhotoUrl ?? storedPhoto ?? null
    };
};
const broadcastAuthChange = () => {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};
export const getAuthSession = () => {
    if (typeof window === "undefined") {
        return null;
    }
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
        return null;
    }
    try {
        const session = JSON.parse(raw);
        return {
            ...session,
            user: hydrateProfilePhoto(session.user)
        };
    }
    catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
};
export const setAuthSession = (session) => {
    if (typeof window === "undefined") {
        return;
    }
    const expiresAt = new Date(Date.now() + session.expiresInSeconds * 1000).toISOString();
    const payload = { ...session, expiresAt, user: hydrateProfilePhoto(session.user) };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    broadcastAuthChange();
};
export const updateAuthSessionUser = (user) => {
    if (typeof window === "undefined") {
        return;
    }
    const session = getAuthSession();
    if (!session) {
        return;
    }
    const payload = {
        ...session,
        user: hydrateProfilePhoto(user)
    };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    broadcastAuthChange();
};
export const updateAuthSessionProfilePhoto = (photoUrl) => {
    if (typeof window === "undefined") {
        return;
    }
    const session = getAuthSession();
    if (!session) {
        return;
    }
    const photos = getStoredProfilePhotos();
    if (photoUrl) {
        photos[session.user.id] = photoUrl;
    }
    else {
        delete photos[session.user.id];
    }
    setStoredProfilePhotos(photos);
    const payload = {
        ...session,
        user: {
            ...session.user,
            profilePhotoUrl: photoUrl
        }
    };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    broadcastAuthChange();
};
export const clearAuthSession = () => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    broadcastAuthChange();
};
export const useAuthSession = () => {
    const [session, setSession] = useState(() => getAuthSession());
    useEffect(() => {
        const refreshSession = () => setSession(getAuthSession());
        window.addEventListener(AUTH_CHANGE_EVENT, refreshSession);
        window.addEventListener("storage", refreshSession);
        return () => {
            window.removeEventListener(AUTH_CHANGE_EVENT, refreshSession);
            window.removeEventListener("storage", refreshSession);
        };
    }, []);
    return session;
};
