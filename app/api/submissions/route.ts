import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { insertSubmissionLog } from "@/lib/server/activity-log";

// POST /api/submissions — create a new submission
// NOTE: `submissions.team_id` is TEXT NOT NULL UNIQUE (confirmed against the live
// DB) — there is no separate team_name column. Store the selected slot as-is.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) ?? {};
  const isDraft = typeof body?.isDraft === "boolean" ? body.isDraft : true;

  const { data, error } = await supabaseServer
    .from("submissions")
    .insert({
      project_name:        body.projectName,
      team_id:             body.teamId,
      track:               body.track,
      description:         body.description,
      pitch:               body.pitch,
      tech_stack:          body.techStack ?? [],
      uses_microsoft_foundry: body.usesMicrosoftFoundry ?? false,
      thumbnail_url:       body.thumbnailUrl ?? null,
      github_repo_url:       body.githubRepoUrl,
      live_demo_url:         body.liveDemoUrl || null,
      pitch_deck_share_url:  body.pitchDeckShareUrl,
      pitch_deck_upload_url: body.pitchDeckUploadUrl ?? null,
      demo_video_url:        body.demoVideoUrl || null,
      members:               body.members ?? [],
      notes:                 body.notes || null,
      is_draft:              isDraft,
    })
    .select("id, edit_token")
    .single();

  if (error) {
    // team_id unique violation — that slot is already taken.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This Team ID is already taken. If you already submitted, use your edit link to update it." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void insertSubmissionLog({
    submissionId: data.id,
    action: "SUBMITTED",
    performedBy: `team:${body.teamId ?? ""}`,
    note: `Team ${body.teamId ?? ""} submitted project ${body.projectName ?? ""}`,
  }).catch(() => {});

  return NextResponse.json({ id: data.id, editToken: data.edit_token }, { status: 201 });
}
