const { startTelemetry } = require("./observability/telemetry");
const env = require("./config/env");
const { connectDatabase } = require("./config/database");
const { app } = require("./app");
const { seedSampleCatalog } = require("./seeds/seedSampleCatalog");

const start = async () => {
  try {
    const telemetry = startTelemetry(env.appName);
    await connectDatabase(env.mongoUri);
    await seedSampleCatalog();
    const server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`${env.appName} is running on port ${env.port}`);
    });
    const shutdown = async () => {
      await telemetry.shutdown();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start service", error);
    process.exit(1);
  }
};

start();
