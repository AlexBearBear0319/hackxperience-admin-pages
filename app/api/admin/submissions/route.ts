import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { supabaseServer } from "@/lib/supabase-server";
import {
  mapSubmissionToAdminView,
  totalScore,
  type JudgeIdentifier,
  type JudgeScoreRow,
} from "@/lib/server/portal-data";
import {
  normalizeJudgeScoreRows,
  resolveJudgeScoresIdColumn,
  selectJudgeScoresColumns,
} from "@/lib/server/judge-scores";
import { usernameFromSupabaseEmail } from "@/lib/auth/portal-identity";
import type { SubmissionRow } from "@/lib/types";
import {
  DEFAULT_CRITERION_WEIGHTS,
  parseCriterionWeights,
} from "@/lib/scoring";

type JudgeRoleRow = {
  id: number | string;
  user_id: string;
  role: string;
};

type AuthUserListItem = {
  id: string;
  email?: string | null;
};

const AUTH_PER_PAGE = 200;
const AUTH_MAX_PAGES = 25;
const JUDGE_ROLE = "JUDGE";

function normalizeJudgeKey(id: JudgeIdentifier) {
  return String(id);
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("could not find the table");
}

async function listAuthUsersById() {
  const users = new Map<string, AuthUserListItem>();
  let page = 1;

  for (let checkedPages = 0; checkedPages < AUTH_MAX_PAGES; checkedPages += 1) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({
      page,
      perPage: AUTH_PER_PAGE,
    });
    if (error) throw new Error(error.message);

    for (const user of data.users as AuthUserListItem[]) {
      users.set(user.id, user);
    }

    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return users;
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, "admin");
  if (!auth.ok) return auth.response;

  let judgeScoreIdColumn: Awaited<ReturnType<typeof resolveJudgeScoresIdColumn>>;
  try {
    judgeScoreIdColumn = await resolveJudgeScoresIdColumn();
  } catch (columnError) {
    return NextResponse.json(
      { error: columnError instanceof Error ? columnError.message : "Unable to resolve judge score column." },
      { status: 500 },
    );
  }

  const [submissionsResult, scoreRowsResult, judgeRolesResult, settingsResult] = await Promise.all([
    supabaseServer
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false }),
    supabaseServer
      .from("judges_scores")
      .select(selectJudgeScoresColumns(judgeScoreIdColumn)),
    supabaseServer
      .from("user_roles")
      .select("id,user_id,role")
      .ilike("role", JUDGE_ROLE)
      .order("id", { ascending: true }),
    supabaseServer
      .from("settings")
      .select(
        "technical_execution_value,problem_solution_fit_value,innovation_creativity_value,presentation_quality_value,entrepreneurship_value",
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (submissionsResult.error) {
    return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
  }
  if (scoreRowsResult.error) {
    return NextResponse.json({ error: scoreRowsResult.error.message }, { status: 500 });
  }
  if (settingsResult.error) {
    return NextResponse.json({ error: settingsResult.error.message }, { status: 500 });
  }

  const weights = parseCriterionWeights(settingsResult.data, DEFAULT_CRITERION_WEIGHTS);

  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const scoreRows = normalizeJudgeScoreRows(
    (scoreRowsResult.data ?? []) as unknown as Record<string, unknown>[],
    judgeScoreIdColumn,
  ) as JudgeScoreRow[];

  const scoreRowsBySubmission = new Map<string, JudgeScoreRow[]>();
  for (const row of scoreRows) {
    const bucket = scoreRowsBySubmission.get(row.submission_id) ?? [];
    bucket.push(row);
    scoreRowsBySubmission.set(row.submission_id, bucket);
  }

  const usernameByJudgeKey = new Map<string, string>();
  const orderedJudgeUsernames: string[] = [];
  if (!judgeRolesResult.error) {
    try {
      const authUsers = await listAuthUsersById();
      for (const roleRow of (judgeRolesResult.data ?? []) as JudgeRoleRow[]) {
        const roleId = typeof roleRow.id === "string" ? roleRow.id.trim() : roleRow.id;
        if (roleId === "" || roleId === null || roleId === undefined) continue;

        const roleKey = normalizeJudgeKey(roleId);
        const authUserId = typeof roleRow.user_id === "string" ? roleRow.user_id.trim() : "";
        const authUser = authUsers.get(authUserId);
        const username =
          usernameFromSupabaseEmail(authUser?.email) ||
          authUser?.email ||
          `judge_${String(roleId)}`;

        if (!orderedJudgeUsernames.includes(username)) {
          orderedJudgeUsernames.push(username);
        }

        // Primary key for current schema (judges_scores.judge_id -> auth.users.id).
        if (authUserId) {
          usernameByJudgeKey.set(authUserId, username);
        }
        // Backward compatibility for older schema that keyed scores by user_roles.id.
        usernameByJudgeKey.set(roleKey, username);
      }
    } catch (authError) {
      return NextResponse.json(
        { error: authError instanceof Error ? authError.message : "Unable to load auth users." },
        { status: 500 },
      );
    }
  } else if (!isMissingTableError(judgeRolesResult.error)) {
    return NextResponse.json({ error: judgeRolesResult.error.message }, { status: 500 });
  }

  const unresolvedJudgeKeys = Array.from(new Set(scoreRows.map((row) => normalizeJudgeKey(row.judges_id))))
    .filter((judgeKey) => !usernameByJudgeKey.has(judgeKey));

  const judgeIds = [...orderedJudgeUsernames, ...unresolvedJudgeKeys];

  const adminSubmissions = submissions.map((submission) => {
    const rows = scoreRowsBySubmission.get(submission.id) ?? [];
    const rowByJudgeUsername = new Map<string, JudgeScoreRow>();

    for (const row of rows) {
      const judgeKey = normalizeJudgeKey(row.judges_id);
      const judgeUsername = usernameByJudgeKey.get(judgeKey) ?? judgeKey;
      if (!rowByJudgeUsername.has(judgeUsername)) {
        rowByJudgeUsername.set(judgeUsername, row);
      }
    }

    const scores = judgeIds.map((judgeId) => {
      const row = rowByJudgeUsername.get(judgeId);
      return {
        judgeId,
        score: totalScore(row, weights),
        technicalExecution:  row?.technical_execution  ?? null,
        problemSolutionFit:  row?.problem_solution_fit  ?? null,
        innovationCreativity: row?.innovation_creativity ?? null,
        presentationQuality:  row?.presentation_quality  ?? null,
        entrepreneurship:  row?.entrepreneurship  ?? null,
        comments: row?.private_comment ?? null,
      };
    });

    return mapSubmissionToAdminView(submission, scores);
  });

  return NextResponse.json({
    submissions: adminSubmissions,
    judgeIds,
    session: {
      username: auth.session.username,
      role: auth.session.role,
    },
  });
}
