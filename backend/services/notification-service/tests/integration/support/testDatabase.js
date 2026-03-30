const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const DEFAULT_BASE_URI = "mongodb://localhost:27018";

const buildExternalUri = (suiteName) => {
  const baseUri = process.env.TEST_MONGO_BASE_URI || DEFAULT_BASE_URI;
  const separator = baseUri.includes("?") ? "&" : "/";
  if (baseUri.includes("?")) {
    return `${baseUri}${separator}dbName=eventzen_notifications_test_${suiteName}`;
  }
  return `${baseUri.replace(/\/$/, "")}/eventzen_notifications_test_${suiteName}`;
};

const connectTestDatabase = async (suiteName, { seedDefaultTemplates = false } = {}) => {
  process.env.NODE_ENV = "test";
  process.env.SEED_DEFAULT_TEMPLATES = String(seedDefaultTemplates);

  const state = {
    suiteName,
    mongoServer: null,
    uri: buildExternalUri(suiteName)
  };

  try {
    process.env.MONGO_URI = state.uri;
    await mongoose.connect(state.uri);
    await mongoose.connection.db.dropDatabase();
    return state;
  } catch (externalError) {
    state.mongoServer = await MongoMemoryServer.create();
    state.uri = state.mongoServer.getUri();
    process.env.MONGO_URI = state.uri;
    await mongoose.connect(state.uri);
    return state;
  }
};

const disconnectTestDatabase = async (state) => {
  await mongoose.connection.close();
  if (state?.mongoServer) {
    await state.mongoServer.stop();
  }
};

module.exports = {
  connectTestDatabase,
  disconnectTestDatabase
};
