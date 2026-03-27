const env = require("./config/env");
const { startTelemetry } = require("./observability/telemetry");
const http = require("http");
const mongoose = require("mongoose");
const { connectDatabase } = require("./config/database");
const { createApp } = require("./app");
const { attachSocketServer } = require("./services/socketService");
const { seedDefaultTemplates } = require("./seeds/seedDefaultTemplates");
const { startKafkaConsumer } = require("./services/kafkaConsumerService");
const { startQueueWorker } = require("./services/queueService");

const startServer = async () => {
  const telemetry = startTelemetry(env.appName);
  await connectDatabase(env.mongoUri);
  await seedDefaultTemplates();

  const app = createApp();
  const server = http.createServer(app);
  const io = attachSocketServer(server);
  app.locals.io = io;

  const queueState = await startQueueWorker({ io });
  const kafkaState = await startKafkaConsumer({ io });

  server.listen(env.port, () => {
    console.log(`${env.appName} listening on port ${env.port}`);
    console.log(queueState.message);
    console.log(kafkaState.message);
  });

  const shutdown = async () => {
    await telemetry.shutdown();
    await queueState.stop();
    await kafkaState.stop();
    await mongoose.connection.close();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer().catch((error) => {
  console.error("Failed to start notification-service", error);
  process.exit(1);
});
