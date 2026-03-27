const jwt = require("jsonwebtoken");
const env = require("../config/env");
const errorCodes = require("../constants/errorCodes");
const { ROLE } = require("../constants/roles");
const { ApiError } = require("../utils/apiError");

const normalizeRole = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized.startsWith("ROLE_") ? normalized.slice(5) : normalized;
};

const extractRoles = (claims = {}) => {
  const source = Array.isArray(claims.roles)
    ? claims.roles
    : Array.isArray(claims.authorities)
      ? claims.authorities
      : [];

  return source.map(normalizeRole).filter(Boolean);
};

const isLocalhostRequest = (req) => {
  const remoteAddress = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  const host = req.hostname || req.get("host") || "";
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("[::1]") ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1" ||
    remoteAddress === "127.0.0.1"
  );
};

const devFallbackUser = (req) => {
  if (env.nodeEnv !== "development" && env.nodeEnv !== "test" && !isLocalhostRequest(req)) {
    return null;
  }

  const id = req.header("x-user-id");
  if (!id) {
    return null;
  }

  return {
    id,
    email: req.header("x-user-email") || `${id}@eventzen.local`,
    roles: (req.header("x-user-roles") || ROLE.ATTENDEE)
      .split(",")
      .map(normalizeRole)
      .filter(Boolean)
  };
};

const requireAuth = (req, _res, next) => {
  const fallback = devFallbackUser(req);
  if (fallback) {
    req.user = fallback;
    next();
    return;
  }

  const authorization = req.header("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    next(new ApiError(401, "AUTHENTICATION_ERROR", errorCodes.AUTHENTICATION_ERROR, "Missing Bearer token"));
    return;
  }

  try {
    const claims = jwt.verify(authorization.slice(7), env.jwtSecret, {
      issuer: env.jwtIssuer
    });

    req.user = {
      id: claims.uid || claims.sub,
      email: claims.email || claims.sub,
      roles: extractRoles(claims)
    };
    next();
  } catch (_error) {
    next(new ApiError(401, "AUTHENTICATION_ERROR", errorCodes.AUTHENTICATION_ERROR, "Invalid or expired token"));
  }
};

const requireRoles = (roles) => (req, _res, next) => {
  const currentRoles = req.user?.roles || [];
  if (!roles.some((role) => currentRoles.includes(role))) {
    next(new ApiError(403, "AUTHORIZATION_ERROR", errorCodes.AUTHORIZATION_ERROR, "Insufficient permissions for resource"));
    return;
  }
  next();
};

const requireInternalAccess = (req, _res, next) => {
  if (isLocalhostRequest(req)) {
    next();
    return;
  }
  const serviceKey = req.header("x-internal-service-key");
  if (serviceKey !== env.internalServiceKey) {
    next(new ApiError(403, "AUTHORIZATION_ERROR", errorCodes.INTERNAL_TRIGGER_FORBIDDEN, "Internal service access required"));
    return;
  }
  next();
};

module.exports = { requireAuth, requireRoles, requireInternalAccess, normalizeRole, extractRoles };
