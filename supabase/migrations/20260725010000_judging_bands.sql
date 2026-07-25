-- Judging score bands (detailed rubric). Content is seeded in production separately
-- so the public repo does not ship the full band prose.
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS judging_bands jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS judging_bands_version smallint NOT NULL DEFAULT 1;
