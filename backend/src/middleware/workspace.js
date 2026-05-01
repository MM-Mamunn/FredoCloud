const prisma = require("../db");

async function getMembership(userId, workspaceId) {
  return prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });
}

async function requireWorkspaceMember(req, res, next) {
  const workspaceId = req.params.workspaceId || req.params.id;
  const membership = await getMembership(req.user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ message: "Workspace access denied" });
  }
  req.membership = membership;
  return next();
}

async function requireWorkspaceAdmin(req, res, next) {
  const workspaceId = req.params.workspaceId || req.params.id;
  const membership = await getMembership(req.user.id, workspaceId);
  if (!membership || membership.role !== "Admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  req.membership = membership;
  return next();
}

module.exports = {
  getMembership,
  requireWorkspaceMember,
  requireWorkspaceAdmin
};
