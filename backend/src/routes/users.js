const cloudinary = require("cloudinary").v2;
const express = require("express");
const multer = require("multer");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

router.patch("/me", requireAuth, upload.single("avatar"), async (req, res) => {
  const data = {};
  if (req.body.name) {
    data.name = req.body.name;
  }

  if (req.file) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const uploaded = await cloudinary.uploader.upload(dataUri, { folder: "team-hub-avatars" });
      data.avatarUrl = uploaded.secure_url;
    } else {
      data.avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { id: true, email: true, name: true, avatarUrl: true }
  });

  return res.json({ user });
});

module.exports = router;
