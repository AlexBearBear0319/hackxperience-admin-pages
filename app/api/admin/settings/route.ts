import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { supabaseServer } from "@/lib/supabase-server";
import { insertSubmissionLog } from "@/lib/server/activity-log";

type SettingsRow = {
  id: number;
  submission_status: boolean;
  resubmission_status: boolean;
  max_team_size: number;
  max_file_size: number;
  deadline: string;
  active_tracks: string[] | null;
  technical_execution_value: number;
  problem_solution_fit_value: number;
  innovation_creativity_value: number;
  presentation_quality_value: number;
  entrepreneurship_value: number;
  updated_at: string;
};

type UserRoleRow = {
  role: string;
};

type AdminAuthResult =
  | { ok: true; adminUserId: string }
  | { ok: false; response: NextResponse };

function normalizeRole(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function readBearerToken(request: NextRequest) {
  const raw = request.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

async function verifyAdminRole(request: NextRequest): Promise<AdminAuthResult> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing Supabase access token." }, { status: 401 }),
    };
  }

  const { data: authUser, error: authError } = await supabaseServer.auth.getUser(accessToken);
  if (authError || !authUser.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid Supabase session." }, { status: 401 }),
    };
  }

  const { data: roleRows, error: roleError } = await supabaseServer
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.user.id);

  if (roleError) {
    return {
      ok: false,
      response: NextResponse.json({ error: roleError.message }, { status: 500 }),
    };
  }

  const hasAdminRole = ((roleRows ?? []) as UserRoleRow[]).some(
    (row) => normalizeRole(row.role) === "admin",
  );

  if (!hasAdminRole) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 }),
    };
  }

  return { ok: true, adminUserId: authUser.user.id };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, "admin");
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseServer
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle<SettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data ?? null });
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, "admin");
  if (!auth.ok) return auth.response;

  const adminAuth = await verifyAdminRole(request);
  if (!adminAuth.ok) return adminAuth.response;

  const body = await request.json().catch(() => null);

  const updatePayload: Partial<SettingsRow> = {};
  if (typeof body?.submission_status === "boolean") {
    updatePayload.submission_status = body.submission_status;
  }
  if (typeof body?.resubmission_status === "boolean") {
    updatePayload.resubmission_status = body.resubmission_status;
  }
  if (typeof body?.max_team_size === "number") {
    updatePayload.max_team_size = Math.max(1, Math.min(20, Math.round(body.max_team_size)));
  }
  if (typeof body?.max_file_size === "number") {
    updatePayload.max_file_size = Math.max(1, Math.min(32767, Math.round(body.max_file_size)));
  }
  if (typeof body?.deadline === "string") {
    updatePayload.deadline = body.deadline;
  }
  if (Array.isArray(body?.active_tracks)) {
    updatePayload.active_tracks = body.active_tracks.filter((item: unknown): item is string => typeof item === "string");
  }
  if (typeof body?.technical_execution_value === "number") {
    updatePayload.technical_execution_value = Math.max(0, Math.min(100, Math.round(body.technical_execution_value)));
  }
  if (typeof body?.problem_solution_fit_value === "number") {
    updatePayload.problem_solution_fit_value = Math.max(0, Math.min(100, Math.round(body.problem_solution_fit_value)));
  }
  if (typeof body?.innovation_creativity_value === "number") {
    updatePayload.innovation_creativity_value = Math.max(0, Math.min(100, Math.round(body.innovation_creativity_value)));
  }
  if (typeof body?.presentation_quality_value === "number") {
    updatePayload.presentation_quality_value = Math.max(0, Math.min(100, Math.round(body.presentation_quality_value)));
  }
  if (typeof body?.entrepreneurship_value === "number") {
    updatePayload.entrepreneurship_value = Math.max(0, Math.min(100, Math.round(body.entrepreneurship_value)));
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("settings")
    .update(updatePayload)
    .eq("id", 1)
    .select("*")
    .maybeSingle<SettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Settings row missing at id=1. Seed the settings table first." },
      { status: 404 }
    );
  }

  const criteriaKeys: (keyof SettingsRow)[] = [
    "technical_execution_value",
    "problem_solution_fit_value",
    "innovation_creativity_value",
    "presentation_quality_value",
    "entrepreneurship_value",
  ];
  const isCriteriaUpdate = criteriaKeys.some((k) => k in updatePayload);
  const isSubmissionConfigUpdate =
    !isCriteriaUpdate &&
    ["max_team_size", "max_file_size", "deadline", "submission_status", "resubmission_status", "active_tracks"].some(
      (k) => k in updatePayload,
    );

  if (isCriteriaUpdate) {
    void insertSubmissionLog({
      submissionId: null,
      action: "CRITERIA_UPDATED",
      performedBy: auth.session.username,
      note: `Admin ${auth.session.username} updated judging criteria`,
    }).catch(() => {});
  } else if (isSubmissionConfigUpdate) {
    void insertSubmissionLog({
      submissionId: null,
      action: "SETTINGS_UPDATED",
      performedBy: auth.session.username,
      note: `Admin ${auth.session.username} updated submission configuration`,
    }).catch(() => {});
  }

  return NextResponse.json({ settings: data });
}
