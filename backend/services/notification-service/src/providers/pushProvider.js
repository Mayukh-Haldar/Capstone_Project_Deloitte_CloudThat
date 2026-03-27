const admin = require("firebase-admin");
const env = require("../config/env");

let app = null;

const isPushConfigured = () =>
  Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey);

const getFirebaseApp = () => {
  if (!isPushConfigured()) {
    return null;
  }

  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey
      })
    });
  }

  return app;
};

const sendPush = async ({ token, title, body, data = {} }) => {
  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    return {
      provider: "MockPushProvider",
      status: "SUCCESS",
      responseCode: "202",
      responseMessage: `Firebase not configured. Mock push accepted for token ${token ? "present" : "missing"}`,
      externalId: `mock-push-${Date.now()}`,
      metadata: { title, mock: true }
    };
  }

  const messageId = await admin.messaging(firebaseApp).send({
    token,
    notification: {
      title,
      body
    },
    webpush: {
      notification: {
        title,
        body
      }
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)])
    )
  });

  return {
    provider: "FirebaseAdmin",
    status: "SUCCESS",
    responseCode: "200",
    responseMessage: "Push notification sent via FCM",
    externalId: messageId,
    metadata: {}
  };
};

module.exports = { sendPush, isPushConfigured };
