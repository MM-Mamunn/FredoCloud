"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHubStore } from "../../store/useHubStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
const statuses = ["Todo", "Doing", "Done"];
const reactions = ["Like", "Launch", "Done"];

function dateValue(value) {
  return value ? new Date(value).toLocaleDateString() : "No date";
}

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const reset = () => setForm(initial);
  return [form, set, reset];
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    workspaces,
    selectedWorkspaceId,
    overview,
    online,
    viewMode,
    auditFilter,
    error,
    loading,
    pending,
    lastUpdated,
    loadMe,
    loadWorkspaces,
    loadOverview,
    logout,
    selectWorkspace,
    createWorkspace,
    inviteMember,
    updateProfile,
    createGoal,
    addMilestone,
    addGoalUpdate,
    createAnnouncement,
    reactToAnnouncement,
    commentOnAnnouncement,
    togglePin,
    createActionItem,
    updateActionItem,
    setOnline,
    setViewMode,
    setAuditFilter,
    clearError,
    exportUrl
  } = useHubStore();

  const [booted, setBooted] = useState(false);
  const [notice, setNotice] = useState("");
  const [profileName, setProfileName] = useState("");
  const [quickText, setQuickText] = useState({});
  const [workspaceForm, setWorkspaceForm, resetWorkspace] = useForm({ name: "", description: "", accentColor: "#0f766e" });
  const [inviteForm, setInviteForm, resetInvite] = useForm({ email: "", role: "Member" });
  const [goalForm, setGoalForm, resetGoal] = useForm({ title: "", dueDate: "", status: "Planned" });
  const [announcementForm, setAnnouncementForm, resetAnnouncement] = useForm({ title: "", body: "", pinned: "false" });
  const [itemForm, setItemForm, resetItem] = useForm({
    title: "",
    priority: "Medium",
    status: "Todo",
    dueDate: "",
    goalId: "",
    assigneeId: ""
  });

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const currentUser = await loadMe();
        if (mounted) {
          setProfileName(currentUser.name);
        }
        await loadWorkspaces();
      } catch (err) {
        router.push("/login");
      } finally {
        if (mounted) {
          setBooted(true);
        }
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [loadMe, loadWorkspaces, router]);

  useEffect(() => {
    if (user?.name) {
      setProfileName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedWorkspaceId || !user) {
      return undefined;
    }
    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.emit("joinWorkspace", { workspaceId: selectedWorkspaceId, user });
    socket.on("presence:update", setOnline);
    [
      "goal:created",
      "goal:update",
      "milestone:created",
      "announcement:created",
      "announcement:reaction",
      "announcement:comment",
      "announcement:pinned",
      "action:created",
      "action:updated",
      "member:invited"
    ].forEach((event) => {
      socket.on(event, () => loadOverview(selectedWorkspaceId));
    });
    return () => socket.disconnect();
  }, [selectedWorkspaceId, user, setOnline, loadOverview]);

  const data = overview?.workspace;
  const members = data?.memberships || [];
  const goals = data?.goals || [];
  const actionItems = data?.actionItems || [];
  const announcements = data?.announcements || [];
  const isFirstLoad = !booted || (loading.overview && !overview);
  const isRefreshing = loading.overview && Boolean(overview);

  const filteredAudit = useMemo(() => {
    const logs = data?.auditLogs || [];
    if (!auditFilter) {
      return logs;
    }
    return logs.filter((log) => `${log.action} ${log.entity} ${log.detail}`.toLowerCase().includes(auditFilter.toLowerCase()));
  }, [data, auditFilter]);

  async function perform(task, afterSuccess) {
    setNotice("");
    try {
      await task();
      if (afterSuccess) {
        afterSuccess();
      }
    } catch (err) {
      setNotice(err.message || "Something went wrong");
    }
  }

  async function submitInline(type, id) {
    const key = `${type}-${id}`;
    const value = quickText[key]?.trim();
    if (!value) {
      return;
    }

    await perform(async () => {
      if (type === "milestone") {
        await addMilestone(id, { title: value, progress: 0 });
      }
      if (type === "update") {
        await addGoalUpdate(id, value);
      }
      if (type === "comment") {
        await commentOnAnnouncement(id, value);
      }
      setQuickText((current) => ({ ...current, [key]: "" }));
    });
  }

  if (isFirstLoad) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="min-h-screen pb-8">
      <header className="sticky top-0 z-20 border-b border-[#d9e2df] bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0f766e]">Collaborative Team Hub</p>
            <h1 className="text-2xl font-bold">Team dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated ? <span className="badge">Updated {new Date(lastUpdated).toLocaleTimeString()}</span> : null}
            <select
              className="field max-w-[260px]"
              disabled={loading.workspaces || loading.overview}
              value={selectedWorkspaceId}
              onChange={(event) => perform(() => selectWorkspace(event.target.value))}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <BusyButton
              danger
              busy={pending.logout}
              onClick={() => perform(async () => { await logout(); router.push("/login"); })}
            >
              Logout
            </BusyButton>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-5">
          <Panel title="Profile" eyebrow={user.email}>
            <form className="mt-4 space-y-3" onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              perform(() => updateProfile(formData));
            }}>
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <img className="h-14 w-14 rounded-full object-cover" src={user.avatarUrl} alt={user.name} />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[#d7ece8] text-lg font-bold text-[#0f766e]">
                    {user.name?.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold">{user.name}</p>
                  <p className="text-sm text-[#60706b]">Signed in</p>
                </div>
              </div>
              <input className="field" name="name" value={profileName} disabled={pending["profile:update"]} onChange={(event) => setProfileName(event.target.value)} />
              <input className="field" name="avatar" type="file" accept="image/*" disabled={pending["profile:update"]} />
              <BusyButton full busy={pending["profile:update"]} type="submit">Save profile</BusyButton>
            </form>
          </Panel>

          <Panel title="New Workspace">
            <form className="mt-4 space-y-3" onSubmit={(event) => {
              event.preventDefault();
              perform(() => createWorkspace(workspaceForm), resetWorkspace);
            }}>
              <input className="field" placeholder="Name" value={workspaceForm.name} disabled={pending["workspace:create"]} onChange={setWorkspaceForm("name")} required />
              <textarea className="field min-h-24" placeholder="Description" value={workspaceForm.description} disabled={pending["workspace:create"]} onChange={setWorkspaceForm("description")} />
              <div className="grid grid-cols-[1fr_48px] items-center gap-2">
                <span className="text-sm font-semibold text-[#60706b]">Accent color</span>
                <input className="field h-11 p-1" type="color" value={workspaceForm.accentColor} disabled={pending["workspace:create"]} onChange={setWorkspaceForm("accentColor")} />
              </div>
              <BusyButton full busy={pending["workspace:create"]} type="submit">Create workspace</BusyButton>
            </form>
          </Panel>

          {data ? (
            <Panel title="Members" eyebrow={`${members.length} total`}>
              <div className="mt-4 space-y-2 text-sm">
                {online.length ? online.map((member, index) => (
                  <div className="flex items-center gap-2" key={`${member.id}-${index}`}>
                    <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                    <span>{member.name}</span>
                  </div>
                )) : <p className="text-[#60706b]">No active members shown.</p>}
              </div>
              <form className="mt-4 space-y-3" onSubmit={(event) => {
                event.preventDefault();
                perform(() => inviteMember(inviteForm), resetInvite);
              }}>
                <input className="field" type="email" placeholder="Invite email" value={inviteForm.email} disabled={pending["member:invite"]} onChange={setInviteForm("email")} required />
                <select className="field" value={inviteForm.role} disabled={pending["member:invite"]} onChange={setInviteForm("role")}>
                  <option>Member</option>
                  <option>Admin</option>
                </select>
                <BusyButton full busy={pending["member:invite"]} type="submit">Invite member</BusyButton>
              </form>
            </Panel>
          ) : null}
        </aside>

        <div className="relative space-y-5">
          {isRefreshing ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-[#d9e2df] bg-white px-4 py-2 text-sm font-semibold shadow">
              <span className="spinner dark" />
              Refreshing workspace
            </div>
          ) : null}

          {notice || error ? (
            <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span>{notice || error}</span>
              <button className="font-bold" type="button" onClick={() => { setNotice(""); clearError(); }}>Dismiss</button>
            </div>
          ) : null}

          {data ? (
            <div className="fade-in space-y-5">
              <section className="panel overflow-hidden">
                <div className="h-1.5" style={{ background: data.accentColor }} />
                <div className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-3xl font-bold">{data.name}</h2>
                      <p className="mt-1 max-w-2xl text-[#60706b]">{data.description || "No description added."}</p>
                    </div>
                    <a className="button inline-block" href={exportUrl()}>Export CSV</a>
                  </div>
                  <div className="compact-grid mt-5">
                    <Metric label="Goals" value={overview.analytics.totalGoals} />
                    <Metric label="Completed this week" value={overview.analytics.completedThisWeek} />
                    <Metric label="Overdue" value={overview.analytics.overdue} tone="warning" />
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <Panel title="Goals & Milestones">
                  <form className="mt-4 grid gap-2 md:grid-cols-[1fr_150px_150px_auto]" onSubmit={(event) => {
                    event.preventDefault();
                    perform(() => createGoal(goalForm), resetGoal);
                  }}>
                    <input className="field" placeholder="Goal title" value={goalForm.title} disabled={pending["goal:create"]} onChange={setGoalForm("title")} required />
                    <input className="field" type="date" value={goalForm.dueDate} disabled={pending["goal:create"]} onChange={setGoalForm("dueDate")} />
                    <select className="field" value={goalForm.status} disabled={pending["goal:create"]} onChange={setGoalForm("status")}>
                      <option>Planned</option>
                      <option>In Progress</option>
                      <option>Done</option>
                    </select>
                    <BusyButton busy={pending["goal:create"]} type="submit">Add</BusyButton>
                  </form>

                  <div className="mt-4 grid gap-3">
                    {goals.length ? goals.map((goal) => (
                      <article className="soft-card p-4" key={goal.id}>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="font-bold">{goal.title}</h3>
                            <p className="text-sm text-[#60706b]">{goal.status} | {dateValue(goal.dueDate)}</p>
                          </div>
                          <span className="badge">{goal.owner?.name || "No owner"}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {goal.milestones.length ? goal.milestones.map((milestone) => (
                            <div className="rounded-md bg-white p-3 text-sm" key={milestone.id}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold">{milestone.title}</p>
                                <span>{milestone.progress}%</span>
                              </div>
                              <progress className="mt-2 w-full accent-[#0f766e]" max="100" value={milestone.progress} />
                            </div>
                          )) : <p className="text-sm text-[#60706b]">No milestones yet.</p>}
                        </div>
                        <InlineInput
                          label="Add milestone"
                          busy={pending[`milestone:${goal.id}`]}
                          value={quickText[`milestone-${goal.id}`] || ""}
                          onChange={(value) => setQuickText({ ...quickText, [`milestone-${goal.id}`]: value })}
                          onSubmit={() => submitInline("milestone", goal.id)}
                        />
                        <InlineInput
                          label="Post update or @mention"
                          busy={pending[`update:${goal.id}`]}
                          value={quickText[`update-${goal.id}`] || ""}
                          onChange={(value) => setQuickText({ ...quickText, [`update-${goal.id}`]: value })}
                          onSubmit={() => submitInline("update", goal.id)}
                        />
                      </article>
                    )) : <EmptyState title="No goals yet" body="Create a goal above to start tracking milestones." />}
                  </div>
                </Panel>

                <Panel title="Goal Completion">
                  <div className="mt-4 h-64">
                    {overview.analytics.chart.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overview.analytics.chart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="progress" fill="#0f766e" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No chart data" body="Goal progress appears here after milestones are added." />
                    )}
                  </div>
                </Panel>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <Panel title="Announcements">
                  <form className="mt-4 grid gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    perform(() => createAnnouncement({ ...announcementForm, pinned: announcementForm.pinned === "true" }), resetAnnouncement);
                  }}>
                    <input className="field" placeholder="Title" value={announcementForm.title} disabled={pending["announcement:create"]} onChange={setAnnouncementForm("title")} required />
                    <textarea className="field min-h-24" placeholder="Announcement body" value={announcementForm.body} disabled={pending["announcement:create"]} onChange={setAnnouncementForm("body")} required />
                    <select className="field" value={announcementForm.pinned} disabled={pending["announcement:create"]} onChange={setAnnouncementForm("pinned")}>
                      <option value="false">Normal</option>
                      <option value="true">Pinned</option>
                    </select>
                    <BusyButton busy={pending["announcement:create"]} type="submit">Publish</BusyButton>
                  </form>
                  <div className="mt-4 space-y-3">
                    {announcements.length ? announcements.map((announcement) => (
                      <article className="soft-card p-4" key={announcement.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold">{announcement.title}</h3>
                              {announcement.pinned ? <span className="badge">Pinned</span> : null}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm">{announcement.body}</p>
                          </div>
                          <BusyButton secondary busy={pending[`pin:${announcement.id}`]} onClick={() => perform(() => togglePin(announcement))}>
                            {announcement.pinned ? "Unpin" : "Pin"}
                          </BusyButton>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {reactions.map((reaction) => (
                            <BusyButton
                              key={reaction}
                              secondary
                              compact
                              busy={pending[`reaction:${announcement.id}:${reaction}`]}
                              onClick={() => perform(() => reactToAnnouncement(announcement.id, reaction))}
                            >
                              {reaction} {announcement.reactions.filter((item) => item.emoji === reaction).length}
                            </BusyButton>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1 text-sm">
                          {announcement.comments.map((comment) => (
                            <p key={comment.id}><strong>{comment.author.name}:</strong> {comment.body}</p>
                          ))}
                        </div>
                        <InlineInput
                          label="Comment or @mention"
                          busy={pending[`comment:${announcement.id}`]}
                          value={quickText[`comment-${announcement.id}`] || ""}
                          onChange={(value) => setQuickText({ ...quickText, [`comment-${announcement.id}`]: value })}
                          onSubmit={() => submitInline("comment", announcement.id)}
                        />
                      </article>
                    )) : <EmptyState title="No announcements" body="Publish an announcement to update the workspace." />}
                  </div>
                </Panel>

                <Panel
                  title="Action Items"
                  action={(
                    <div className="segmented">
                      <button className={viewMode === "kanban" ? "active" : ""} type="button" onClick={() => setViewMode("kanban")}>Kanban</button>
                      <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")}>List</button>
                    </div>
                  )}
                >
                  <form className="mt-4 grid gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    perform(() => createActionItem(itemForm), resetItem);
                  }}>
                    <input className="field" placeholder="Action title" value={itemForm.title} disabled={pending["action:create"]} onChange={setItemForm("title")} required />
                    <div className="grid gap-2 md:grid-cols-3">
                      <select className="field" value={itemForm.priority} disabled={pending["action:create"]} onChange={setItemForm("priority")}><option>Low</option><option>Medium</option><option>High</option></select>
                      <input className="field" type="date" value={itemForm.dueDate} disabled={pending["action:create"]} onChange={setItemForm("dueDate")} />
                      <select className="field" value={itemForm.status} disabled={pending["action:create"]} onChange={setItemForm("status")}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <select className="field" value={itemForm.goalId} disabled={pending["action:create"]} onChange={setItemForm("goalId")}><option value="">No goal</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select>
                      <select className="field" value={itemForm.assigneeId} disabled={pending["action:create"]} onChange={setItemForm("assigneeId")}><option value="">No assignee</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</select>
                    </div>
                    <BusyButton busy={pending["action:create"]} type="submit">Create item</BusyButton>
                  </form>

                  {viewMode === "kanban" ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {statuses.map((status) => (
                        <div className="rounded-md bg-[#edf4f1] p-3" key={status}>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold">{status}</h3>
                            <span className="badge bg-white">{actionItems.filter((item) => item.status === status).length}</span>
                          </div>
                          <ItemList items={actionItems.filter((item) => item.status === status)} pending={pending} updateActionItem={updateActionItem} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-[#d9e2df]">
                      <ItemList items={actionItems} pending={pending} updateActionItem={updateActionItem} list />
                    </div>
                  )}
                </Panel>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <Panel title="Notifications">
                  <div className="mt-4 space-y-2 text-sm">
                    {overview.notifications.length ? overview.notifications.map((note) => (
                      <p className="rounded-md bg-[#f8fbfa] p-3" key={note.id}>{note.message}</p>
                    )) : <EmptyState title="No notifications" body="Mentions will appear here." />}
                  </div>
                </Panel>
                <Panel title="Audit Log" action={<input className="field md:w-56" placeholder="Filter audit" value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} />}>
                  <div className="mt-4 max-h-72 space-y-2 overflow-auto text-sm">
                    {filteredAudit.length ? filteredAudit.map((log) => (
                      <p className="rounded-md bg-[#f8fbfa] p-3" key={log.id}>
                        <strong>{log.user.name}</strong> {log.action} {log.entity}: {log.detail}
                      </p>
                    )) : <EmptyState title="No audit entries" body="Workspace changes will be listed here." />}
                  </div>
                </Panel>
              </section>
            </div>
          ) : (
            <Panel title="Create a workspace to begin">
              <p className="mt-2 text-[#60706b]">Use the workspace form on the left to start the hub.</p>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, action, children }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-[#60706b]">{eyebrow}</p> : null}
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BusyButton({ children, busy, secondary, danger, compact, full, type = "button", onClick }) {
  const classes = [
    "button inline-flex items-center justify-center gap-2",
    secondary ? "secondary" : "",
    danger ? "danger" : "",
    compact ? "px-3 py-1 text-sm" : "",
    full ? "w-full" : ""
  ].join(" ");

  return (
    <button className={classes} disabled={busy} type={type} onClick={onClick}>
      {busy ? <span className={secondary ? "spinner dark" : "spinner"} /> : null}
      {children}
    </button>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === "warning" ? "#fff7ed" : "#edf4f1";
  return (
    <div className="rounded-md p-4" style={{ background: color }}>
      <p className="text-sm font-semibold text-[#60706b]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function InlineInput({ label, value, onChange, onSubmit, busy }) {
  return (
    <div className="mt-3 flex gap-2">
      <input className="field" placeholder={label} value={value} disabled={busy} onChange={(event) => onChange(event.target.value)} />
      <BusyButton secondary busy={busy} onClick={onSubmit}>Add</BusyButton>
    </div>
  );
}

function ItemList({ items, updateActionItem, pending, list = false }) {
  if (!items.length) {
    return <p className="mt-3 text-sm text-[#60706b]">No items.</p>;
  }
  return (
    <div className={list ? "divide-y divide-[#d9e2df]" : "mt-3 space-y-2"}>
      {items.map((item) => {
        const busy = pending[`action:update:${item.id}`];
        return (
          <article className={list ? "grid gap-2 p-3 md:grid-cols-[1fr_130px_130px]" : "rounded-md bg-white p-3 text-sm shadow-sm"} key={item.id}>
            <div>
              <h3 className="font-bold">{item.title}</h3>
              <p className="text-[#60706b]">{item.priority} | {dateValue(item.dueDate)} | {item.goal?.title || "No goal"}</p>
            </div>
            <div className="relative">
              <select className="field pr-8" value={item.status} disabled={busy} onChange={(event) => updateActionItem(item.id, { status: event.target.value })}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              {busy ? <span className="spinner dark absolute right-3 top-3" /> : null}
            </div>
            <p className="self-center text-sm text-[#60706b]">{item.assignee?.name || "Unassigned"}</p>
          </article>
        );
      })}
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-md border border-dashed border-[#cbd9d5] p-5 text-center">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-[#60706b]">{body}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="skeleton h-4 w-44" />
              <div className="skeleton h-8 w-64" />
            </div>
            <div className="skeleton h-10 w-56" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-5">
            <SkeletonPanel />
            <SkeletonPanel />
            <SkeletonPanel />
          </div>
          <div className="space-y-5">
            <SkeletonPanel wide />
            <div className="grid gap-5 xl:grid-cols-2">
              <SkeletonPanel />
              <SkeletonPanel />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <SkeletonPanel />
              <SkeletonPanel />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SkeletonPanel({ wide }) {
  return (
    <section className="panel p-5">
      <div className="skeleton h-5 w-36" />
      <div className="mt-5 grid gap-3">
        <div className={`skeleton h-10 ${wide ? "w-full" : "w-4/5"}`} />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    </section>
  );
}
