function normalizeOrigin(origin) {
  return origin ? origin.trim().replace(/\/+$/, "") : "";
}

function getAllowedOrigins() {
  const configured = process.env.CLIENT_URL || "http://localhost:3000";
  return configured
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function corsOrigin(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(normalizeOrigin(origin))) {
    return callback(null, true);
  }

  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
}

module.exports = {
  corsOrigin,
  getAllowedOrigins
};
