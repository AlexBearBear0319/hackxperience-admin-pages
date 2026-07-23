"use client";

import type { AdminSubmission, SubmissionScore } from "@/lib/types";

type WriteXlsxFile = typeof import("write-excel-file/browser").default;
type ExcelFileContent = Blob | File | ArrayBuffer;
type ExcelRow = import("write-excel-file/browser").Row;
type ExcelCell = ExcelRow[number];
type ExcelSheet = import("write-excel-file/browser").Sheet<ExcelFileContent>;

// ── Header styling — light blue fill with dark text for readability ─────────
const HEADER_BG = "#D6EAF8";
const HEADER_FG = "#1D1C17";

// ── Value helpers (data cleanup) ────────────────────────────────────────────
function num(v: number | null | undefined): number | "" {
  return typeof v === "number" && Number.isFinite(v) ? v : "";
}

function str(v: string | null | undefined): string {
  return typeof v === "string" ? v : "";
}

/** A long-text cell: wraps + top-aligns so descriptions/comments stay readable. */
function wrapCell(value: string | null | undefined): ExcelCell {
  return { value: str(value), wrap: true, alignVertical: "top" };
}

/** A percentage cell rendered with a fixed 2-decimal Excel number format. */
function pctCell(value: number): ExcelCell {
  return { type: Number, value, format: "0.00" };
}

function joinTech(stack: string[] | undefined): string {
  return Array.isArray(stack) ? stack.join(", ") : "";
}

/** One member per line: "Name (role) <email>" — wraps nicely in the cell. */
function formatMembers(members: AdminSubmission["members"]): string {
  if (!members || members.length === 0) return "";
  return members
    .map((m) => {
      const role = m.role ? ` (${m.role})` : "";
      const email = m.email ? ` <${m.email}>` : "";
      return `${m.name}${role}${email}`;
    })
    .join("\n");
}

// ── Score aggregation ───────────────────────────────────────────────────────
type ScoredJudge = SubmissionScore & { score: number };

function scoredJudges(sub: AdminSubmission): ScoredJudge[] {
  return sub.scores.filter(
    (s): s is ScoredJudge => typeof s.score === "number" && Number.isFinite(s.score),
  );
}

/**
 * Final score = average of each judge's total. A judge's total is the sum of
 * the four criteria, which are each capped at their weight (30/25/25/20), so
 * the total is already on a 0–100 scale. Just round to 2 decimals.
 */
function finalPercent(sub: AdminSubmission): number | null {
  const valid = scoredJudges(sub);
  if (valid.length === 0) return null;
  const avg = valid.reduce((sum, s) => sum + s.score, 0) / valid.length;
  return Math.round(avg * 100) / 100;
}

/** Best available contact: explicit lead_email, else the team lead / first member. */
function contactEmail(sub: AdminSubmission): string {
  if (sub.leadEmail) return sub.leadEmail;
  const lead = sub.members?.find((m) => (m.role ?? "").toLowerCase().includes("lead"));
  return lead?.email ?? sub.members?.[0]?.email ?? "";
}

// ── Sheet builder (bold header + frozen top row + column widths) ─────────────
type ColumnSpec = { header: string; width: number };

function buildSheet(sheet: string, columns: ColumnSpec[], rows: ExcelRow[]): ExcelSheet {
  const headerRow: ExcelRow = columns.map((c) => ({
    value: c.header,
    fontWeight: "bold" as const,
    color: HEADER_FG,
    backgroundColor: HEADER_BG,
    align: "left" as const,
    wrap: true,
  }));

  return {
    sheet,
    stickyRowsCount: 1, // freeze the header row
    columns: columns.map((c) => ({ width: c.width })),
    data: [headerRow, ...rows],
  };
}

// ── Sheet name utilities ────────────────────────────────────────────────────

type Maxima = {
  technical: number;
  problem: number;
  innovation: number;
  presentation: number;
  entrepreneurship: number;
  overall: number;
};

const DEFAULT_EXPORT_MAXIMA: Maxima = {
  technical: 20,
  problem: 20,
  innovation: 30,
  presentation: 20,
  entrepreneurship: 10,
  overall: 100,
};

/**
 * Returns a valid Excel sheet name (≤31 chars, no \ / ? * [ ] :).
 * Deduplicates by appending " (2)", " (3)", etc. when a name is already used.
 */
function sanitizeSheetName(raw: string, usedNames: Set<string>): string {
  let safe = raw.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31) || "Sheet";

  if (!usedNames.has(safe)) {
    usedNames.add(safe);
    return safe;
  }
  for (let i = 2; ; i++) {
    const suffix = ` (${i})`;
    const candidate = safe.slice(0, 31 - suffix.length) + suffix;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
}

// ── Sheet definitions ───────────────────────────────────────────────────────

/** Ranked projects + final % (average of judge scores). */
function buildResultsSheet(submissions: AdminSubmission[]): ExcelSheet {
  const ranked = submissions
    .map((sub) => ({ sub, pct: finalPercent(sub) }))
    .filter((r): r is { sub: AdminSubmission; pct: number } => r.pct !== null)
    .sort((a, b) => b.pct - a.pct || a.sub.projectName.localeCompare(b.sub.projectName));

  const rows: ExcelRow[] = ranked.map(({ sub, pct }, index) => [
    index + 1,
    sub.projectName,
    sub.teamName,
    pctCell(pct),
    scoredJudges(sub).length,
  ]);

  return buildSheet(
    "Overview",
    [
      { header: "Rank", width: 8 },
      { header: "Project Name", width: 34 },
      { header: "Team Name", width: 26 },
      { header: "Final Score (%)", width: 16 },
      { header: "Judges Counted", width: 16 },
    ],
    rows,
  );
}

/** Per-judge criterion breakdown for a single project. */
function buildTeamBreakdownSheet(
  sheetName: string,
  judges: ScoredJudge[],
  maxima: Maxima,
): ExcelSheet {
  const rows: ExcelRow[] = judges.map((s) => [
    str(s.judgeId),
    num(s.technicalExecution),
    num(s.problemSolutionFit),
    num(s.innovationCreativity),
    num(s.presentationQuality),
    num(s.entrepreneurship),
    typeof s.score === "number" ? pctCell(Math.round(s.score * 100) / 100) : "",
    wrapCell(s.comments),
  ]);

  return buildSheet(
    sheetName,
    [
      { header: "Judge ID",                            width: 22 },
      { header: `Technical (/${maxima.technical})`,    width: 18 },
      { header: `Problem Fit (/${maxima.problem})`,    width: 18 },
      { header: `Innovation (/${maxima.innovation})`,  width: 18 },
      { header: `Presentation (/${maxima.presentation})`, width: 20 },
      { header: `Entrepreneurship (/${maxima.entrepreneurship})`, width: 20 },
      { header: `Total (/${maxima.overall})`,          width: 15 },
      { header: "Comments",                            width: 50 },
    ],
    rows,
  );
}

/** Every judge's per-criterion score for each project. */
function buildJudgeScoresSheet(submissions: AdminSubmission[]): ExcelSheet {
  const rows: ExcelRow[] = [];
  for (const sub of submissions) {
    for (const s of sub.scores) {
      const hasAnyScore =
        s.score !== null ||
        s.technicalExecution != null ||
        s.problemSolutionFit != null ||
        s.innovationCreativity != null ||
        s.presentationQuality != null ||
        s.entrepreneurship != null;
      if (!hasAnyScore) continue;

      rows.push([
        sub.projectName,
        sub.teamName,
        str(s.judgeId),
        num(s.technicalExecution),
        num(s.problemSolutionFit),
        num(s.innovationCreativity),
        num(s.presentationQuality),
        num(s.entrepreneurship),
        typeof s.score === "number" ? pctCell(Math.round(s.score * 100) / 100) : "",
        wrapCell(s.comments),
      ]);
    }
  }

  return buildSheet(
    "Judge Scores",
    [
      { header: "Project Name", width: 32 },
      { header: "Team Name", width: 24 },
      { header: "Judge", width: 20 },
      { header: "Technical Execution", width: 20 },
      { header: "Problem / Solution Fit", width: 22 },
      { header: "Innovation / Creativity", width: 22 },
      { header: "Presentation Quality", width: 20 },
      { header: "Entrepreneurship", width: 20 },
      { header: "Judge Total (%)", width: 16 },
      { header: "Comments", width: 50 },
    ],
    rows,
  );
}

/** Full listing of every submission with all review detail. */
function buildProjectsSheet(submissions: AdminSubmission[]): ExcelSheet {
  const rows: ExcelRow[] = submissions
    .slice()
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) || a.projectName.localeCompare(b.projectName),
    )
    .map((sub) => {
      const pct = finalPercent(sub);
      return [
        sub.status.toUpperCase(),
        sub.projectName,
        sub.teamName,
        str(sub.teamId),
        str(sub.track),
        wrapCell(sub.description),
        wrapCell(sub.shortPitch),
        joinTech(sub.techStack),
        { value: formatMembers(sub.members), wrap: true, alignVertical: "top" },
        contactEmail(sub),
        str(sub.githubUrl),
        str(sub.liveUrl),
        str(sub.pitchDeckUrl),
        str(sub.videoDemoUrl),
        pct === null ? "" : pctCell(pct),
        scoredJudges(sub).length,
        str(sub.submittedAt), // already a human-readable date from the API
        str(sub.updatedAt),
        wrapCell(sub.additionalNotes),
      ];
    });

  return buildSheet(
    "Projects",
    [
      { header: "Status", width: 12 },
      { header: "Project Name", width: 30 },
      { header: "Team Name", width: 22 },
      { header: "Team ID", width: 16 },
      { header: "Track", width: 18 },
      { header: "Description", width: 50 },
      { header: "Pitch", width: 50 },
      { header: "Tech Stack", width: 30 },
      { header: "Team Members", width: 40 },
      { header: "Lead Email", width: 28 },
      { header: "GitHub", width: 34 },
      { header: "Live Demo", width: 30 },
      { header: "Pitch Deck", width: 30 },
      { header: "Demo Video", width: 30 },
      { header: "Final Score (%)", width: 15 },
      { header: "Judges Counted", width: 14 },
      { header: "Submitted At", width: 20 },
      { header: "Updated At", width: 20 },
      { header: "Notes", width: 40 },
    ],
    rows,
  );
}

// ── Public exports — one single-sheet workbook (file) per export ────────────

/**
 * Results — ranked leaderboard (Overview tab) plus one breakdown tab per
 * project showing each judge's per-criterion scores.
 */
export async function exportResultsXlsx(
  submissions: AdminSubmission[],
  filename: string,
  maxima?: Maxima,
): Promise<void> {
  const mx = maxima ?? DEFAULT_EXPORT_MAXIMA;

  const overviewSheet = buildResultsSheet(submissions);

  // Rank the same way the UI does so sheet order matches the leaderboard.
  const ranked = submissions
    .map((sub) => ({ sub, pct: finalPercent(sub) }))
    .filter((r): r is { sub: AdminSubmission; pct: number } => r.pct !== null)
    .sort((a, b) => b.pct - a.pct || a.sub.projectName.localeCompare(b.sub.projectName));

  // "Overview" is already taken by the first sheet.
  const usedNames = new Set<string>(["Overview"]);

  const teamSheets: ExcelSheet[] = ranked
    .map(({ sub }) => {
      const judges = scoredJudges(sub);
      if (judges.length === 0) return null;
      const sheetName = sanitizeSheetName(sub.projectName, usedNames);
      return buildTeamBreakdownSheet(sheetName, judges, mx);
    })
    .filter((s): s is ExcelSheet => s !== null);

  await downloadWorkbook([overviewSheet, ...teamSheets], filename);
}

/** Judge score history — every judge's per-criterion score. */
export async function exportJudgeScoresXlsx(
  submissions: AdminSubmission[],
  filename: string,
): Promise<void> {
  await downloadWorkbook([buildJudgeScoresSheet(submissions)], filename);
}

/** Projects listing — full review detail for every submission. */
export async function exportProjectsXlsx(
  submissions: AdminSubmission[],
  filename: string,
): Promise<void> {
  await downloadWorkbook([buildProjectsSheet(submissions)], filename);
}

async function downloadWorkbook(sheets: ExcelSheet[], filename: string): Promise<void> {
  const { default: writeXlsxFile } = (await import("write-excel-file/browser")) as {
    default: WriteXlsxFile;
  };
  await writeXlsxFile(sheets).toFile(filename);
}
