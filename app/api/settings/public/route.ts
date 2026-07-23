import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PublicSettingsRow = {
  id: number;
  submission_status: boolean;
  resubmission_status: boolean;
  max_team_size: number;
  max_file_size: number | null;
  deadline: string;
  active_tracks: string[] | null;
  technical_execution_value: number | null;
  problem_solution_fit_value: number | null;
  innovation_creativity_value: number | null;
  presentation_quality_value: number | null;
  entrepreneurship_value: number | null;
  updated_at: string;
};

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const DEFAULT_TECHNICAL_EXECUTION_VALUE = 20;
const DEFAULT_PROBLEM_SOLUTION_FIT_VALUE = 20;
const DEFAULT_INNOVATION_CREATIVITY_VALUE = 30;
const DEFAULT_PRESENTATION_QUALITY_VALUE = 20;
const DEFAULT_ENTREPRENEURSHIP_VALUE = 10;

export async function GET() {
  const { data, error } = await supabaseServer
    .from("settings")
    .select("id,submission_status,resubmission_status,max_team_size,max_file_size,deadline,active_tracks,technical_execution_value,problem_solution_fit_value,innovation_creativity_value,presentation_quality_value,entrepreneurship_value,updated_at")
    .eq("id", 1)
    .maybeSingle<PublicSettingsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Settings row missing at id=1." }, { status: 404 });
  }

  return NextResponse.json({
    settings: {
      ...data,
      max_file_size: typeof data.max_file_size === "number"
        ? Math.max(1, Math.round(data.max_file_size))
        : DEFAULT_MAX_FILE_SIZE_MB,
      active_tracks: Array.isArray(data.active_tracks)
        ? data.active_tracks.filter((item): item is string => typeof item === "string")
        : [],
      technical_execution_value: typeof data.technical_execution_value === "number"
        ? Math.max(0, Math.round(data.technical_execution_value))
        : DEFAULT_TECHNICAL_EXECUTION_VALUE,
      problem_solution_fit_value: typeof data.problem_solution_fit_value === "number"
        ? Math.max(0, Math.round(data.problem_solution_fit_value))
        : DEFAULT_PROBLEM_SOLUTION_FIT_VALUE,
      innovation_creativity_value: typeof data.innovation_creativity_value === "number"
        ? Math.max(0, Math.round(data.innovation_creativity_value))
        : DEFAULT_INNOVATION_CREATIVITY_VALUE,
      presentation_quality_value: typeof data.presentation_quality_value === "number"
        ? Math.max(0, Math.round(data.presentation_quality_value))
        : DEFAULT_PRESENTATION_QUALITY_VALUE,
      entrepreneurship_value: typeof data.entrepreneurship_value === "number"
        ? Math.max(0, Math.round(data.entrepreneurship_value))
        : DEFAULT_ENTREPRENEURSHIP_VALUE,
    },
  });
}
