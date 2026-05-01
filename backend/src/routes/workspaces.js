const bcrypt = require("bcryptjs");
const express = require("express");
const prisma = require("../db");
const requireAuth = require("../middleware/auth");
const { requireWorkspaceAdmin, requireWorkspaceMember } = require("../middleware/workspace");
const { audit, emitWorkspace } = require("./helpers");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" }
  });

  return res.json({
    workspaces: memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role
    }))
  });
});

router.post("/", requireAuth, async (req, res) => {
  const { name, description = "", accentColor = "#0f766e" } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Workspace name is required" });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      description,
      accentColor,
      memberships: {
        create: { userId: req.user.id, role: "Admin" }
      }
    }
  });

  await audit(req.user.id, workspace.id, "created", "workspace", workspace.name);
  return res.status(201).json({ workspace: { ...workspace, role: "Admin" } });
});

router.post("/:workspaceId/invites", requireAuth, requireWorkspaceAdmin, async (req, res) => {
  const { email, role = "Member" } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: email.split("@")[0],
      passwordHash: await bcrypt.hash("ChangeMe123!", 10)
    }
  });

  const membership = await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.workspaceId } },
    update: { role },
    create: { userId: user.id, workspaceId: req.params.workspaceId, role }
  });

  await audit(req.user.id, req.params.workspaceId, "invited", "member", `${email} as ${role}`);
  emitWorkspace(req, req.params.workspaceId, "member:invited", { email, role });
  return res.status(201).json({ membership });
});

router.get("/:workspaceId/overview", requireAuth, requireWorkspaceMember, async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" }
      },
      goals: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          milestones: true,
          updates: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      announcements: {
        include: {
          author: { select: { id: true, name: true } },
          reactions: true,
          comments: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }]
      },
      actionItems: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          goal: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      auditLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const now = new Date();
  const completedThisWeek = workspace.actionItems.filter((item) => item.status === "Done" && item.updatedAt >= weekStart).length;
  const overdue = workspace.actionItems.filter((item) => item.status !== "Done" && item.dueDate && item.dueDate < now).length;
  const chart = workspace.goals.map((goal) => {
    const progress = goal.milestones.length
      ? Math.round(goal.milestones.reduce((sum, milestone) => sum + milestone.progress, 0) / goal.milestones.length)
      : goal.status === "Done"
        ? 100
        : 0;
    return { name: goal.title, progress };
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return res.json({
    workspace,
    notifications,
    analytics: {
      totalGoals: workspace.goals.length,
      completedThisWeek,
      overdue,
      chart
    }
  });
});

router.get("/:workspaceId/export.csv", requireAuth, requireWorkspaceMember, async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
    include: { goals: true, actionItems: true, auditLogs: true }
  });

  const rows = [
    ["type", "title_or_action", "status_or_entity", "date"],
    ...workspace.goals.map((goal) => ["goal", goal.title, goal.status, goal.createdAt.toISOString()]),
    ...workspace.actionItems.map((item) => ["action_item", item.title, item.status, item.createdAt.toISOString()]),
    ...workspace.auditLogs.map((log) => ["audit", log.action, log.entity, log.createdAt.toISOString()])
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  res.header("Content-Type", "text/csv");
  res.attachment(`${workspace.name.replace(/\s+/g, "-").toLowerCase()}-export.csv`);
  return res.send(csv);
});

module.exports = router;
