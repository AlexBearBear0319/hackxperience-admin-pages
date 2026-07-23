import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import { mapSubmissionToJudgeProject, totalScore, type JudgeScoreRow } from "@/lib/server/portal-data";
import {
  isJudgeScoreActorIdError,
  type JudgeScoresIdColumn,
  normalizeJudgeScoreRows,
  resolveJudgeActorCandidates,
  resolveJudgeScoresIdColumns,
  selectJudgeScoresColumns,
} from "@/lib/server/judge-scores";
import type { SubmissionRow } from "@/lib/types";

type JudgeSavedScore = {
  technical_execution: number | null;
  problem_solution_fit: number | null;
  innovation_creativity: number | null;
  presentation_quality: number | null;
  entrepreneurship: number | null;
  private_comment: string | null;
  total: number | null;
};

export async function GET(request: NextRequest) {
  const auth = requireRole(request, "judge");
  if (!auth.ok) return auth.response;

  const roleCheck = await verifyRoleMapping({
    userRoleId: auth.session.userId,
    expectedRole: "judge",
  });
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
  }

  let judgeScoreIdColumns: Awaited<ReturnType<typeof resolveJudgeScoresIdColumns>>;
  try {
    judgeScoreIdColumns = await resolveJudgeScoresIdColumns();
  } catch (columnError) {
    return NextResponse.json(
      { error: columnError instanceof Error ? columnError.message : "Unable to resolve judge score column." },
      { status: 500 },
    );
  }

  let actorCandidates: Awaited<ReturnType<typeof resolveJudgeActorCandidates>>;
  try {
    actorCandidates = await resolveJudgeActorCandidates({
      sessionUserId: auth.session.userId,
      sessionUsername: auth.session.username,
      createLegacyIfMissing: false,
    });
  } catch (actorError) {
    return NextResponse.json(
      { error: actorError instanceof Error ? actorError.message : "Unable to resolve judge identity." },
      { status: 500 },
    );
  }

  async function selectScoresByActorId(column: JudgeScoresIdColumn, actorId: string | number) {
    return supabaseServer
      .from("judges_scores")
      .select(selectJudgeScoresColumns(column))
      .eq(column, actorId);
  }

  const [submissionsResult, settingsResult] = await Promise.all([
    supabaseServer
      .from("submissions")
      .select("*")
      .eq("status", "APPROVED")
      .order("submitted_at", { ascending: false }),
    supabaseServer
      .from("settings")
      .select("submission_status")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle<{ submission_status: boolean }>(),
  ]);

  if (submissionsResult.error) {
    return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
  }
  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  let anyScoreQuerySucceeded = false;
  let lastScoreQueryError = "";
  const scoreRowsBySubmission = new Map<string, JudgeScoreRow>();

  for (const judgeScoreIdColumn of judgeScoreIdColumns) {
    for (const actorId of actorCandidates.candidates) {
      const scoresResult = await selectScoresByActorId(judgeScoreIdColumn, actorId);

      if (scoresResult.error) {
        if (isJudgeScoreActorIdError(scoresResult.error)) {
          lastScoreQueryError = scoresResult.error.message || lastScoreQueryError;
          continue;
        }

        return NextResponse.json({ error: scoresResult.error.message }, { status: 500 });
      }

      anyScoreQuerySucceeded = true;
      const normalizedRows = normalizeJudgeScoreRows(
        (scoresResult.data ?? []) as unknown as Record<string, unknown>[],
        judgeScoreIdColumn,
      ) as JudgeScoreRow[];

      for (const row of normalizedRows) {
        if (!scoreRowsBySubmission.has(row.submission_id)) {
          scoreRowsBySubmission.set(row.submission_id, row);
        }
      }
    }
  }

  if (!anyScoreQuerySucceeded && lastScoreQueryError) {
    return NextResponse.json({ error: lastScoreQueryError }, { status: 500 });
  }

  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const scoreRows = Array.from(scoreRowsBySubmission.values());
  const savedScores: Record<string, JudgeSavedScore> = {};

  for (const row of scoreRows) {
    savedScores[row.submission_id] = {
      technical_execution: row.technical_execution,
      problem_solution_fit: row.problem_solution_fit,
      innovation_creativity: row.innovation_creativity,
      presentation_quality: row.presentation_quality,
      entrepreneurship: row.entrepreneurship,
      private_comment: row.private_comment,
      total: totalScore(row),
    };
  }

  return NextResponse.json({
    projects: submissions.map(mapSubmissionToJudgeProject),
    savedScores,
    session: {
      username: auth.session.username,
      role: auth.session.role,
    },
    submissionStatusOpen: settingsResult.data?.submission_status ?? true,
  });
}
