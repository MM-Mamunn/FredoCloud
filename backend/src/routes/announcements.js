const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");
const { getMembership, requireWorkspaceAdmin } = require("../middleware/workspace");
const { audit, createMentionNotifications, emitWorkspace } = require("./helpers");

const router = express.Router();

async function requireAnnouncementMember(req, res, next) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: req.params.announcementId || req.params.id }
  });
  if (!announcement || !(await getMembership(req.user.id, announcement.workspaceId))) {
    return res.status(403).json({ message: "Announcement access denied" });
  }
  req.announcement = announcement;
  return next();
}

router.post("/workspaces/:workspaceId/announcements", requireAuth, requireWorkspaceAdmin, async (req, res) => {
  const { title, body, pinned = false } = req.body;
  if (!title || !body) {
    return res.status(400).json({ message: "Title and body are required" });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      pinned,
      workspaceId: req.params.workspaceId,
      authorId: req.user.id
    },
    include: { author: { select: { id: true, name: true } }, reactions: true, comments: true }
  });

  await audit(req.user.id, req.params.workspaceId, "published", "announcement", title);
  emitWorkspace(req, req.params.workspaceId, "announcement:created", announcement);
  return res.status(201).json({ announcement });
});

router.patch("/announcements/:announcementId/pin", requireAuth, requireAnnouncementMember, async (req, res) => {
  const membership = await getMembership(req.user.id, req.announcement.workspaceId);
  if (membership.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const announcement = await prisma.announcement.update({
    where: { id: req.announcement.id },
    data: { pinned: Boolean(req.body.pinned) }
  });

  await audit(req.user.id, req.announcement.workspaceId, "updated", "announcement pin", announcement.title);
  emitWorkspace(req, req.announcement.workspaceId, "announcement:pinned", announcement);
  return res.json({ announcement });
});

router.post("/announcements/:announcementId/reactions", requireAuth, requireAnnouncementMember, async (req, res) => {
  const { emoji = "👍" } = req.body;
  const reaction = await prisma.announcementReaction.upsert({
    where: {
      announcementId_userId_emoji: {
        announcementId: req.announcement.id,
        userId: req.user.id,
        emoji
      }
    },
    update: {},
    create: { announcementId: req.announcement.id, userId: req.user.id, emoji }
  });

  await audit(req.user.id, req.announcement.workspaceId, "reacted", "announcement", emoji);
  emitWorkspace(req, req.announcement.workspaceId, "announcement:reaction", reaction);
  return res.status(201).json({ reaction });
});

router.post("/announcements/:announcementId/comments", requireAuth, requireAnnouncementMember, async (req, res) => {
  const { body } = req.body;
  if (!body) {
    return res.status(400).json({ message: "Comment body is required" });
  }

  const comment = await prisma.announcementComment.create({
    data: { body, announcementId: req.announcement.id, authorId: req.user.id },
    include: { author: { select: { id: true, name: true } } }
  });

  await createMentionNotifications(req.announcement.workspaceId, req.user, body);
  await audit(req.user.id, req.announcement.workspaceId, "commented", "announcement", req.announcement.title);
  emitWorkspace(req, req.announcement.workspaceId, "announcement:comment", comment);
  return res.status(201).json({ comment });
});

module.exports = router;
