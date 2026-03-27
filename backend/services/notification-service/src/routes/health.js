const express = require("express");
const env = require("../config/env");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    service: env.appName,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
