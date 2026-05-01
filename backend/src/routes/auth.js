const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");
const { clearAuthCookies, refreshSecret, setAuthCookies } = require("../auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email is already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true, avatarUrl: true }
  });

  setAuthCookies(res, user);
  return res.status(201).json({ user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  setAuthCookies(res, user);
  return res.json({
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }
  });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    const payload = jwt.verify(token, refreshSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    setAuthCookies(res, user);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  clearAuthCookies(res);
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
