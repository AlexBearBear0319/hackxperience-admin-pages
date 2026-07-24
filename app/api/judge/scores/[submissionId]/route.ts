import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import { totalScore, type JudgeScoreRow } from "@/lib/server/portal-data";
import { insertSubmissionLog } from "@/lib/server/activity-log";
import {
  type JudgeScoresIdColumn,
  normalizeJudgeScoreRows,
  resolveJudgeActorCandidates,
  resolveJudgeScoresIdColumns,
  selectJudgeScoresColumns,
} from "@/lib/server/judge-scores";
import {
  CRITERION_SCORE_MAX,
  DEFAULT_CRITERION_WEIGHTS,
  parseCriterionWeights,
} from "@/lib/scoring";

type RouteContext = {
  params: Promise<{ submissionId: string }>;
};

type SettingsRow = {
  technical_execution_value: number;
  problem_solution_fit_value: number;
  innovation_creativity_value: number;
  presentation_quality_value: number;
  entrepreneurship_value: number;
};

function parseCriterion(value: unknown, max: number = CRITERION_SCORE_MAX): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) return "invalid";
  return n;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

  const { submissionId } = await params;
  const body = await request.json().catch(() => null);

  const settingsResult = await supabaseServer
    .from("settings")
    .select("technical_execution_value,problem_solution_fit_value,innovation_creativity_value,presentation_quality_value,entrepreneurship_value")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle<SettingsRow>();

  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  const weights = parseCriterionWeights(settingsResult.data, DEFAULT_CRITERION_WEIGHTS);

  // Each criterion is scored 0–100; settings values are weights for the total.
  const technicalExecution = parseCriterion(body?.techExec);
  const problemSolutionFit = parseCriterion(body?.problemSolution);
  const innovationCreativity = parseCriterion(body?.innovation);
  const presentationQuality = parseCriterion(body?.presentation);
  const entrepreneurship = parseCriterion(body?.entrepreneurship);
  const privateComment =
    typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  if (
    technicalExecution === "invalid" ||
    problemSolutionFit === "invalid" ||
    innovationCreativity === "invalid" ||
    presentationQuality === "invalid" ||
    entrepreneurship === "invalid"
  ) {
    return NextResponse.json({ error: "Invalid score payload." }, { status: 400 });
  }

  const submissionCheck = await supabaseServer
    .from("submissions")
    .select("id,status,project_name")
    .eq("id", submissionId)
    .maybeSingle<{ id: string; status: string; project_name: string | null }>();

  if (submissionCheck.error) {
    return NextResponse.json({ error: submissionCheck.error.message }, { status: 500 });
  }
  if (!submissionCheck.data || submissionCheck.data.status !== "APPROVED") {
    return NextResponse.json({ error: "Submission is not available for scoring." }, { status: 404 });
  }

  let actorCandidates: Awaited<ReturnType<typeof resolveJudgeActorCandidates>>;
  try {
    actorCandidates = await resolveJudgeActorCandidates({
      sessionUserId: auth.session.userId,
      sessionUsername: auth.session.username,
      createLegacyIfMissing: true,
    });
  } catch (actorError) {
    return NextResponse.json(
      { error: actorError instanceof Error ? actorError.message : "Unable to resolve judge identity." },
      { status: 500 },
    );
  }

  async function upsertForActorId(column: JudgeScoresIdColumn, actorId: string | number) {
    return supabaseServer
      .from("judges_scores")
      .upsert(
        {
          [column]: actorId,
          submission_id: submissionId,
          technical_execution: technicalExecution,
          problem_solution_fit: problemSolutionFit,
          innovation_creativity: innovationCreativity,
          presentation_quality: presentationQuality,
          entrepreneurship: entrepreneurship,
          private_comment: privateComment,
        },
        { onConflict: `${column},submission_id` },
      )
      .select(selectJudgeScoresColumns(column))
      .single<Record<string, unknown>>();
  }

  const actorIds = actorCandidates.candidates;
  let savedRow: JudgeScoreRow | null = null;
  let lastErrorMessage = "Unable to save score.";

  for (const judgeScoreIdColumn of judgeScoreIdColumns) {
    for (const actorId of actorIds) {
      const { data, error } = await upsertForActorId(judgeScoreIdColumn, actorId);

      if (error) {
        lastErrorMessage = error.message || lastErrorMessage;
        continue;
      }

      const normalized = normalizeJudgeScoreRows(data ? [data] : [], judgeScoreIdColumn);
      const row = normalized[0] as JudgeScoreRow | undefined;
      if (row) {
        savedRow = row;
        break;
      }
    }

    if (savedRow) break;
  }

  if (!savedRow) {
    return NextResponse.json({ error: lastErrorMessage }, { status: 500 });
  }

  const scoreTotal = totalScore(savedRow, weights);

  void insertSubmissionLog({
    submissionId,
    action: "SCORED",
    performedBy: auth.session.username,
    note: `Judge ${auth.session.username} scored project ${submissionCheck.data.project_name ?? submissionId}`,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    total: scoreTotal,
  });
}
