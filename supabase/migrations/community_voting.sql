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
