// Scoring rubric + helpers for the judge dashboard.
import type { ScoreEntry } from "./types";
import {
  CRITERION_SCORE_MAX,
  DEFAULT_CRITERION_WEIGHTS,
  weightedCriterionTotal,
} from "@/lib/scoring";

export const CRITERIA = [
  { key: "techExec",         label: "Technical Execution",     weight: DEFAULT_CRITERION_WEIGHTS.technical_execution,  max: CRITERION_SCORE_MAX },
  { key: "problemSolution",  label: "Problem-Solution Fit",    weight: DEFAULT_CRITERION_WEIGHTS.problem_solution_fit, max: CRITERION_SCORE_MAX },
  { key: "innovation",       label: "Innovation + Creativity", weight: DEFAULT_CRITERION_WEIGHTS.innovation_creativity, max: CRITERION_SCORE_MAX },
  { key: "presentation",     label: "Presentation Quality",    weight: DEFAULT_CRITERION_WEIGHTS.presentation_quality, max: CRITERION_SCORE_MAX },
  { key: "entrepreneurship", label: "Entrepreneurship",        weight: DEFAULT_CRITERION_WEIGHTS.entrepreneurship,     max: CRITERION_SCORE_MAX },
] as const;

export type CriterionKey = typeof CRITERIA[number]["key"];
export type ScoringCriterion = {
  key: CriterionKey;
  label: string;
  /** Rubric weight from settings (e.g. 20 for 20%). */
  weight: number;
  /** Input max — always 100. */
  max: number;
};

export function makeBlankScore(): ScoreEntry {
  return { techExec: "", problemSolution: "", innovation: "", presentation: "", entrepreneurship: "", comment: "", saved: false, savedTotal: 0 };
}

export function isFieldInvalid(value: string, max: number = CRITERION_SCORE_MAX): boolean {
  if (!value.trim()) return false;
  const n = Number(value);
  return isNaN(n) || n < 0 || n > max || !Number.isInteger(n);
}

/** Weighted live total: Σ (score/100 × weight). */
export function calcLiveTotal(score: ScoreEntry, criteria: readonly ScoringCriterion[] = CRITERIA): number {
  const byKey = Object.fromEntries(criteria.map((c) => [c.key, c])) as Record<CriterionKey, ScoringCriterion>;

  return weightedCriterionTotal(
    {
      technical_execution: parseField(score.techExec, byKey.techExec?.max ?? CRITERION_SCORE_MAX),
      problem_solution_fit: parseField(score.problemSolution, byKey.problemSolution?.max ?? CRITERION_SCORE_MAX),
      innovation_creativity: parseField(score.innovation, byKey.innovation?.max ?? CRITERION_SCORE_MAX),
      presentation_quality: parseField(score.presentation, byKey.presentation?.max ?? CRITERION_SCORE_MAX),
      entrepreneurship: parseField(score.entrepreneurship, byKey.entrepreneurship?.max ?? CRITERION_SCORE_MAX),
    },
    {
      technical_execution: byKey.techExec?.weight ?? 0,
      problem_solution_fit: byKey.problemSolution?.weight ?? 0,
      innovation_creativity: byKey.innovation?.weight ?? 0,
      presentation_quality: byKey.presentation?.weight ?? 0,
      entrepreneurship: byKey.entrepreneurship?.weight ?? 0,
    },
  ) ?? 0;
}

function parseField(value: string, max: number): number | null {
  if (!value.trim() || isFieldInvalid(value, max)) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/** Overall max = sum of weights (typically 100). */
export function calcMaxTotal(criteria: readonly ScoringCriterion[] = CRITERIA): number {
  return criteria.reduce((sum, criterion) => sum + Math.max(0, Math.round(criterion.weight)), 0);
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      .toUpperCase();
  } catch { return iso; }
}
