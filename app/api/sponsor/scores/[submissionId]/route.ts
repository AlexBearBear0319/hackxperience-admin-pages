import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/route-guard";
import { verifyRoleMapping } from "@/lib/auth/role-mapping";
import { supabaseServer } from "@/lib/supabase-server";
import {
  isSponsorAward,
  isUuid,
  parseSponsorScore,
  type SponsorAward,
} from "@/lib/server/sponsor-awards";

type RouteContext = {
  params: Promise<{ submissionId: string }>;
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

  const { submissionId } = await params;
  if (!isUuid(submissionId)) {
    return NextResponse.json({ error: "Invalid submission id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!isSponsorAward(body?.award)) {
    return NextResponse.json(
      { error: "Body award must be entrepreneurial or microsoft_foundry." },
      { status: 400 },
    );
  }
  const award: SponsorAward = body.award;

  const score = parseSponsorScore(body?.score);
  if (score === "invalid") {
    return NextResponse.json({ error: "Score must be an integer from 0 to 100." }, { status: 400 });
  }

  const privateComment =
    typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  let submissionQuery = supabaseServer
    .from("submissions")
    .select("id,status,project_name,uses_microsoft_foundry")
    .eq("id", submissionId)
    .eq("status", "APPROVED");

  if (award === "microsoft_foundry") {
    submissionQuery = submissionQuery.eq("uses_microsoft_foundry", true);
  }

  const submissionCheck = await submissionQuery.maybeSingle<{
    id: string;
    status: string;
    project_name: string | null;
    uses_microsoft_foundry: boolean | null;
  }>();

  if (submissionCheck.error) {
    return NextResponse.json({ error: submissionCheck.error.message }, { status: 500 });
  }
  if (!submissionCheck.data) {
    return NextResponse.json(
      { error: "Submission is not available for this award." },
      { status: 404 },
    );
  }

  const updatedAt = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("sponsor_scores")
    .upsert(
      {
        sponsor_id: sponsorId,
        submission_id: submissionId,
        award,
        score,
        private_comment: privateComment,
        updated_at: updatedAt,
      },
      { onConflict: "sponsor_id,submission_id,award" },
    )
    .select("submission_id,award,score,private_comment,updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to save sponsor score." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    score: data.score,
    comment: data.private_comment,
    updatedAt: data.updated_at,
    award: data.award,
    submissionId: data.submission_id,
    projectName: submissionCheck.data.project_name,
  });
}
