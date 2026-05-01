"use client";

import { create } from "zustand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request(path, options = {}, retry = true) {
  const bodyIsForm = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(bodyIsForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && retry) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });
    if (refreshed.ok) {
      return request(path, options, false);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  if (response.headers.get("content-type")?.includes("text/csv")) {
    return response.text();
  }
  return response.json();
}

function patchLoading(set, get, key, value) {
  set({ loading: { ...get().loading, [key]: value } });
}

function patchPending(set, get, key, value) {
  const pending = { ...get().pending, [key]: value };
  if (!value) {
    delete pending[key];
  }
  set({ pending });
}

export const useHubStore = create((set, get) => ({
  user: null,
  workspaces: [],
  selectedWorkspaceId: "",
  overview: null,
  online: [],
  viewMode: "kanban",
  auditFilter: "",
  error: "",
  loading: {
    auth: false,
    workspaces: false,
    overview: false
  },
  pending: {},
  lastUpdated: null,

  setOnline: (online) => set({ online }),
  setViewMode: (viewMode) => set({ viewMode }),
  setAuditFilter: (auditFilter) => set({ auditFilter }),
  clearError: () => set({ error: "" }),

  login: async (email, password) => {
    patchLoading(set, get, "auth", true);
    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      set({ user: data.user, error: "" });
      await get().loadWorkspaces();
    } finally {
      patchLoading(set, get, "auth", false);
    }
  },

  register: async (name, email, password) => {
    patchLoading(set, get, "auth", true);
    try {
      const data = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      set({ user: data.user, error: "" });
      await get().loadWorkspaces();
    } finally {
      patchLoading(set, get, "auth", false);
    }
  },

  logout: async () => {
    patchPending(set, get, "logout", true);
    await request("/api/auth/logout", { method: "POST" }).catch(() => null);
    patchPending(set, get, "logout", false);
    set({ user: null, workspaces: [], selectedWorkspaceId: "", overview: null });
  },

  loadMe: async () => {
    patchLoading(set, get, "auth", true);
    try {
      const data = await request("/api/auth/me");
      set({ user: data.user });
      return data.user;
    } finally {
      patchLoading(set, get, "auth", false);
    }
  },

  loadWorkspaces: async () => {
    patchLoading(set, get, "workspaces", true);
    try {
      const data = await request("/api/workspaces");
      const selectedWorkspaceId = get().selectedWorkspaceId || data.workspaces[0]?.id || "";
      set({ workspaces: data.workspaces, selectedWorkspaceId });
      if (selectedWorkspaceId) {
        await get().loadOverview(selectedWorkspaceId);
      }
    } finally {
      patchLoading(set, get, "workspaces", false);
    }
  },

  selectWorkspace: async (workspaceId) => {
    set({ selectedWorkspaceId: workspaceId });
    await get().loadOverview(workspaceId);
  },

  loadOverview: async (workspaceId = get().selectedWorkspaceId) => {
    if (!workspaceId) {
      return;
    }
    patchLoading(set, get, "overview", true);
    try {
      const data = await request(`/api/workspaces/${workspaceId}/overview`);
      set({ overview: data, error: "", lastUpdated: new Date().toISOString() });
    } finally {
      patchLoading(set, get, "overview", false);
    }
  },

  createWorkspace: async (payload) => {
    patchPending(set, get, "workspace:create", true);
    try {
      const data = await request("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      set((state) => ({
        workspaces: [...state.workspaces, data.workspace],
        selectedWorkspaceId: data.workspace.id
      }));
      await get().loadOverview(data.workspace.id);
    } finally {
      patchPending(set, get, "workspace:create", false);
    }
  },

  inviteMember: async (payload) => {
    patchPending(set, get, "member:invite", true);
    try {
      await request(`/api/workspaces/${get().selectedWorkspaceId}/invites`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, "member:invite", false);
    }
  },

  updateProfile: async (formData) => {
    patchPending(set, get, "profile:update", true);
    try {
      const data = await request("/api/users/me", { method: "PATCH", body: formData });
      set({ user: data.user });
    } finally {
      patchPending(set, get, "profile:update", false);
    }
  },

  createGoal: async (payload) => {
    patchPending(set, get, "goal:create", true);
    try {
      await request(`/api/workspaces/${get().selectedWorkspaceId}/goals`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, "goal:create", false);
    }
  },

  addMilestone: async (goalId, payload) => {
    const key = `milestone:${goalId}`;
    patchPending(set, get, key, true);
    try {
      await request(`/api/goals/${goalId}/milestones`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, key, false);
    }
  },

  addGoalUpdate: async (goalId, body) => {
    const key = `update:${goalId}`;
    patchPending(set, get, key, true);
    try {
      await request(`/api/goals/${goalId}/updates`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, key, false);
    }
  },

  createAnnouncement: async (payload) => {
    patchPending(set, get, "announcement:create", true);
    try {
      await request(`/api/workspaces/${get().selectedWorkspaceId}/announcements`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, "announcement:create", false);
    }
  },

  reactToAnnouncement: async (announcementId, emoji) => {
    const key = `reaction:${announcementId}:${emoji}`;
    patchPending(set, get, key, true);
    try {
      await request(`/api/announcements/${announcementId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji })
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, key, false);
    }
  },

  commentOnAnnouncement: async (announcementId, body) => {
    const key = `comment:${announcementId}`;
    patchPending(set, get, key, true);
    try {
      await request(`/api/announcements/${announcementId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, key, false);
    }
  },

  togglePin: async (announcement) => {
    const key = `pin:${announcement.id}`;
    patchPending(set, get, key, true);
    try {
      await request(`/api/announcements/${announcement.id}/pin`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: !announcement.pinned })
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, key, false);
    }
  },

  createActionItem: async (payload) => {
    patchPending(set, get, "action:create", true);
    try {
      await request(`/api/workspaces/${get().selectedWorkspaceId}/action-items`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await get().loadOverview();
    } finally {
      patchPending(set, get, "action:create", false);
    }
  },

  updateActionItem: async (itemId, patch) => {
    const previous = get().overview;
    const key = `action:update:${itemId}`;
    patchPending(set, get, key, true);
    set((state) => {
      if (!state.overview) {
        return state;
      }
      return {
        overview: {
          ...state.overview,
          workspace: {
            ...state.overview.workspace,
            actionItems: state.overview.workspace.actionItems.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item
            )
          }
        }
      };
    });

    try {
      await request(`/api/action-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await get().loadOverview();
    } catch (error) {
      set({ overview: previous, error: error.message });
    } finally {
      patchPending(set, get, key, false);
    }
  },

  exportUrl: () => `${API_URL}/api/workspaces/${get().selectedWorkspaceId}/export.csv`
}));
