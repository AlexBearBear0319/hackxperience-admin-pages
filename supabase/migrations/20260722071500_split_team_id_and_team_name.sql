-- Split submissions.team_id (TEXT, actually a display name) into:
--   team_name TEXT  — human-readable team name
--   team_id   INT   — assigned numeric team number (e.g. mentoring slot #14)
--
-- Also aligns community_ballots.source_team_id to the new integer id.
-- Does NOT auto-map legacy junk rows to real mentoring numbers — those get
-- temporary ids in the 9000+ range so 1–99 stay free for real teams.

-- ── 1. Drop dependents that reference submissions.team_id ───────────────────
DROP VIEW IF EXISTS public.community_voting_leaderboard;

-- ── 2. Rename misnamed TEXT column → team_name ──────────────────────────────
ALTER TABLE public.submissions
  RENAME COLUMN team_id TO team_name;

ALTER TABLE public.submissions
  RENAME CONSTRAINT submissions_team_id_key TO submissions_team_name_key;

ALTER INDEX IF EXISTS idx_submissions_team_id
  RENAME TO idx_submissions_team_name;

-- ── 3. Add real integer team_id ─────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN team_id integer;

-- Legacy / test rows: park them in 9001+ so real team numbers stay available.
UPDATE public.submissions AS s
SET team_id = 9000 + ranked.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY submitted_at ASC, id ASC) AS rn
  FROM public.submissions
) AS ranked
WHERE s.id = ranked.id;

ALTER TABLE public.submissions
  ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_team_id_key UNIQUE (team_id);

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_team_id_positive CHECK (team_id >= 1);

CREATE INDEX idx_submissions_team_id ON public.submissions (team_id);

-- ── 4. community_ballots: TEXT name → integer team_id ───────────────────────
-- Preserve old values briefly so we can join on team_name.
ALTER TABLE public.community_ballots
  RENAME COLUMN source_team_id TO source_team_name;

ALTER TABLE public.community_ballots
  ADD COLUMN source_team_id integer;

UPDATE public.community_ballots AS b
SET source_team_id = s.team_id
FROM public.submissions AS s
WHERE s.team_name = b.source_team_name;

-- Any ballot whose source submission was deleted / unmatched should not remain.
-- Fail loudly if any rows couldn't be mapped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.community_ballots WHERE source_team_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'community_ballots.source_team_id backfill failed: unmatched source_team_name rows remain';
  END IF;
END $$;

ALTER TABLE public.community_ballots
  ALTER COLUMN source_team_id SET NOT NULL;

ALTER TABLE public.community_ballots
  DROP COLUMN source_team_name;

-- ── 5. Recreate leaderboard view with both identifiers ──────────────────────
CREATE OR REPLACE VIEW public.community_voting_leaderboard AS
  SELECT
    s.team_id,
    s.team_name,
    s.project_name,
    count(cvi.id) AS vote_count
  FROM community_vote_items cvi
  JOIN submissions s ON s.id = cvi.submission_id
  GROUP BY s.team_id, s.team_name, s.project_name
  ORDER BY count(cvi.id) DESC, s.team_id;

-- ── 6. Public gallery projection (safe APPROVED-only feed) ──────────────────
CREATE OR REPLACE VIEW public.public_projects AS
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

GRANT SELECT ON public.public_projects TO anon, authenticated;
