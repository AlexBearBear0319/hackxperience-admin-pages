// Judge-dashboard-local UI types. The project view-model (JudgeProject) and
// TeamMember live in @/lib/types.

export interface ScoreEntry {
  techExec: string;
  problemSolution: string;
  innovation: string;
  presentation: string;
  entrepreneurship: string;
  comment: string;
  saved: boolean;
  savedTotal: number;
}
