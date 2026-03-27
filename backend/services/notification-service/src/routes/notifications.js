const express = require("express");
const { Notification } = require("../models/Notification");
const { DeliveryLog } = require("../models/DeliveryLog");
const { ROLE } = require("../constants/roles");
const { asyncHandler } = require("../utils/asyncHandler");
const { parsePagination, buildPage } = require("../utils/pagination");
const { ApiError } = require("../utils/apiError");
const errorCodes = require("../constants/errorCodes");
const { requireAuth, requireInternalAccess, requireRoles } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { sendNotificationSchema, listNotificationsQuerySchema, markReadSchema } = require("../validators/notificationValidators");
const { createNotifications } = require("../services/notificationService");

const createNotificationRouter = () => {
  const router = express.Router();

  router.post(
    "/send",
    requireInternalAccess,
    validate(sendNotificationSchema),
    asyncHandler(async (req, res) => {
      const result = await createNotifications({ payload: req.body, io: req.app.locals.io || null });
      res.status(202).json(result);
    })
  );

  router.get(
    "/",
    requireAuth,
    validate(listNotificationsQuerySchema, "query"),
    asyncHandler(async (req, res) => {
      const { page, size, skip } = parsePagination(req.query);
      const filter = {
        userId: req.user.id,
        deletedAt: null
      };

      if (req.query.status) filter.status = req.query.status;
      if (req.query.channel) filter.channel = req.query.channel;
      if (req.query.eventType) filter.eventType = req.query.eventType;
      if (req.query.unreadOnly) filter.readAt = null;

      const [items, totalElements] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
        Notification.countDocuments(filter)
      ]);

      res.json(buildPage({ items, page, size, totalElements }));
    })
  );

  router.get(
    "/delivery-logs",
    requireAuth,
    requireRoles([ROLE.ADMIN]),
    asyncHandler(async (req, res) => {
      const { page, size, skip } = parsePagination(req.query);
      const filter = {};
      const [items, totalElements] = await Promise.all([
        DeliveryLog.find(filter).sort({ sentAt: -1 }).skip(skip).limit(size).lean(),
        DeliveryLog.countDocuments(filter)
      ]);

      res.json(buildPage({ items, page, size, totalElements }));
    })
  );

  router.get(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const notification = await Notification.findById(req.params.id).lean();
      if (!notification || notification.deletedAt) {
        throw new ApiError(404, "NOT_FOUND", errorCodes.NOTIFICATION_NOT_FOUND, "Notification was not found");
      }
      if (notification.userId !== req.user.id && !req.user.roles.includes(ROLE.ADMIN)) {
        throw new ApiError(403, "AUTHORIZATION_ERROR", errorCodes.AUTHORIZATION_ERROR, "You cannot access this notification");
      }

      const logs = await DeliveryLog.find({ notificationId: notification._id }).sort({ sentAt: -1 }).lean();
      res.json({ ...notification, deliveryLogs: logs });
    })
  );

  router.patch(
    "/:id/read",
    requireAuth,
    validate(markReadSchema),
    asyncHandler(async (req, res) => {
      const notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user.id,
        deletedAt: null
      });
      if (!notification) {
        throw new ApiError(404, "NOT_FOUND", errorCodes.NOTIFICATION_NOT_FOUND, "Notification was not found");
      }

      notification.readAt = req.body.read ? new Date() : null;
      notification.status = req.body.read ? "READ" : "SENT";
      await notification.save();

      res.json(notification);
    })
  );

  router.delete(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user.id,
        deletedAt: null
      });
      if (!notification) {
        throw new ApiError(404, "NOT_FOUND", errorCodes.NOTIFICATION_NOT_FOUND, "Notification was not found");
      }

      notification.deletedAt = new Date();
      notification.status = "DELETED";
      await notification.save();

      res.status(204).send();
    })
  );

  return router;
};

module.exports = { createNotificationRouter };
