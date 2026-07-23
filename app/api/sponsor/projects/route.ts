import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import type { SubmissionRow, TeamMember } from "@/lib/types";
import { totalScore, type JudgeScoreRow } from "@/lib/server/portal-data";
import {
  compareJudgeAvgDesc,
  isSponsorAward,
  isUuid,
  rankSponsorScores,
  rankTrackPlaces,
  roamCriterionForAward,
  type SponsorAward,
  type SponsorScoreRow,
  type TrackPlace,
} from "@/lib/server/sponsor-awards";

type JudgeCriterionRow = {
  submission_id: string;
  entrepreneurship: number | null;
  technical_execution: number | null;
  problem_solution_fit: number | null;
  innovation_creativity: number | null;
  presentation_quality: number | null;
};

function memberCount(members: unknown): number {
  if (!Array.isArray(members)) return 0;
  return members.filter((entry): entry is TeamMember => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as { name?: unknown; email?: unknown };
    return typeof row.name === "string" && typeof row.email === "string";
  }).length;
}

function averageCriterion(
  rows: JudgeCriterionRow[],
  criterion: "entrepreneurship" | "technical_execution",
): number | null {
  const values = rows
    .map((row) => row[criterion])
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return sum / values.length;
}

/** Scale criterion average onto 0–100 using the admin settings max for that criterion. */
function normalizeToHundred(avg: number | null, maxPoints: number): number | null {
  if (avg == null || maxPoints <= 0) return null;
  const scaled = (avg / maxPoints) * 100;
  return Math.round(scaled * 10) / 10;
}

/** Average of each judge's weighted overall total (criteria already capped at settings weights). */
function averageOverallJudgeScore(rows: JudgeCriterionRow[]): number | null {
  const totals = rows
    .map((row) => totalScore(row as JudgeScoreRow))
    .filter((value): value is number => typeof value === "number");
  if (totals.length === 0) return null;
  const sum = totals.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / totals.length) * 100) / 100;
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
  const sponsorId = auth.session.userId;

  const awardParam = request.nextUrl.searchParams.get("award");
  if (!isSponsorAward(awardParam)) {
    return NextResponse.json(
      { error: "Query award must be entrepreneurial or microsoft_foundry." },
      { status: 400 },
    );
  }
  const award: SponsorAward = awardParam;
  const criterion = roamCriterionForAward(award);

  // Always load all APPROVED projects so track 1st/2nd is global (not award-filtered).
  const [allSubmissionsResult, scoresResult, sponsorScoresResult, settingsResult] = await Promise.all([
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
      .from("sponsor_scores")
      .select("submission_id,award,score,private_comment,updated_at")
      .eq("sponsor_id", sponsorId)
      .eq("award", award),
    supabaseServer
      .from("settings")
      .select("entrepreneurship_value,technical_execution_value")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle<{
        entrepreneurship_value: number | null;
        technical_execution_value: number | null;
      }>(),
  ]);

  if (allSubmissionsResult.error) {
    return NextResponse.json({ error: allSubmissionsResult.error.message }, { status: 500 });
  }
  if (scoresResult.error) {
    return NextResponse.json({ error: scoresResult.error.message }, { status: 500 });
  }
  if (sponsorScoresResult.error) {
    return NextResponse.json({ error: sponsorScoresResult.error.message }, { status: 500 });
  }
  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  const criterionMax =
    criterion === "entrepreneurship"
      ? Math.max(0, Math.round(settingsResult.data?.entrepreneurship_value ?? 10))
      : Math.max(0, Math.round(settingsResult.data?.technical_execution_value ?? 20));

  const allSubmissions = (allSubmissionsResult.data ?? []) as SubmissionRow[];
  const judgeRows = (scoresResult.data ?? []) as JudgeCriterionRow[];
  const sponsorRows = (sponsorScoresResult.data ?? []) as SponsorScoreRow[];

  const judgeRowsBySubmission = new Map<string, JudgeCriterionRow[]>();
  for (const row of judgeRows) {
    if (typeof row.submission_id !== "string") continue;
    const list = judgeRowsBySubmission.get(row.submission_id) ?? [];
    list.push(row);
    judgeRowsBySubmission.set(row.submission_id, list);
  }

  const overallBySubmission = new Map<string, number | null>();
  for (const row of allSubmissions) {
    overallBySubmission.set(
      row.id,
      averageOverallJudgeScore(judgeRowsBySubmission.get(row.id) ?? []),
    );
  }

  const trackPlaces = rankTrackPlaces(
    allSubmissions.map((row) => ({
      id: row.id,
      track: row.track?.trim() || "Open Innovation",
      projectName: row.project_name,
      overallJudgeAvg: overallBySubmission.get(row.id) ?? null,
    })),
  );

  const submissions =
    award === "microsoft_foundry"
      ? allSubmissions.filter((row) => Boolean(row.uses_microsoft_foundry))
      : allSubmissions;

  const sponsorBySubmission = new Map(
    sponsorRows.map((row) => [row.submission_id, row] as const),
  );
  const sponsorRanks = rankSponsorScores(sponsorRows);

  type ProjectPayload = {
    id: string;
    projectName: string;
    teamId: string;
    track: string;
    memberCount: number;
    thumbnailUrl: string | null;
    usesMicrosoftFoundry: boolean;
    judgeAvg: number | null;
    overallJudgeAvg: number | null;
    trackPlace: TrackPlace | null;
    roamRank: number;
    sponsorScore: number | null;
    sponsorComment: string | null;
    sponsorRank: number | null;
    sponsorUpdatedAt: string | null;
  };

  const projects: ProjectPayload[] = submissions
    .map((row) => {
      const sponsor = sponsorBySubmission.get(row.id);
      return {
        id: row.id,
        projectName: row.project_name,
        teamId: String(row.team_id),
        track: row.track?.trim() || "Open Innovation",
        memberCount: memberCount(row.members),
        thumbnailUrl: row.thumbnail_url,
        usesMicrosoftFoundry: Boolean(row.uses_microsoft_foundry),
        judgeAvg: normalizeToHundred(
          averageCriterion(judgeRowsBySubmission.get(row.id) ?? [], criterion),
          criterionMax,
        ),
        overallJudgeAvg: overallBySubmission.get(row.id) ?? null,
        trackPlace: trackPlaces.get(row.id) ?? null,
        roamRank: 0,
        sponsorScore: typeof sponsor?.score === "number" ? sponsor.score : null,
        sponsorComment: sponsor?.private_comment ?? null,
        sponsorRank: sponsorRanks.get(row.id) ?? null,
        sponsorUpdatedAt: sponsor?.updated_at ?? null,
      };
    })
    .sort(compareJudgeAvgDesc);

  projects.forEach((project, index) => {
    project.roamRank = index + 1;
  });

  const winnerRow = sponsorRows.length
    ? [...sponsorRows].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
      })[0]
    : null;

  const winnerProject = winnerRow
    ? projects.find((project) => project.id === winnerRow.submission_id)
    : null;

  return NextResponse.json({
    award,
    roamCriterion: criterion,
    criterionMax,
    projects,
    scoredCount: sponsorRows.length,
    totalCount: projects.length,
    winner: winnerProject
      ? {
          submissionId: winnerProject.id,
          projectName: winnerProject.projectName,
          score: winnerRow!.score,
        }
      : null,
    session: {
      username: auth.session.username,
      role: auth.session.role,
    },
  });
}
