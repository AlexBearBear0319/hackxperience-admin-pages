"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShellConfig, type AdminMetric } from "../components/AdminShell";
import { type AdminSubmission } from "@/lib/types";
import { fetchAdminSubmissions } from "@/lib/client/admin-api";
import { usePortalSettings } from "../components/PortalSettingsContext";
import ActivityLogsClient from "./activity-logs/ActivityLogsClient";
import styles from "./Dashboard.module.css";

type DashboardState = "empty" | "populated";
type ExportKind = "results" | "scores" | "projects";

const emptySubmissions: AdminSubmission[] = [];

function buildMetrics(submissions: AdminSubmission[]): AdminMetric[] {
  const pending  = submissions.filter((s) => s.status === "pending").length;
  const approved = submissions.filter((s) => s.status === "approved").length;
  const rejected = submissions.filter((s) => s.status === "rejected").length;

  return [
    { key: "total_submissions",  label: "TOTAL_SUBMISSIONS",  value: String(submissions.length), helper: "received",              tone: "neutral"  },
    { key: "pending",            label: "PENDING",            value: String(pending),            helper: "awaiting review",        tone: "amber"    },
    { key: "approved",           label: "APPROVED",           value: String(approved),           helper: "cleared for showcase",   tone: "emerald"  },
    { key: "rejected",           label: "REJECTED",           value: String(rejected),           helper: "returned to team",       tone: "red"      },
    { key: "deadline_countdown", label: "DEADLINE_COUNTDOWN", value: "00.00.00.00",              helper: "until close",            tone: "neutral"  },
  ];
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span>&gt; {title}</span>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className={`${styles.toggle} ${enabled ? styles.toggleOn : styles.toggleOff}`}
        onClick={onToggle}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  );
}

// 7×6 pixel-art heart used as the per-track "health" indicator.
const HEART_PIXELS = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
] as const;

function PixelHeart({ count, maxCount }: { count: number; maxCount: number }) {
  const state =
    count === 0        ? "dim" :
    count === maxCount ? "top" :
                         "mid";
  const pixelColor =
    state === "dim" ? "#3a1010" :
    state === "top" ? "#ff3333" :
                      "#cc0000";
  return (
    <svg
      width={14}
      height={12}
      viewBox="0 0 7 6"
      shapeRendering="crispEdges"
      style={{ display: "block", imageRendering: "pixelated" }}
      className={state === "top" ? styles.heartGlow : undefined}
      aria-hidden="true"
    >
      {HEART_PIXELS.map((row, y) =>
        row.map((on, x) => {
          if (!on) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={pixelColor} />;
        }),
      )}
    </svg>
  );
}

function HpTrackRow({
  track,
  count,
  maxCount,
  totalCount,
}: {
  track: string;
  count: number;
  maxCount: number;
  totalCount: number;
}) {
  const targetPct = maxCount === 0 ? 0 : (count / maxCount) * 100;
  const sharePct = totalCount === 0 ? 0 : Math.round((count / totalCount) * 100);
  const isTopTrack = count > 0 && count === maxCount;
  const submissionWord = count === 1 ? "submission" : "submissions";
  const [ghostPct, setGhostPct] = useState(0);
  const [fillPct, setFillPct] = useState(0);

  useEffect(() => {
    const gId = setTimeout(() => setGhostPct(targetPct), 50);
    const fId = setTimeout(() => setFillPct(targetPct), 200);
    return () => {
      clearTimeout(gId);
      clearTimeout(fId);
    };
  }, [targetPct]);

  return (
    <div className={styles.hpRow}>
      <PixelHeart count={count} maxCount={maxCount} />
      <div className={styles.hpInfo}>
        <div className={styles.hpTopLine}>
          <span className={styles.hpLabel} title={track}>{track}</span>
          <span className={`${styles.hpBadge} ${isTopTrack ? styles.hpBadgeTop : ""}`}>
            {count}
          </span>
        </div>
        <span className={styles.hpDetails}>
          {count} {submissionWord} · {sharePct}% of total
        </span>
        <div className={styles.hpBarOuter}>
          <div className={styles.hpGhost} style={{ width: `${ghostPct}%` }} />
          <div className={styles.hpFill} style={{ width: `${fillPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function TrackChart({
  submissions,
  activeTracks,
}: {
  submissions: AdminSubmission[];
  activeTracks: string[];
}) {
  const totalCount = submissions.length;
  const counts = activeTracks.map((track) => ({
    track,
    count: submissions.filter((s) => s.track === track).length,
  }));
  const maxCount = Math.max(0, ...counts.map((c) => c.count));

  if (activeTracks.length === 0) {
    return (
      <div className={styles.hpWrap}>
        <p className={styles.hpDetails}>No active tracks configured in settings.</p>
      </div>
    );
  }

  return (
    <div className={styles.hpWrap}>
      {counts.map(({ track, count }) => (
        <HpTrackRow
          key={track}
          track={track}
          count={count}
          maxCount={maxCount}
          totalCount={totalCount}
        />
      ))}
    </div>
  );
}

export default function DashboardClient({ initialState }: { initialState: DashboardState }) {
  const [data, setData] = useState<AdminSubmission[]>(emptySubmissions);
  const [exportingKind, setExportingKind] = useState<ExportKind | null>(null);
  const router = useRouter();
  const {
    submissionsOpen,
    allowResubmissions,
    activeTracks,
    toggleSubmissionsOpen,
    toggleAllowResubmissions,
  } = usePortalSettings();
  const shellMetrics = useMemo(() => buildMetrics(data), [data]);

  useEffect(() => {
    if (initialState === "empty") return;
    void (async () => {
      try {
        const payload = await fetchAdminSubmissions();
        setData(payload.submissions);
      } catch {
        // Metrics stay at 0 on fetch error — non-critical.
      }
    })();
  }, [initialState]);

  async function handleExport(kind: ExportKind) {
    if (data.length === 0 || exportingKind) return;
    setExportingKind(kind);
    try {
      const xlsx = await import("@/lib/client/export-xlsx");
      if (kind === "results") {
        await xlsx.exportResultsXlsx(data, "hackxperience-results.xlsx");
      } else if (kind === "scores") {
        await xlsx.exportJudgeScoresXlsx(data, "hackxperience-judge-scores.xlsx");
      } else {
        await xlsx.exportProjectsXlsx(data, "hackxperience-projects.xlsx");
      }
    } catch {
      // non-critical — leave the button to be retried
    } finally {
      setExportingKind(null);
    }
  }

  async function handleEnterVotingKiosk() {
    try {
      await fetch("/api/auth/kiosk-session", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/admin/voting");
  }

  return (
    <>
      <AdminShellConfig value={{ metrics: shellMetrics }} />

      <header className={styles.contentHeader}>
        <div>
          <h2>&gt; DASHBOARD_OVERVIEW</h2>
          <p>{"// REAL-TIME SUBMISSION STATUS"}</p>
        </div>
      </header>

      <div className={styles.dashboardGrid}>
        <section className={styles.chartPanel}>
          <SectionHeader title="SUBMISSIONS_BY_TRACK" />
          <TrackChart submissions={data} activeTracks={activeTracks} />
        </section>

        <section className={styles.quickPanel}>
          <SectionHeader title="QUICK_ACTIONS" />
          <div className={styles.quickActions}>
            <ToggleRow
              label="SUBMISSIONS OPEN"
              enabled={submissionsOpen}
              onToggle={toggleSubmissionsOpen}
            />
            <ToggleRow
              label="ALLOW RESUBMISSIONS"
              enabled={allowResubmissions}
              onToggle={toggleAllowResubmissions}
            />
            <button
              type="button"
              className={styles.exportButton}
              onClick={() => handleExport("results")}
              disabled={exportingKind !== null}
            >
              {exportingKind === "results" ? "[ GENERATING... ]" : "[ EXPORT RESULTS XLSX ]"}
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={() => handleExport("scores")}
              disabled={exportingKind !== null}
            >
              {exportingKind === "scores" ? "[ GENERATING... ]" : "[ EXPORT JUDGE SCORE HISTORY ]"}
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={() => handleExport("projects")}
              disabled={exportingKind !== null}
            >
              {exportingKind === "projects" ? "[ GENERATING... ]" : "[ EXPORT PROJECTS LISTING ]"}
            </button>
            <button type="button" className={styles.quickLink} onClick={() => void handleEnterVotingKiosk()}>
              [ OPEN COMMUNITY VOTING ]
            </button>
          </div>
        </section>
      </div>

      <ActivityLogsClient embedded />
    </>
  );
}
