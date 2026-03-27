const express = require("express");
const mongoose = require("mongoose");
const env = require("../config/env");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    service: env.appName,
    status: "UP",
    timestamp: new Date().toISOString(),
    mongoState: mongoose.connection.readyState
  });
});

module.exports = router;
