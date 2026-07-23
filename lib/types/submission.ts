// Canonical domain types for HackXperience submissions.
// Single source of truth — keep in sync with supabase/schema.sql.

/** Hackathon tracks (canonical list shown across the portals). */
import { HACKX_SUBMISSION_TRACKS } from "../hackathon-content";

export const HACKX_TRACKS = HACKX_SUBMISSION_TRACKS;
export type HackxTrack = (typeof HACKX_SUBMISSION_TRACKS)[number];

/** A single team member on a submission. */
export type TeamMember = {
  id?: string;
  name: string;
  studentId?: string;
  university?: string;
  role?: string;
  email: string;
};

export type CommunityVotingTeam = {
  submissionId: string;
  teamId: string;
  projectName: string;
  track: string;
  thumbnailUrl: string | null;
  members: TeamMember[];
};

export type CommunityVotingLeaderboardEntry = {
  submissionId: string;
  teamId: string;
  projectName: string;
  voteCount: number;
  rank: number;
  thumbnailUrl: string | null;
};

/** One judge's score for a submission (null = not yet scored). */
export type SubmissionScore = {
  judgeId: string;
  score: number | null;
  // Individual scoring criteria — populated by the admin API, absent in mock data.
  technicalExecution?: number | null;
  problemSolutionFit?: number | null;
  innovationCreativity?: number | null;
  presentationQuality?: number | null;
  entrepreneurship?: number | null;
  comments?: string | null;
};

/**
 * Status as stored in the database (see the CHECK constraint in schema.sql).
 * NOTE: the admin mock data + UI currently use the lowercase `SubmissionStatus`
 * below. The two should be reconciled when the admin views are wired to real
 * data; they are kept separate here so neither side has to change today.
 */
export type DbSubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Status values used by the admin mock data + UI (lowercase — see note above). */
export type SubmissionStatus = "pending" | "approved" | "rejected";

/**
 * Raw snake_case row from the `submissions` table — the shape returned by
 * Supabase before mapping to the camelCase {@link Submission}.
 */
export interface SubmissionRow {
  id: string;
  edit_token: string;
  status: DbSubmissionStatus;
  submitted_at: string;
  updated_at: string;
  is_draft?: boolean | null;
  project_name: string;
  team_id: string;
  track: string;
  description: string;
  pitch: string;
  tech_stack: string[];
  thumbnail_url: string | null;
  github_repo_url: string;
  live_demo_url: string | null;
  pitch_deck_share_url: string;
  pitch_deck_upload_url: string | null;
  demo_video_url: string | null;
  members: TeamMember[];
  notes: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  lead_email?: string | null;
}

/**
 * Canonical submission record — the camelCase shape returned by the submission
 * API (app/api/submissions/[token]) and consumed by the submit form. This is
 * the authoritative client-facing representation of a submission.
 */
export interface Submission {
  id: string;
  editToken: string;
  status: DbSubmissionStatus;
  isDraft?: boolean;
  submittedAt: string;
  updatedAt: string;
  // Identity
  projectName: string;
  teamId: string;
  track: string;
  description: string;
  pitch: string;
  techStack: string[];
  thumbnailUrl: string | null;
  // Assets
  githubRepoUrl: string;
  liveDemoUrl: string;
  pitchDeckShareUrl: string;
  pitchDeckUploadUrl: string | null;
  demoVideoUrl: string;
  // Team
  members: TeamMember[];
  notes: string;
}

/**
 * Judge portal view-model — the project information a judge sees while scoring.
 * Like {@link AdminSubmission}, this predates the canonical {@link Submission}
 * and uses its own field names; align it when wiring the judge views to real data.
 */
export interface JudgeProject {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  thumbnailUrl?: string | null;
  category: string;
  track: string;
  description: string;
  pitch: string;
  techStack: string[];
  githubUrl: string;
  liveUrl: string | null;
  pitchDeckUrl: string;
  pitchDeckFileUrl: string | null;
  videoDemoUrl: string | null;
  members: TeamMember[];
  notes: string | null;
  submittedAt: string;
  updatedAt: string;
}

/**
 * Admin dashboard view-model — a denormalised view of a submission with
 * aggregate judge scores, used by the admin portal screens + mock data.
 * Distinct from {@link Submission}: it predates the canonical shape and uses
 * its own field names; align it when wiring the admin views to real data.
 */
export type AdminSubmission = {
  id: string;
  projectName: string;
  teamName: string;
  thumbnailUrl?: string | null;
  track: string;
  status: SubmissionStatus;
  submittedAt: string;
  scores: SubmissionScore[];
  // Detail overlay fields
  teamId?: string;
  updatedAt?: string;
  projectAccessKey?: string;
  description?: string;
  shortPitch?: string;
  techStack?: string[];
  githubUrl?: string;
  liveUrl?: string | null;
  pitchDeckUrl?: string;
  pitchDeckFileUrl?: string | null;
  videoDemoUrl?: string | null;
  members?: TeamMember[];
  additionalNotes?: string | null;
  leadEmail?: string | null;
};
