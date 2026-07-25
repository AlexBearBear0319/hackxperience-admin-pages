/**
 * Types + helpers for judge score bands.
 * Band prose lives in settings.judging_bands (DB) — not in this file.
 */

export type ScoreBand = {
  min: number;
  max: number;
  label: string;
};

export type JudgingBandsMap = Partial<
  Record<"innovation" | "techExec" | "problemSolution" | "presentation" | "entrepreneurship", ScoreBand[]>
>;

export type JudgingBandsPayload = {
  version: number;
  bands: JudgingBandsMap;
};

const CRITERION_KEYS = [
  "innovation",
  "techExec",
  "problemSolution",
  "presentation",
  "entrepreneurship",
] as const;

export function isScoreBand(value: unknown): value is ScoreBand {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.min === "number" &&
    typeof row.max === "number" &&
    typeof row.label === "string" &&
    Number.isFinite(row.min) &&
    Number.isFinite(row.max) &&
    row.min <= row.max
  );
}

/** Normalize DB/API JSON into a typed map; drops malformed rows. */
export function parseJudgingBands(raw: unknown): JudgingBandsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: JudgingBandsMap = {};

  for (const key of CRITERION_KEYS) {
    const list = src[key];
    if (!Array.isArray(list)) continue;
    const bands = list.filter(isScoreBand).map((b) => ({
      min: Math.round(b.min),
      max: Math.round(b.max),
      label: b.label.trim(),
    }));
    if (bands.length > 0) out[key] = bands;
  }

  return out;
}

/** Active band for a score. Score 0 / empty → null (bands start at 1). */
export function bandForScore(
  bands: ScoreBand[] | undefined,
  score: number,
): ScoreBand | null {
  if (!bands?.length || !Number.isFinite(score) || score <= 0) return null;
  return bands.find((b) => score >= b.min && score <= b.max) ?? null;
}

export function formatBandRange(band: ScoreBand): string {
  return `${band.min}–${band.max}`;
}
