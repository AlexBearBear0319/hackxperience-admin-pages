import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import { parseJudgingBands } from "@/lib/judging-bands";

type SettingsBandsRow = {
  judging_bands: unknown;
  judging_bands_version: number | null;
};

/**
 * Judge-only judging score bands. Not exposed on public settings.
 */
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

  const { data, error } = await supabaseServer
    .from("settings")
    .select("judging_bands,judging_bands_version")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle<SettingsBandsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bands = parseJudgingBands(data?.judging_bands);
  const version =
    typeof data?.judging_bands_version === "number"
      ? Math.max(1, Math.round(data.judging_bands_version))
      : 1;

  return NextResponse.json({
    version,
    bands,
  });
}
