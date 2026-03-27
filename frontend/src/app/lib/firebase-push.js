import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { FIREBASE_API_KEY, FIREBASE_APP_ID, FIREBASE_AUTH_DOMAIN, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_VAPID_KEY } from "./api-config";
const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID
};
const isConfigured = () => Boolean(FIREBASE_API_KEY &&
    FIREBASE_PROJECT_ID &&
    FIREBASE_MESSAGING_SENDER_ID &&
    FIREBASE_APP_ID &&
    FIREBASE_VAPID_KEY);
const buildServiceWorkerUrl = () => {
    const search = new URLSearchParams({
        apiKey: FIREBASE_API_KEY,
        authDomain: FIREBASE_AUTH_DOMAIN,
        projectId: FIREBASE_PROJECT_ID,
        storageBucket: FIREBASE_STORAGE_BUCKET,
        messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
        appId: FIREBASE_APP_ID
    });
    return `/firebase-messaging-sw.js?${search.toString()}`;
};
let appInstance = null;
const getAppInstance = () => {
    if (!appInstance) {
        appInstance = initializeApp(firebaseConfig);
    }
    return appInstance;
};
export const ensurePushToken = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
        return null;
    }
    if (!isConfigured()) {
        return null;
    }
    if (!(await isSupported())) {
        return null;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        return null;
    }
    const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl(), {
        scope: "/"
    });
    const messaging = getMessaging(getAppInstance());
    const token = await getToken(messaging, {
        vapidKey: FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
    });
    return token || null;
};
export const subscribeToForegroundPush = (onPayload) => {
    if (typeof window === "undefined" || !isConfigured()) {
        return () => { };
    }
    isSupported().then((supported) => {
        if (!supported) {
            return;
        }
        const messaging = getMessaging(getAppInstance());
        onMessage(messaging, (payload) => {
            onPayload(payload);
        });
    });
    return () => { };
};
