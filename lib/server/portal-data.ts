import "server-only";

import type {
  AdminSubmission,
  DbSubmissionStatus,
  JudgeProject,
  SubmissionScore,
  SubmissionStatus,
  SubmissionRow,
  TeamMember,
} from "@/lib/types";
import {
  DEFAULT_CRITERION_WEIGHTS,
  weightedCriterionTotal,
  type CriterionWeights,
} from "@/lib/scoring";

export type { CriterionWeights };
export { DEFAULT_CRITERION_WEIGHTS };

export type JudgeIdentifier = number | string;

export type JudgeRow = {
  id: JudgeIdentifier;
  username: string;
};

export type JudgeScoreRow = {
  judges_id: JudgeIdentifier;
  submission_id: string;
  technical_execution: number | null;
  problem_solution_fit: number | null;
  innovation_creativity: number | null;
  presentation_quality: number | null;
  entrepreneurship: number | null;
  private_comment: string | null;
};

const statusToUi: Record<DbSubmissionStatus, SubmissionStatus> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const statusToDb: Record<SubmissionStatus, DbSubmissionStatus> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

function normalizeTeamMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as {
        id?: unknown;
        name?: unknown;
        studentId?: unknown;
        university?: unknown;
        role?: unknown;
        email?: unknown;
      };
      if (typeof row.name !== "string" || typeof row.email !== "string") return null;

      const member: TeamMember = {
        name: row.name,
        email: row.email,
      };

      if (typeof row.id === "string" && row.id.trim()) member.id = row.id;
      if (typeof row.studentId === "string" && row.studentId.trim()) member.studentId = row.studentId;
      if (typeof row.university === "string" && row.university.trim()) member.university = row.university;
      if (typeof row.role === "string" && row.role.trim()) member.role = row.role;

      return member;
    })
    .filter((entry): entry is TeamMember => Boolean(entry));
}

function deriveTeamDisplayName(row: SubmissionRow): string {
  const members = normalizeTeamMembers(row.members);
  const first = members[0]?.name?.trim();
  if (first) {
    return members.length > 1 ? `${first} +${members.length - 1}` : first;
  }

  if (row.lead_email?.trim()) {
    return row.lead_email;
  }

  return row.team_id;
}

function cleanTrack(track: string) {
  return track?.trim() || "Open Innovation";
}

export function formatPortalDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Singapore",
    })
    .replace(",", "")
    .toUpperCase();
}

export function mapDbStatusToUi(status: DbSubmissionStatus): SubmissionStatus {
  return statusToUi[status];
}

export function mapUiStatusToDb(status: SubmissionStatus): DbSubmissionStatus {
  return statusToDb[status];
}

export function totalScore(
  score: JudgeScoreRow | undefined,
  weights: CriterionWeights = DEFAULT_CRITERION_WEIGHTS,
) {
  return weightedCriterionTotal(score, weights);
}

export function mapSubmissionToAdminView(
  row: SubmissionRow,
  scores: SubmissionScore[]
): AdminSubmission {
  const members = normalizeTeamMembers(row.members);

  return {
    id: row.id,
    projectName: row.project_name,
    teamName: deriveTeamDisplayName(row),
    thumbnailUrl: row.thumbnail_url,
    teamId: row.team_id,
    track: cleanTrack(row.track),
    status: mapDbStatusToUi(row.status),
    submittedAt: formatPortalDate(row.submitted_at),
    updatedAt: formatPortalDate(row.updated_at),
    projectAccessKey: row.edit_token,
    description: row.description,
    shortPitch: row.pitch,
    techStack: Array.isArray(row.tech_stack) ? row.tech_stack : [],
    githubUrl: row.github_repo_url,
    liveUrl: row.live_demo_url,
    pitchDeckUrl: row.pitch_deck_share_url,
    pitchDeckFileUrl: row.pitch_deck_upload_url,
    videoDemoUrl: row.demo_video_url,
    members,
    additionalNotes: row.notes,
    leadEmail: row.lead_email ?? null,
    scores,
  };
}

export function mapSubmissionToJudgeProject(row: SubmissionRow): JudgeProject {
  return {
    id: row.id,
    name: row.project_name,
    teamId: row.team_id,
    teamName: deriveTeamDisplayName(row),
    thumbnailUrl: row.thumbnail_url,
    category: cleanTrack(row.track),
    track: cleanTrack(row.track),
    description: row.description,
    pitch: row.pitch,
    techStack: Array.isArray(row.tech_stack) ? row.tech_stack : [],
    githubUrl: row.github_repo_url,
    liveUrl: row.live_demo_url,
    pitchDeckUrl: row.pitch_deck_share_url,
    pitchDeckFileUrl: row.pitch_deck_upload_url,
    videoDemoUrl: row.demo_video_url,
    members: normalizeTeamMembers(row.members),
    notes: row.notes,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}
