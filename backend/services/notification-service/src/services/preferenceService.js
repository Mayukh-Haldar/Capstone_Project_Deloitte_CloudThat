const { NotificationPreference } = require("../models/NotificationPreference");

const defaultPreference = () => ({
  email: { enabled: true, eventTypes: [] },
  push: { enabled: true, eventTypes: [] },
  inApp: { enabled: true, eventTypes: [] },
  webhook: { enabled: true, eventTypes: [] }
});

const getPreferences = async (userId) => {
  const existing = await NotificationPreference.findOne({ userId }).lean();
  if (existing) {
    return existing;
  }

  return NotificationPreference.create({
    userId,
    ...defaultPreference()
  });
};

const updatePreferences = async (userId, payload) => {
  // Exclude from $setOnInsert any keys already present in $set payload to avoid
  // MongoDB "Updating the path would create a conflict" error.
  const insertOnlyDefaults = Object.fromEntries(
    Object.entries(defaultPreference()).filter(([key]) => !(key in payload))
  );

  await NotificationPreference.updateOne(
    { userId },
    { $set: payload, $setOnInsert: { userId, ...insertOnlyDefaults } },
    { upsert: true }
  );

  return getPreferences(userId);
};

const isChannelEnabled = (preferences, channel, eventType) => {
  const keyMap = {
    EMAIL: "email",
    PUSH: "push",
    IN_APP: "inApp",
    WEBHOOK: "webhook"
  };

  const config = preferences?.[keyMap[channel]];
  if (!config) {
    return true;
  }

  if (config.enabled === false) {
    return false;
  }

  if (!Array.isArray(config.eventTypes) || config.eventTypes.length === 0) {
    return true;
  }

  return config.eventTypes.includes(eventType);
};

module.exports = { getPreferences, updatePreferences, isChannelEnabled };
