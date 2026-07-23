import "server-only";

export const SPONSOR_AWARDS = ["entrepreneurial", "microsoft_foundry"] as const;
export type SponsorAward = (typeof SPONSOR_AWARDS)[number];

export function isSponsorAward(value: unknown): value is SponsorAward {
  return typeof value === "string" && (SPONSOR_AWARDS as readonly string[]).includes(value);
}

/** Judge criterion used to order booth roaming for each award tab. */
export function roamCriterionForAward(
  award: SponsorAward,
): "entrepreneurship" | "technical_execution" {
  return award === "entrepreneurial" ? "entrepreneurship" : "technical_execution";
}

export function parseSponsorScore(value: unknown): number | "invalid" {
  if (value === null || value === undefined || value === "") return "invalid";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) return "invalid";
  return n;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export type SponsorScoreRow = {
  submission_id: string;
  award: string;
  score: number;
  private_comment: string | null;
  updated_at: string;
};

/**
 * Rank scored teams: higher score wins; equal scores → more recent updated_at ranks higher.
 * Returns a map of submission_id → 1-based rank (only for teams with a sponsor score).
 */
export function rankSponsorScores(rows: SponsorScoreRow[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = Date.parse(a.updated_at) || 0;
    const bTime = Date.parse(b.updated_at) || 0;
    return bTime - aTime;
  });

  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    ranks.set(row.submission_id, index + 1);
  });
  return ranks;
}

/** Sort by judge avg desc, nulls last. Stable secondary: project name. */
export function compareJudgeAvgDesc(
  a: { judgeAvg: number | null; projectName: string },
  b: { judgeAvg: number | null; projectName: string },
) {
  if (a.judgeAvg == null && b.judgeAvg == null) {
    return a.projectName.localeCompare(b.projectName);
  }
  if (a.judgeAvg == null) return 1;
  if (b.judgeAvg == null) return -1;
  if (b.judgeAvg !== a.judgeAvg) return b.judgeAvg - a.judgeAvg;
  return a.projectName.localeCompare(b.projectName);
}

export type TrackPlace = 1 | 2;

/**
 * Per-track winner (1) and runner-up (2) from overall weighted judge averages.
 * Only submissions with a numeric overall avg are considered. Ties break by
 * project name, then id, so places are unique and deterministic.
 */
export function rankTrackPlaces(
  projects: Array<{
    id: string;
    track: string;
    projectName: string;
    overallJudgeAvg: number | null;
  }>,
): Map<string, TrackPlace> {
  const byTrack = new Map<string, typeof projects>();
  for (const project of projects) {
    if (project.overallJudgeAvg == null) continue;
    const track = project.track.trim() || "Open Innovation";
    const list = byTrack.get(track) ?? [];
    list.push(project);
    byTrack.set(track, list);
  }

  const places = new Map<string, TrackPlace>();
  for (const list of byTrack.values()) {
    const sorted = [...list].sort((a, b) => {
      const aAvg = a.overallJudgeAvg!;
      const bAvg = b.overallJudgeAvg!;
      if (bAvg !== aAvg) return bAvg - aAvg;
      const byName = a.projectName.localeCompare(b.projectName);
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
    if (sorted[0]) places.set(sorted[0].id, 1);
    if (sorted[1]) places.set(sorted[1].id, 2);
  }
  return places;
}
