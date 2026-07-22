import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import type { Submission, SubmissionRow } from "@/lib/types";

interface RouteContext {
  params: Promise<{ token: string }>;
}

// GET /api/submissions/[token] — fetch a submission by edit token
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  const { data, error } = await supabaseServer
    .from("submissions")
    .select("*")
    .eq("edit_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(dbToForm(data as SubmissionRow));
}

// PUT /api/submissions/[token] — update a submission by edit token
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) ?? {};
  const isDraft = typeof body?.isDraft === "boolean" ? body.isDraft : undefined;

  const { data, error } = await supabaseServer
    .from("submissions")
    .update({
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
      ...(typeof isDraft === "boolean" ? { is_draft: isDraft } : {}),
    })
    .eq("edit_token", token)
    .select("id, edit_token")
    .single();

  // team_id unique violation — the newly-chosen slot is taken by another team.
  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "This Team ID is already taken by another team. Please pick a different one." },
      { status: 409 }
    );
  }

  if (error || !data) {
    return NextResponse.json({ error: "Submission not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, editToken: data.edit_token });
}

// Map snake_case DB row → camelCase form shape (the canonical Submission)
function dbToForm(row: SubmissionRow): Submission {
  return {
    id:               row.id,
    editToken:        row.edit_token,
    status:           row.status,
    isDraft:          row.is_draft ?? true,
    submittedAt:      row.submitted_at,
    updatedAt:        row.updated_at,
    // form fields
    projectName:      row.project_name,
    teamId:           row.team_id,
    track:            row.track,
    description:      row.description,
    pitch:            row.pitch,
    techStack:        row.tech_stack,
    usesMicrosoftFoundry: row.uses_microsoft_foundry ?? false,
    thumbnailUrl:     row.thumbnail_url,
    githubRepoUrl:      row.github_repo_url,
    liveDemoUrl:        row.live_demo_url ?? "",
    pitchDeckShareUrl:  row.pitch_deck_share_url,
    pitchDeckUploadUrl: row.pitch_deck_upload_url,
    demoVideoUrl:       row.demo_video_url ?? "",
    members:            row.members,
    notes:            row.notes ?? "",
  };
}
