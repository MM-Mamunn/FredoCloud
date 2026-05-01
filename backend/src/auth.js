const jwt = require("jsonwebtoken");

const accessSecret = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

function signAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, accessSecret, { expiresIn: "15m" });
}

function signRefreshToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, refreshSecret, { expiresIn: "7d" });
}

function setAuthCookies(res, user) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie("accessToken", signAccessToken(user), {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge: 15 * 60 * 1000
  });
  res.cookie("refreshToken", signRefreshToken(user), {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
}

module.exports = {
  accessSecret,
  refreshSecret,
  setAuthCookies,
  clearAuthCookies
};
