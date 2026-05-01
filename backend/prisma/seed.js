const bcrypt = require("bcryptjs");
const prisma = require("../src/db");

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const demo = await prisma.user.upsert({
    where: { email: "demo@fredocloud.test" },
    update: {},
    create: {
      email: "demo@fredocloud.test",
      name: "Demo Admin",
      passwordHash
    }
  });

  let workspace = await prisma.workspace.findFirst({
    where: {
      name: "Launch Team",
      memberships: { some: { userId: demo.id } }
    }
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Launch Team",
        description: "Demo workspace for shared goals, announcements and action items.",
        accentColor: "#0f766e",
        memberships: {
          create: { userId: demo.id, role: "Admin" }
        }
      }
    });
  }

  let goal = await prisma.goal.findFirst({
    where: { title: "Prepare onboarding release", workspaceId: workspace.id }
  });

  if (!goal) {
    goal = await prisma.goal.create({
      data: {
        title: "Prepare onboarding release",
        description: "Coordinate launch checklist and team updates.",
        status: "In Progress",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ownerId: demo.id,
        workspaceId: workspace.id,
        milestones: {
          create: [
            { title: "Finalize checklist", progress: 80 },
            { title: "Run launch review", progress: 35 }
          ]
        },
        updates: {
          create: { body: "Kickoff complete. @demo can review the next milestone.", authorId: demo.id }
        }
      }
    });
  }

  const announcement = await prisma.announcement.findFirst({
    where: { title: "Weekly planning is live", workspaceId: workspace.id }
  });

  if (!announcement) {
    await prisma.announcement.create({
      data: {
        title: "Weekly planning is live",
        body: "Please add blockers and priority updates before the standup.",
        pinned: true,
        authorId: demo.id,
        workspaceId: workspace.id
      }
    });
  }

  const itemCount = await prisma.actionItem.count({ where: { workspaceId: workspace.id } });
  if (!itemCount) {
    await prisma.actionItem.createMany({
      data: [
        {
          title: "Upload launch avatar assets",
          priority: "Medium",
          status: "Todo",
          assigneeId: demo.id,
          goalId: goal.id,
          workspaceId: workspace.id
        },
        {
          title: "Review overdue reporting",
          priority: "High",
          status: "Doing",
          assigneeId: demo.id,
          goalId: goal.id,
          workspaceId: workspace.id
        }
      ]
    });
  }

  await prisma.auditLog.upsert({
    where: { id: "seed-log" },
    update: {},
    create: {
      id: "seed-log",
      action: "seeded",
      entity: "workspace",
      detail: workspace.name,
      userId: demo.id,
      workspaceId: workspace.id
    }
  });

  console.log("Seeded demo@fredocloud.test / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
