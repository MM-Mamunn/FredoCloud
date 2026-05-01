const prisma = require("../db");

function emitWorkspace(req, workspaceId, event, payload) {
  const io = req.app.get("io");
  if (io) {
    io.to(workspaceId).emit(event, payload);
  }
}

async function audit(userId, workspaceId, action, entity, detail) {
  return prisma.auditLog.create({
    data: { userId, workspaceId, action, entity, detail }
  });
}

async function createMentionNotifications(workspaceId, author, body) {
  const names = Array.from(new Set((body.match(/@([a-zA-Z0-9._-]+)/g) || []).map((item) => item.slice(1).toLowerCase())));
  if (!names.length) {
    return [];
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true }
  });

  const mentioned = members.filter(({ user }) => {
    const handle = user.email.split("@")[0].toLowerCase();
    return names.includes(handle) || names.includes(user.name.toLowerCase().replace(/\s+/g, "."));
  });

  return Promise.all(
    mentioned
      .filter(({ user }) => user.id !== author.id)
      .map(({ user }) =>
        prisma.notification.create({
          data: {
            userId: user.id,
            workspaceId,
            message: `${author.name} mentioned you`
          }
        })
      )
  );
}

module.exports = {
  audit,
  createMentionNotifications,
  emitWorkspace
};
