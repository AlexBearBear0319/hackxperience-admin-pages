import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// POST /api/survey — record an optional post-submission feedback response.
// Writes go through the service-role client (bypasses RLS) — same pattern as
// app/api/submissions/*. The anon key has no direct insert access to this table.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) ?? {};

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

  if (!teamId) {
    return NextResponse.json({ error: "Missing team ID." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("survey_responses")
    .insert({
      team_id: teamId,
      answers,
    })
    .select("id")
    .single();

  if (error) {
    // Foreign-key violation — team_id doesn't match a real submission.
    if (error.code === "23503") {
      return NextResponse.json({ error: "Unknown team ID." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
