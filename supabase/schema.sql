-- HackXperience 2026 — Submissions Table
-- Run this in your Supabase dashboard: SQL Editor > New query

CREATE TABLE IF NOT EXISTS submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_token    UUID        UNIQUE NOT NULL DEFAULT gen_random_uuid(),

  -- Step 01: Identity
  project_name  TEXT        NOT NULL,
  team_id       INTEGER     NOT NULL UNIQUE CHECK (team_id >= 1),
  team_name     TEXT        NOT NULL UNIQUE,
  track         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  pitch         TEXT        NOT NULL,
  tech_stack    TEXT[]      NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,

  -- Step 02: Assets
  github_repo_url       TEXT NOT NULL,
  live_demo_url         TEXT,
  pitch_deck_share_url  TEXT NOT NULL,
  pitch_deck_upload_url TEXT,
  demo_video_url        TEXT,

  -- Step 03: Team manifest (stored as JSON array)
  members JSONB NOT NULL DEFAULT '[]',
  notes   TEXT,

  -- Admin
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- Timestamps
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_edit_token ON submissions(edit_token);
CREATE INDEX IF NOT EXISTS idx_submissions_team_id           ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team_name         ON submissions(team_name);
CREATE INDEX IF NOT EXISTS idx_submissions_status            ON submissions(status);

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_updated_at ON submissions;
CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- The base table is server-only. All create/read/update of full submission rows
-- goes through the API routes (app/api/submissions/*), which use the
-- service-role key and bypass RLS. With NO policies for the anon/authenticated
-- roles, RLS denies them by default — so the public anon key (shipped in the
-- browser) can never read member emails, edit tokens, notes, or pending/rejected
-- rows directly. Storage uploads use separate Storage bucket policies.
--
-- Drop the previous permissive policies in case an older version of this schema
-- was already applied (they granted anon full SELECT/UPDATE over every row).
DROP POLICY IF EXISTS "Public can insert"          ON submissions;
DROP POLICY IF EXISTS "Public can read by token"   ON submissions;
DROP POLICY IF EXISTS "Public can update by token" ON submissions;

-- Public gallery feed: a safe projection of APPROVED submissions only, with no
-- PII (no members, edit_token, notes, or pitch decks). The gallery page reads
-- this view with the anon key instead of the base table.
--
-- The view runs with its owner's privileges (it is NOT security_invoker), so it
-- can read the base table even though anon has no direct access to it.
CREATE OR REPLACE VIEW public_projects AS
  SELECT
    id,
    project_name,
    team_id,
    team_name,
    description,
    pitch,
    tech_stack,
    thumbnail_url,
    github_repo_url,
    live_demo_url,
    demo_video_url,
    submitted_at
  FROM submissions
  WHERE status = 'APPROVED';

GRANT SELECT ON public_projects TO anon, authenticated;

-- Community favourites voting
CREATE TABLE IF NOT EXISTS community_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  source_team_id INTEGER NOT NULL,
  voter_name TEXT NOT NULL,
  voter_email TEXT NOT NULL UNIQUE,
  voted_submission_ids UUID[] NOT NULL CHECK (cardinality(voted_submission_ids) = 3),
  created_by_admin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_vote_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES community_ballots(id) ON DELETE CASCADE,
  voted_submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ballot_id, voted_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_community_ballots_source_submission_id
  ON community_ballots(source_submission_id);
CREATE INDEX IF NOT EXISTS idx_community_vote_entries_submission_id
  ON community_vote_entries(voted_submission_id);

ALTER TABLE community_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_vote_entries ENABLE ROW LEVEL SECURITY;
-- ───────────────────────────────────────────────────────────────────────────
-- Sponsor portal (applied remotely as migration: sponsor_portal_schema)
-- ───────────────────────────────────────────────────────────────────────────

-- Allow SPONSOR in user_roles (DB stores uppercase ADMIN | JUDGE | SPONSOR)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['ADMIN'::text, 'JUDGE'::text, 'SPONSOR'::text]));

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS uses_microsoft_foundry boolean NOT NULL DEFAULT false;

ALTER TABLE judges_scores
  ADD COLUMN IF NOT EXISTS entrepreneurship smallint;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS entrepreneurship_value smallint NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS sponsor_scores (
  sponsor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  award text NOT NULL CHECK (award IN ('entrepreneurial', 'microsoft_foundry')),
  score smallint NOT NULL CHECK (score >= 0 AND score <= 100),
  private_comment text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sponsor_id, submission_id, award)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_scores_award_score
  ON sponsor_scores (award, score DESC);

ALTER TABLE sponsor_scores ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: access only via service-role API routes.

-- ───────────────────────────────────────────────────────────────────────────
-- Post-submission feedback survey (highly recommended, non-blocking)
-- ───────────────────────────────────────────────────────────────────────────
-- NOTE: submissions.team_id is TEXT (confirmed live schema) — see the FK below.
CREATE TABLE IF NOT EXISTS survey_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       TEXT NOT NULL REFERENCES submissions(team_id) ON DELETE CASCADE,
  answers       JSONB NOT NULL DEFAULT '{}',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_team_id ON survey_responses(team_id);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: writes go through POST /api/survey
-- (service-role key, bypasses RLS) — same posture as submissions/community_ballots.

