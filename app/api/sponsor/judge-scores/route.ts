import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import type { SubmissionRow } from "@/lib/types";
import { totalScore, type JudgeScoreRow } from "@/lib/server/portal-data";
import { isUuid, rankTrackPlaces, type TrackPlace } from "@/lib/server/sponsor-awards";

type JudgeCriterionRow = {
  submission_id: string;
  entrepreneurship: number | null;
  technical_execution: number | null;
  problem_solution_fit: number | null;
  innovation_creativity: number | null;
  presentation_quality: number | null;
};

type SettingsMaxima = {
  technical_execution_value: number | null;
  problem_solution_fit_value: number | null;
  innovation_creativity_value: number | null;
  presentation_quality_value: number | null;
  entrepreneurship_value: number | null;
};

/** Average of each judge's weighted overall total (criteria already capped at settings weights). */
function averageOverallJudgeScore(rows: JudgeCriterionRow[]): {
  avg: number | null;
  judgeCount: number;
} {
  const totals = rows
    .map((row) => totalScore(row as JudgeScoreRow))
    .filter((value): value is number => typeof value === "number");
  if (totals.length === 0) return { avg: null, judgeCount: 0 };
  const sum = totals.reduce((acc, n) => acc + n, 0);
  return {
    avg: Math.round((sum / totals.length) * 100) / 100,
    judgeCount: totals.length,
  };
}

function overallMaxima(settings: SettingsMaxima | null): number {
  const parts = [
    settings?.technical_execution_value ?? 20,
    settings?.problem_solution_fit_value ?? 20,
    settings?.innovation_creativity_value ?? 30,
    settings?.presentation_quality_value ?? 20,
    settings?.entrepreneurship_value ?? 10,
  ].map((n) => Math.max(0, Math.round(n)));
  return parts.reduce((acc, n) => acc + n, 0);
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, "sponsor");
  if (!auth.ok) return auth.response;

  const roleCheck = await verifyRoleMapping({
    userRoleId: auth.session.userId,
    expectedRole: "sponsor",
  });
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
  }

  if (!isUuid(auth.session.userId)) {
    return NextResponse.json({ error: "Invalid sponsor session identity." }, { status: 403 });
  }

  const [submissionsResult, scoresResult, settingsResult] = await Promise.all([
    supabaseServer
      .from("submissions")
      .select("*")
      .eq("status", "APPROVED")
      .order("submitted_at", { ascending: false }),
    supabaseServer
      .from("judges_scores")
      .select(
        "submission_id,entrepreneurship,technical_execution,problem_solution_fit,innovation_creativity,presentation_quality",
      ),
    supabaseServer
      .from("settings")
      .select(
        "technical_execution_value,problem_solution_fit_value,innovation_creativity_value,presentation_quality_value,entrepreneurship_value",
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle<SettingsMaxima>(),
  ]);

  if (submissionsResult.error) {
    return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
  }
  if (scoresResult.error) {
    return NextResponse.json({ error: scoresResult.error.message }, { status: 500 });
  }
  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const judgeRows = (scoresResult.data ?? []) as JudgeCriterionRow[];

  const judgeRowsBySubmission = new Map<string, JudgeCriterionRow[]>();
  for (const row of judgeRows) {
    if (typeof row.submission_id !== "string") continue;
    const list = judgeRowsBySubmission.get(row.submission_id) ?? [];
    list.push(row);
    judgeRowsBySubmission.set(row.submission_id, list);
  }

  type ProjectRow = {
    id: string;
    projectName: string;
    teamId: string;
    track: string;
    overallJudgeAvg: number | null;
    judgeCount: number;
    trackPlace: TrackPlace | null;
  };

  const scoredForRanking = submissions.map((row) => {
    const { avg } = averageOverallJudgeScore(judgeRowsBySubmission.get(row.id) ?? []);
    return {
      id: row.id,
      track: row.track?.trim() || "Open Innovation",
      projectName: row.project_name,
      overallJudgeAvg: avg,
    };
  });
  const trackPlaces = rankTrackPlaces(scoredForRanking);

  const projects: ProjectRow[] = submissions
    .map((row) => {
      const { avg, judgeCount } = averageOverallJudgeScore(
        judgeRowsBySubmission.get(row.id) ?? [],
      );
      return {
        id: row.id,
        projectName: row.project_name,
        teamId: String(row.team_id),
        track: row.track?.trim() || "Open Innovation",
        overallJudgeAvg: avg,
        judgeCount,
        trackPlace: trackPlaces.get(row.id) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.overallJudgeAvg == null && b.overallJudgeAvg == null) {
        return a.projectName.localeCompare(b.projectName);
      }
      if (a.overallJudgeAvg == null) return 1;
      if (b.overallJudgeAvg == null) return -1;
      if (b.overallJudgeAvg !== a.overallJudgeAvg) {
        return b.overallJudgeAvg - a.overallJudgeAvg;
      }
      return a.projectName.localeCompare(b.projectName);
    });

  return NextResponse.json({
    projects,
    maxima: { overall: overallMaxima(settingsResult.data ?? null) },
    session: {
      username: auth.session.username,
      role: auth.session.role,
    },
  });
}
