/**
 * Shared judge scoring math.
 *
 * Judges enter each criterion as 0–100. Settings `*_value` columns are weights
 * (e.g. 20/20/30/20/10). Weighted total = Σ (scoreᵢ / 100 × weightᵢ).
 */

export const CRITERION_SCORE_MAX = 100;

export type CriterionWeights = {
  technical_execution: number;
  problem_solution_fit: number;
  innovation_creativity: number;
  presentation_quality: number;
  entrepreneurship: number;
};

export const DEFAULT_CRITERION_WEIGHTS: CriterionWeights = {
  technical_execution: 20,
  problem_solution_fit: 20,
  innovation_creativity: 30,
  presentation_quality: 20,
  entrepreneurship: 10,
};

export type CriterionScoreFields = {
  technical_execution?: number | null;
  problem_solution_fit?: number | null;
  innovation_creativity?: number | null;
  presentation_quality?: number | null;
  entrepreneurship?: number | null;
};

export function weightsTotal(weights: CriterionWeights): number {
  return (
    Math.max(0, weights.technical_execution) +
    Math.max(0, weights.problem_solution_fit) +
    Math.max(0, weights.innovation_creativity) +
    Math.max(0, weights.presentation_quality) +
    Math.max(0, weights.entrepreneurship)
  );
}

/** Display maxima for raw criterion scores (always /100) + overall weighted max. */
export function criterionDisplayMaxima(weights: CriterionWeights = DEFAULT_CRITERION_WEIGHTS) {
  return {
    technical: CRITERION_SCORE_MAX,
    problem: CRITERION_SCORE_MAX,
    innovation: CRITERION_SCORE_MAX,
    presentation: CRITERION_SCORE_MAX,
    entrepreneurship: CRITERION_SCORE_MAX,
    overall: weightsTotal(weights),
  };
}

export function parseCriterionWeights(
  raw:
    | {
        technical_execution_value?: number | null;
        problem_solution_fit_value?: number | null;
        innovation_creativity_value?: number | null;
        presentation_quality_value?: number | null;
        entrepreneurship_value?: number | null;
      }
    | null
    | undefined,
  fallback: CriterionWeights = DEFAULT_CRITERION_WEIGHTS,
): CriterionWeights {
  const pick = (value: number | null | undefined, fb: number) =>
    Math.max(0, Math.round(typeof value === "number" ? value : fb));

  return {
    technical_execution: pick(raw?.technical_execution_value, fallback.technical_execution),
    problem_solution_fit: pick(raw?.problem_solution_fit_value, fallback.problem_solution_fit),
    innovation_creativity: pick(raw?.innovation_creativity_value, fallback.innovation_creativity),
    presentation_quality: pick(raw?.presentation_quality_value, fallback.presentation_quality),
    entrepreneurship: pick(raw?.entrepreneurship_value, fallback.entrepreneurship),
  };
}

/**
 * Weighted overall from raw 0–100 criterion scores.
 * Missing criteria contribute 0; returns null if nothing was scored.
 */
export function weightedCriterionTotal(
  scores: CriterionScoreFields | null | undefined,
  weights: CriterionWeights = DEFAULT_CRITERION_WEIGHTS,
): number | null {
  if (!scores) return null;

  const pairs: Array<[number | null | undefined, number]> = [
    [scores.technical_execution, weights.technical_execution],
    [scores.problem_solution_fit, weights.problem_solution_fit],
    [scores.innovation_creativity, weights.innovation_creativity],
    [scores.presentation_quality, weights.presentation_quality],
    [scores.entrepreneurship, weights.entrepreneurship],
  ];

  let sum = 0;
  let hasAny = false;
  for (const [value, weight] of pairs) {
    if (typeof value !== "number") continue;
    hasAny = true;
    sum += (value / CRITERION_SCORE_MAX) * Math.max(0, weight);
  }

  if (!hasAny) return null;
  return Math.round(sum * 100) / 100;
}
