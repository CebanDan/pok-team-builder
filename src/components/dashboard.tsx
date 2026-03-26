"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { TeamRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http-client";
import { SpriteImage } from "@/components/sprite-image";

type AuthResponse = {
  user: {
    id: string;
    email: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type TeamsResponse = {
  teams: TeamRecord[];
};

type DashboardState = {
  loading: boolean;
  user: AuthResponse["user"];
  teams: TeamRecord[];
  error: string | null;
};

async function getInitialState(): Promise<DashboardState> {
  try {
    const me = await apiFetch<AuthResponse>("/api/auth/me", { method: "GET" });
    if (!me.user) {
      return {
        loading: false,
        user: null,
        teams: [],
        error: null,
      };
    }

    const teamsResponse = await apiFetch<TeamsResponse>("/api/teams", { method: "GET" });
    return {
      loading: false,
      user: me.user,
      teams: teamsResponse.teams,
      error: null,
    };
  } catch {
    return {
      loading: false,
      user: null,
      teams: [],
      error: null,
    };
  }
}

export function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    user: null,
    teams: [],
    error: null,
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [newTeamName, setNewTeamName] = useState("New Team");
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const router = typeof window !== "undefined" ? require("next/navigation").useRouter() : null;

  useEffect(() => {
    if (!state.loading) return;
    getInitialState().then(setState);
  }, [state.loading]);

  async function refreshTeams() {
    const teamsResponse = await apiFetch<TeamsResponse>("/api/teams", { method: "GET" });
    setState((previous) => ({
      ...previous,
      teams: teamsResponse.teams,
      error: null,
    }));
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      await apiFetch(`/api/auth/${authMode}`, {
        method: "POST",
        body: { email, password },
      });
      const nextState = await getInitialState();
      setState(nextState);
      setPassword("");
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : "Authentication failed.",
      }));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setBusyActionId("logout");
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setState({
        loading: false,
        user: null,
        teams: [],
        error: null,
      });
      setPassword("");
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : "Logout failed.",
      }));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleCreateTeam() {
    setBusyActionId("create");
    try {
      const response = await apiFetch<{ team: TeamRecord }>("/api/teams", {
        method: "POST",
        body: {
          name: newTeamName.trim() || "New Team",
        },
      });
      // Navigate immediately to the new team
      setNavigatingId(response.team.id);
      if (router) {
        router.push(`/teams/${response.team.id}`);
      }
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : "Failed to create team.",
      }));
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    setBusyActionId(teamId);
    try {
      await apiFetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });
      setState((previous) => ({
        ...previous,
        teams: previous.teams.filter((team) => team.id !== teamId),
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : "Failed to delete team.",
      }));
    } finally {
      setBusyActionId(null);
    }
  }

  if (state.loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="panel-dark rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-slate-100">Loading team builder...</p>
        </div>
      </main>
    );
  }

  if (!state.user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
        <section className="panel-dark w-full rounded-2xl p-6">
          <p className="mb-1 text-sm uppercase tracking-[0.2em] text-amber-300">Pok Team Builder</p>
          <h1 className="text-3xl font-semibold text-slate-100">Sign in</h1>
          <p className="mt-2 text-sm text-slate-300">
            Create an account to sync teams across desktop and mobile.
          </p>
          <div className="mt-4 flex rounded-xl border border-slate-700 bg-slate-900/70 p-1">
            <button
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                authMode === "login"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                authMode === "register"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
              onClick={() => setAuthMode("register")}
              type="button"
            >
              Register
            </button>
          </div>
          <form className="mt-5 space-y-3" onSubmit={handleAuthSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Email</span>
              <input
                autoComplete="email"
                className="input-dark w-full rounded-xl px-3 py-2 transition"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Password</span>
              <input
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                className="input-dark w-full rounded-xl px-3 py-2 transition"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button
              className="w-full rounded-xl bg-amber-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authBusy}
              type="submit"
            >
              {authBusy ? "Working..." : authMode === "login" ? "Login" : "Create Account"}
            </button>
            {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="panel-dark mb-6 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Pok Team Builder</p>
            <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Team Overview</h1>
            <p className="text-sm text-slate-300">{state.user.email}</p>
          </div>
          <button
            className="rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            disabled={busyActionId === "logout"}
            onClick={handleLogout}
            type="button"
          >
            {busyActionId === "logout" ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      <section className="panel-dark mb-6 rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Team Name</span>
            <input
              className="input-dark w-full rounded-xl px-3 py-2 transition"
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="Rain Offense"
              value={newTeamName}
            />
          </label>
          <button
            className="mt-6 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60 md:mt-[1.7rem]"
            disabled={busyActionId === "create"}
            onClick={handleCreateTeam}
            type="button"
          >
            {busyActionId === "create" ? "Creating..." : "+ New Team"}
          </button>
        </div>
        {state.error ? <p className="mt-3 text-sm text-rose-300">{state.error}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.teams.map((team) => (
          <article
            className={`panel-dark group relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-2xl p-4 transition-all hover:ring-2 hover:ring-amber-500/50 ${
              navigatingId === team.id ? "opacity-75 ring-2 ring-amber-500" : ""
            }`}
            key={team.id}
          >
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => {
                setNavigatingId(team.id);
                if (router) router.push(`/teams/${team.id}`);
              }}
            />
            {navigatingId === team.id ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              </div>
            ) : null}
            <div className="relative z-0">
              {team.format ? (
                <p className="text-xs uppercase tracking-[0.15em] text-amber-300">{team.format}</p>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-100">{team.name}</h2>
              <p className="text-sm text-slate-300">
                {team.data.members.length}/{team.maxSize} members
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {team.data.members.slice(0, 6).map((member, index) => (
                  <SpriteImage
                    alt={member.species || `slot-${index + 1}`}
                    className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-950/80 object-contain"
                    key={`${team.id}-preview-${member.id}-${index}`}
                    species={member.species}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Updated {new Date(team.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="relative z-20 mt-4 flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition group-hover:bg-amber-400">
                Open Team
              </div>
              <button
                className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                disabled={busyActionId === team.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTeam(team.id);
                }}
                type="button"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        <button
          className="panel-dark-soft flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-600 text-lg font-semibold text-slate-200 transition hover:bg-slate-800/60"
          onClick={handleCreateTeam}
          type="button"
        >
          + Create Team
        </button>
      </section>
    </main>
  );
}
