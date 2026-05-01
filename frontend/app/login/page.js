"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHubStore } from "../../store/useHubStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, loading } = useHubStore();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "demo@fredocloud.test",
    password: "Password123!"
  });
  const [error, setError] = useState("");
  const busy = loading.auth;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_400px]">
        <section className="relative flex min-h-[560px] overflow-hidden rounded-lg bg-[#12312d] p-8 text-white">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(135deg,rgba(83,173,163,0.25),transparent)]" />
          <div className="relative z-10 flex w-full flex-col justify-between">
          <div>
            <p className="badge bg-[#d7fbf5] text-[#12312d]">FredoCloud Assessment</p>
            <h1 className="mt-8 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
              Collaborative Team Hub
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[#dce9e6]">
              Manage workspaces, shared goals, announcements, action items, presence and analytics from one focused dashboard.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[#dce9e6] sm:grid-cols-3">
            {["JWT cookies", "Socket.io updates", "Prisma/PostgreSQL"].map((item) => (
              <span className="rounded-md border border-white/15 bg-white/10 p-3" key={item}>{item}</span>
            ))}
          </div>
          </div>
        </section>

        <section className="panel self-center p-6">
          <div className="mb-6">
            <p className="text-sm font-semibold text-[#60706b]">{mode === "login" ? "Welcome back" : "Start a new account"}</p>
            <h2 className="mt-1 text-2xl font-bold">{mode === "login" ? "Sign in" : "Register"}</h2>
          </div>
          <div className="segmented mb-6">
            <button
              className={`flex-1 ${mode === "login" ? "active" : ""}`}
              type="button"
              disabled={busy}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={`flex-1 ${mode === "register" ? "active" : ""}`}
              type="button"
              disabled={busy}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <label className="block text-sm font-semibold">
                Name
                <input
                  className="field mt-1"
                  value={form.name}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Email
              <input
                className="field mt-1"
                type="email"
                value={form.email}
                disabled={busy}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                className="field mt-1"
                type="password"
                value={form.password}
                disabled={busy}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <button className="button flex w-full items-center justify-center gap-2" disabled={busy} type="submit">
              {busy ? <span className="spinner" /> : null}
              {busy ? "Checking..." : mode === "login" ? "Open dashboard" : "Create account"}
            </button>
          </form>

          <div className="mt-6 rounded-md border border-dashed border-[#b7c8c3] p-4 text-sm text-[#52625d]">
            Demo seed account: <strong>demo@fredocloud.test</strong> / <strong>Password123!</strong>
          </div>
        </section>
      </div>
    </main>
  );
}
