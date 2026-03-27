const { PushToken } = require("../models/PushToken");

const registerPushToken = async ({ userId, token, platform, userAgent }) => {
  await PushToken.updateOne(
    { token },
    {
      $set: {
        userId,
        token,
        platform,
        userAgent,
        isActive: true,
        lastSeenAt: new Date()
      }
    },
    { upsert: true }
  );

  return PushToken.findOne({ token }).lean();
};

const deactivatePushToken = async ({ userId, token }) => {
  await PushToken.updateOne(
    { userId, token },
    {
      $set: {
        isActive: false,
        lastSeenAt: new Date()
      }
    }
  );
};

const listActivePushTokens = async (userId) =>
  PushToken.find({ userId, isActive: true }).sort({ updatedAt: -1 }).lean();

module.exports = { registerPushToken, deactivatePushToken, listActivePushTokens };
