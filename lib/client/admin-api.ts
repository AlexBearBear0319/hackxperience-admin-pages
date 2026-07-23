"use client";

import type { AdminSubmission, CommunityVotingLeaderboardEntry, CommunityVotingTeam } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type AdminSubmissionsPayload = {
  submissions: AdminSubmission[];
  judgeIds: string[];
  session?: {
    username?: string;
    role?: string;
  };
};

export type AdminSettingsRow = {
  id: number;
  submission_status: boolean;
  resubmission_status: boolean;
  max_team_size: number;
  max_file_size: number;
  deadline: string;
  active_tracks: string[] | null;
  technical_execution_value: number;
  problem_solution_fit_value: number;
  innovation_creativity_value: number;
  presentation_quality_value: number;
  entrepreneurship_value: number;
  updated_at: string;
};

export type AdminJudge = {
  id: string;
  username: string;
  last_login?: string | null;
};

export type CommunityVotingMember = CommunityVotingTeam["members"][number] & {
  hasVoted: boolean;
};

export type CommunityVotingTeamPayload = Omit<CommunityVotingTeam, "members"> & {
  members: CommunityVotingMember[];
};

export type CommunityVotingBallot = {
  id: string;
  sourceTeamId: string;
  voterName: string;
  voterEmail: string;
  createdByAdmin: string;
  createdAt: string;
  votedTeams: Array<{
    submissionId: string;
    teamId: string;
    projectName: string;
  }>;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function handleResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(payload.error ?? fallback);
  }
  return parseJson<T>(response);
}

async function requireAccessToken() {
  const { data, error } = await supabaseBrowser.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Supabase session missing. Please log in again.");
  }
  return accessToken;
}

export async function fetchAdminSubmissions() {
  const response = await fetch("/api/admin/submissions", { cache: "no-store" });
  return handleResponse<AdminSubmissionsPayload>(response, "Unable to load submissions.");
}

export async function updateAdminSubmission(id: string, updates: Record<string, unknown>) {
  const response = await fetch(`/api/admin/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse<{ ok: boolean }>(response, "Unable to update submission.");
}

export async function deleteAdminSubmission(id: string) {
  const response = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
  return handleResponse<{ ok: boolean }>(response, "Unable to delete submission.");
}

export async function fetchAdminSettings() {
  const response = await fetch("/api/admin/settings", { cache: "no-store" });
  return handleResponse<{ settings: AdminSettingsRow | null }>(response, "Unable to load settings.");
}

export async function updateAdminSettings(updates: Partial<AdminSettingsRow>) {
  const accessToken = await requireAccessToken();
  const response = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });
  return handleResponse<{ settings: AdminSettingsRow }>(response, "Unable to save settings.");
}

export async function fetchAdminJudges() {
  const response = await fetch("/api/admin/judges", { cache: "no-store" });
  return handleResponse<{ judges: AdminJudge[] }>(response, "Unable to load judges.");
}

export async function createAdminJudge(payload: { username: string; password: string }) {
  const response = await fetch("/api/admin/judges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ judge: AdminJudge }>(response, "Unable to create judge.");
}

export async function updateAdminJudge(id: string, payload: { username?: string; password?: string }) {
  const response = await fetch(`/api/admin/judges/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ judge: AdminJudge }>(response, "Unable to update judge.");
}

export async function deleteAdminJudge(id: string) {
  const response = await fetch(`/api/admin/judges/${encodeURIComponent(id)}`, { method: "DELETE" });
  return handleResponse<{ ok: boolean }>(response, "Unable to delete judge.");
}

export async function fetchAdminVotingTeams() {
  const response = await fetch("/api/admin/voting", { cache: "no-store" });
  return handleResponse<{
    mode: "admin" | "kiosk";
    teams: CommunityVotingTeamPayload[];
    ballots: CommunityVotingBallot[];
  }>(
    response,
    "Unable to load eligible voting teams.",
  );
}

export async function submitCommunityVote(payload: {
  sourceTeamId: string;
  voterEmail: string;
  votedSubmissionIds: string[];
}) {
  const response = await fetch("/api/admin/voting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ ok: boolean }>(response, "Unable to submit community vote.");
}

export async function fetchCommunityVotingLeaderboard() {
  const response = await fetch("/api/community-voting/leaderboard", { cache: "no-store" });
  return handleResponse<{ leaderboard: CommunityVotingLeaderboardEntry[] }>(
    response,
    "Unable to load community leaderboard.",
  );
}
