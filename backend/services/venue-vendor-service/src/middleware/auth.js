const jwt = require("jsonwebtoken");
const { ROLE } = require("../constants/roles");
const errorCodes = require("../constants/errorCodes");
const { ApiError } = require("../utils/apiError");
const env = require("../config/env");

const normalizeRole = (value) => {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().toUpperCase();
  return normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized;
};

const extractRoles = (claims = {}) => {
  if (Array.isArray(claims.roles)) {
    return claims.roles.map(normalizeRole).filter(Boolean);
  }

  if (Array.isArray(claims.authorities)) {
    return claims.authorities.map(normalizeRole).filter(Boolean);
  }

  return [];
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
  if (env.nodeEnv !== "development" && !isLocalhostRequest(req)) {
    return null;
  }
  const id = req.header("x-user-id");
  if (!id) {
    return null;
  }
  const headerRoles = (req.header("x-user-roles") || "")
    .split(",")
    .map(normalizeRole)
    .filter(Boolean);

  return {
    id,
    email: req.header("x-user-email") || `${id}@eventzen.local`,
    roles: headerRoles.length ? headerRoles : [ROLE.ADMIN]
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
    next(
      new ApiError(
        401,
        "AUTHENTICATION_ERROR",
        errorCodes.AUTHENTICATION_ERROR,
        "Missing Bearer token"
      )
    );
    return;
  }

  const token = authorization.substring(7);
  try {
    const claims = jwt.verify(token, env.jwtSecret, {
      issuer: env.jwtIssuer
    });
    if (claims.type && claims.type !== "access") {
      throw new Error("Only access tokens are accepted");
    }
    req.user = {
      id: claims.uid || claims.sub,
      email: claims.email || claims.sub,
      roles: extractRoles(claims)
    };
    next();
  } catch (_error) {
    next(
      new ApiError(
        401,
        "AUTHENTICATION_ERROR",
        errorCodes.AUTHENTICATION_ERROR,
        "Invalid or expired token"
      )
    );
  }
};

const requireRoles = (allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    next(
      new ApiError(
        401,
        "AUTHENTICATION_ERROR",
        errorCodes.AUTHENTICATION_ERROR,
        "Authentication required"
      )
    );
    return;
  }

  const currentRoles = req.user.roles || [];
  if (!allowedRoles.some((role) => currentRoles.includes(role))) {
    next(
      new ApiError(
        403,
        "AUTHORIZATION_ERROR",
        errorCodes.AUTHORIZATION_ERROR,
        "Insufficient permissions for resource"
      )
    );
    return;
  }

  next();
};

module.exports = { requireAuth, requireRoles, normalizeRole, extractRoles };
