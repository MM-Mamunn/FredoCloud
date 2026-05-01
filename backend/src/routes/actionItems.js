const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");
const { getMembership } = require("../middleware/workspace");
const { audit, emitWorkspace } = require("./helpers");

const router = express.Router();

async function requireActionMember(req, res, next) {
  const item = await prisma.actionItem.findUnique({ where: { id: req.params.actionItemId } });
  if (!item || !(await getMembership(req.user.id, item.workspaceId))) {
    return res.status(403).json({ message: "Action item access denied" });
  }
  req.actionItem = item;
  return next();
}

router.post("/workspaces/:workspaceId/action-items", requireAuth, async (req, res) => {
  const membership = await getMembership(req.user.id, req.params.workspaceId);
  if (!membership) {
    return res.status(403).json({ message: "Workspace access denied" });
  }

  const { title, priority = "Medium", status = "Todo", dueDate, goalId, assigneeId } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Action item title is required" });
  }

  const actionItem = await prisma.actionItem.create({
    data: {
      title,
      priority,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      goalId: goalId || null,
      assigneeId: assigneeId || null,
      workspaceId: req.params.workspaceId
    },
    include: {
      assignee: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } }
    }
  });

  await audit(req.user.id, req.params.workspaceId, "created", "action item", title);
  emitWorkspace(req, req.params.workspaceId, "action:created", actionItem);
  return res.status(201).json({ actionItem });
});

router.patch("/action-items/:actionItemId", requireAuth, requireActionMember, async (req, res) => {
  const allowed = ["title", "priority", "status", "dueDate", "goalId", "assigneeId"];
  const data = {};
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      data[key] = req.body[key] || null;
    }
  });
  if (data.dueDate) {
    data.dueDate = new Date(data.dueDate);
  }

  const actionItem = await prisma.actionItem.update({
    where: { id: req.actionItem.id },
    data,
    include: {
      assignee: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } }
    }
  });

  await audit(req.user.id, req.actionItem.workspaceId, "updated", "action item", actionItem.title);
  emitWorkspace(req, req.actionItem.workspaceId, "action:updated", actionItem);
  return res.json({ actionItem });
});

module.exports = router;
