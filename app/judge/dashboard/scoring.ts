// Scoring rubric + helpers for the judge dashboard.
import type { ScoreEntry } from "./types";

export const CRITERIA = [
  { key: "techExec",        label: "Technical Execution",     max: 20 },
  { key: "problemSolution", label: "Problem-Solution Fit",    max: 20 },
  { key: "innovation",      label: "Innovation + Creativity", max: 30 },
  { key: "presentation",    label: "Presentation Quality",    max: 20 },
  { key: "entrepreneurship",label: "Entrepreneurship",        max: 10 },
] as const;

export type CriterionKey = typeof CRITERIA[number]["key"];
export type ScoringCriterion = {
  key: CriterionKey;
  label: string;
  max: number;
};

export function makeBlankScore(): ScoreEntry {
  return { techExec: "", problemSolution: "", innovation: "", presentation: "", entrepreneurship: "", comment: "", saved: false, savedTotal: 0 };
}

export function isFieldInvalid(value: string, max: number): boolean {
  if (!value.trim()) return false;
  const n = Number(value);
  return isNaN(n) || n < 0 || n > max || !Number.isInteger(n);
}

export function calcLiveTotal(score: ScoreEntry, criteria: readonly ScoringCriterion[] = CRITERIA): number {
  return criteria.reduce((sum, c) => {
    const v = parseInt(score[c.key as CriterionKey]);
    return sum + (isNaN(v) || isFieldInvalid(score[c.key as CriterionKey], c.max) ? 0 : v);
  }, 0);
}

export function calcMaxTotal(criteria: readonly ScoringCriterion[] = CRITERIA): number {
  return criteria.reduce((sum, criterion) => sum + Math.max(0, Math.round(criterion.max)), 0);
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      .toUpperCase();
  } catch { return iso; }
}
