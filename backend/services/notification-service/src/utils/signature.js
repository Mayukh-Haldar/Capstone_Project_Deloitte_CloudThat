const crypto = require("crypto");

const createSignature = (secret, payload) => {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
};

module.exports = { createSignature };
