const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");
const { getMembership } = require("../middleware/workspace");
const { audit, createMentionNotifications, emitWorkspace } = require("./helpers");

const router = express.Router();

async function requireGoalMember(req, res, next) {
  const goal = await prisma.goal.findUnique({ where: { id: req.params.goalId || req.params.id } });
  if (!goal || !(await getMembership(req.user.id, goal.workspaceId))) {
    return res.status(403).json({ message: "Goal access denied" });
  }
  req.goal = goal;
  return next();
}

router.post("/workspaces/:workspaceId/goals", requireAuth, async (req, res) => {
  const membership = await getMembership(req.user.id, req.params.workspaceId);
  if (!membership) {
    return res.status(403).json({ message: "Workspace access denied" });
  }

  const { title, ownerId, dueDate, status = "Planned", description = "" } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Goal title is required" });
  }

  const goal = await prisma.goal.create({
    data: {
      title,
      description,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      ownerId: ownerId || req.user.id,
      workspaceId: req.params.workspaceId
    },
    include: { owner: { select: { id: true, name: true } }, milestones: true, updates: true }
  });

  await audit(req.user.id, req.params.workspaceId, "created", "goal", title);
  emitWorkspace(req, req.params.workspaceId, "goal:created", goal);
  return res.status(201).json({ goal });
});

router.post("/goals/:goalId/milestones", requireAuth, requireGoalMember, async (req, res) => {
  const { title, progress = 0 } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Milestone title is required" });
  }

  const milestone = await prisma.milestone.create({
    data: { title, progress: Number(progress), goalId: req.goal.id }
  });

  await audit(req.user.id, req.goal.workspaceId, "created", "milestone", title);
  emitWorkspace(req, req.goal.workspaceId, "milestone:created", milestone);
  return res.status(201).json({ milestone });
});

router.post("/goals/:goalId/updates", requireAuth, requireGoalMember, async (req, res) => {
  const { body } = req.body;
  if (!body) {
    return res.status(400).json({ message: "Update body is required" });
  }

  const update = await prisma.goalUpdate.create({
    data: { body, goalId: req.goal.id, authorId: req.user.id },
    include: { author: { select: { id: true, name: true } } }
  });
  await createMentionNotifications(req.goal.workspaceId, req.user, body);
  await audit(req.user.id, req.goal.workspaceId, "posted", "goal update", req.goal.title);
  emitWorkspace(req, req.goal.workspaceId, "goal:update", update);
  return res.status(201).json({ update });
});

module.exports = router;
