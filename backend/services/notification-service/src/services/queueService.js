const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const env = require("../config/env");
const { Notification } = require("../models/Notification");
const { performDeliveryAttempt, markNotificationFailed } = require("./notificationService");

const QUEUE_NAME = "notification-delivery";

let connection = null;
let queue = null;
let worker = null;

const RETRY_POLICY = {
  EMAIL: { attempts: 3, backoff: { type: "exponential", delay: 60_000 } },
  PUSH: { attempts: 5, backoff: { type: "fixed", delay: 60_000 } },
  WEBHOOK: { attempts: 5, backoff: { type: "exponential", delay: 60_000 } }
};

const queueEnabledChannels = new Set(["EMAIL", "PUSH", "WEBHOOK"]);

const isQueueEnabledForChannel = (channel) => env.enableBullMq && queueEnabledChannels.has(channel);

const getConnection = () => {
  if (!connection) {
    connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null
    });
  }

  return connection;
};

const getQueue = () => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getConnection()
    });
  }

  return queue;
};

const enqueueDelivery = async ({ notificationId }) => {
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) {
    return null;
  }

  const policy = RETRY_POLICY[notification.channel];
  if (!policy) {
    return null;
  }

  return getQueue().add(
    `${notification.channel.toLowerCase()}-${notification._id}`,
    { notificationId: String(notification._id) },
    {
      attempts: policy.attempts,
      backoff: policy.backoff,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );
};

const startQueueWorker = async ({ io } = {}) => {
  if (!env.enableBullMq) {
    return {
      enabled: false,
      message: "BullMQ worker disabled",
      stop: async () => {}
    };
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts || currentAttempt;

      try {
        await performDeliveryAttempt({
          notificationId: job.data.notificationId,
          io,
          attemptNumber: currentAttempt
        });
      } catch (error) {
        if (currentAttempt >= maxAttempts) {
          await markNotificationFailed({
            notificationId: job.data.notificationId,
            attemptNumber: currentAttempt,
            reason: error.message || "Delivery failed after max retries"
          });
          return;
        }

        throw error;
      }
    },
    {
      connection: getConnection()
    }
  );

  return {
    enabled: true,
    message: `BullMQ worker connected to ${env.redisUrl}`,
    stop: async () => {
      if (worker) {
        await worker.close();
        worker = null;
      }
      if (queue) {
        await queue.close();
        queue = null;
      }
      if (connection) {
        await connection.quit();
        connection = null;
      }
    }
  };
};

module.exports = {
  enqueueDelivery,
  isQueueEnabledForChannel,
  startQueueWorker
};
