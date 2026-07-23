/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, LogOut, Menu, Search, Trophy, X } from "lucide-react";
import {
  C,
  FM,
  FB,
  SHADOW,
  SHADOW_DARK,
} from "../dashboard/constants";

type CriterionAverages = {
  technical: number | null;
  problem: number | null;
  innovation: number | null;
  presentation: number | null;
  entrepreneurship: number | null;
};

type ScoreMaxima = {
  technical: number;
  problem: number;
  innovation: number;
  presentation: number;
  entrepreneurship: number;
  overall: number;
};

type JudgeScoreProject = {
  id: string;
  projectName: string;
  teamId: string;
  track: string;
  criteria: CriterionAverages;
  overallJudgeAvg: number | null;
  judgeCount: number;
  trackPlace: 1 | 2 | null;
};

type JudgeScoresResponse = {
  projects: JudgeScoreProject[];
  maxima: ScoreMaxima;
  session: { username: string; role: string };
  error?: string;
};

const DEFAULT_MAXIMA: ScoreMaxima = {
  technical: 20,
  problem: 20,
  innovation: 30,
  presentation: 20,
  entrepreneurship: 10,
  overall: 100,
};

function fmtAvg(value: number | null, max: number): string {
  return value != null ? `${value}/${max}` : "—";
}

function normalizeCriteria(raw: unknown): CriterionAverages {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (key: string) =>
    typeof row[key] === "number" ? (row[key] as number) : null;
  return {
    technical: num("technical"),
    problem: num("problem"),
    innovation: num("innovation"),
    presentation: num("presentation"),
    entrepreneurship: num("entrepreneurship"),
  };
}

const PAGE_CSS = `
  .sp-scores-table { width: 100%; border-collapse: collapse; }
  .sp-scores-table th,
  .sp-scores-table td {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1.5px solid #d8d2c5;
    vertical-align: middle;
  }
  .sp-scores-table th {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7a7669;
    background: #f2ede5;
    position: sticky;
    top: 0;
    z-index: 2;
    border-bottom: 2px solid #1d1c17;
  }
  .sp-scores-table tbody tr:hover td { background: rgba(204,0,0,0.04); }
  .sp-scores-num { text-align: right !important; font-variant-numeric: tabular-nums; }
  .sp-logout-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .sp-logout-btn:hover { background: #CC0000; color: #fef9f1; border-color: #CC0000; }
  .sp-hamburger { transition: border-color 0.15s, color 0.15s, background 0.15s; }
  .sp-hamburger:hover { border-color: #CC0000; color: #CC0000; background: rgba(204,0,0,0.07); }
  .sp-input:focus {
    outline: none;
    border-color: #CC0000 !important;
    box-shadow: 3px 3px 0 0 #CC0000;
  }
  .sp-menu-link { transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .sp-menu-link:hover { border-color: #CC0000; color: #CC0000; background: rgba(204,0,0,0.06); }

  @media (max-width: 720px) {
    .sp-scores-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .sp-scores-table { min-width: 980px; }
    .sp-scores-body { padding: 14px !important; }
  }
`;

function trackTone(track: string): "care" | "friction" | "other" {
  const normalized = track.trim().toLowerCase();
  if (normalized.includes("care")) return "care";
  if (normalized.includes("friction")) return "friction";
  return "other";
}

function TrackPill({ track }: { track: string }) {
  const tone = trackTone(track);
  const label =
    tone === "care" ? "Care" : tone === "friction" ? "Friction" : track.trim() || "Track";
  const bg = tone === "care" ? C.redSoft : tone === "friction" ? C.azureSoft : C.cardAlt;
  const color = tone === "care" ? C.red : tone === "friction" ? C.azure : C.muted;
  const border =
    tone === "care" ? C.red : tone === "friction" ? C.azure : C.borderStrong;

  return (
    <span
      title={track}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        borderRadius: 0,
        background: bg,
        color,
        border: `1.5px solid ${border}`,
        fontFamily: FM,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function TrackPlaceMark({ place }: { place: 1 | 2 }) {
  const isWinner = place === 1;
  return (
    <span
      title={isWinner ? "Track winner" : "Track runner-up"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 20,
        padding: "0 6px",
        marginLeft: 6,
        borderRadius: 0,
        background: isWinner ? C.gold : C.silver,
        border: `1.5px solid ${C.borderStrong}`,
        fontFamily: FM,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: C.text,
      }}
    >
      <Trophy size={10} aria-hidden />
      {isWinner ? "1st" : "2nd"}
    </span>
  );
}

export default function SponsorJudgeScoresClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<JudgeScoreProject[]>([]);
  const [maxima, setMaxima] = useState<ScoreMaxima>(DEFAULT_MAXIMA);
  const [sessionUser, setSessionUser] = useState("sponsor");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadScores = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/sponsor/judge-scores", { cache: "no-store" });
      const payload = (await res.json()) as Partial<JudgeScoresResponse> & { error?: string };
      if (!res.ok) {
        setLoadError(payload.error ?? "Unable to load judge scores.");
        if (res.status === 401 || res.status === 403) {
          router.replace("/sponsor/login");
        }
        return;
      }
      const list = Array.isArray(payload.projects) ? payload.projects : [];
      setProjects(
        list.map((project) => ({
          ...project,
          criteria: normalizeCriteria(project.criteria),
          overallJudgeAvg:
            typeof project.overallJudgeAvg === "number" ? project.overallJudgeAvg : null,
          judgeCount: typeof project.judgeCount === "number" ? project.judgeCount : 0,
          trackPlace:
            project.trackPlace === 1 || project.trackPlace === 2 ? project.trackPlace : null,
        })),
      );
      const m = payload.maxima;
      setMaxima({
        technical:
          typeof m?.technical === "number" ? m.technical : DEFAULT_MAXIMA.technical,
        problem: typeof m?.problem === "number" ? m.problem : DEFAULT_MAXIMA.problem,
        innovation:
          typeof m?.innovation === "number" ? m.innovation : DEFAULT_MAXIMA.innovation,
        presentation:
          typeof m?.presentation === "number" ? m.presentation : DEFAULT_MAXIMA.presentation,
        entrepreneurship:
          typeof m?.entrepreneurship === "number"
            ? m.entrepreneurship
            : DEFAULT_MAXIMA.entrepreneurship,
        overall: typeof m?.overall === "number" && m.overall > 0 ? m.overall : DEFAULT_MAXIMA.overall,
      });
      if (typeof payload.session?.username === "string" && payload.session.username) {
        setSessionUser(payload.session.username);
      }
    } catch {
      setLoadError("Unable to reach the sponsor API.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Force navigation even if logout request fails.
    }
    router.replace("/sponsor/login");
  }, [router]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.teamId.toLowerCase().includes(q) ||
        p.track.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FM }}>
      <style>{PAGE_CSS}</style>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: `2px solid ${C.borderStrong}`,
          background: C.card,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 0,
              background: C.red,
              color: C.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FB,
              fontSize: 20,
              letterSpacing: "0.02em",
              boxShadow: SHADOW_DARK,
            }}
          >
            S
          </div>
          <div>
            <div style={{ fontFamily: FB, fontSize: 24, letterSpacing: "0.02em", lineHeight: 1 }}>
              HACK<span style={{ color: C.red }}>X</span>SPONSOR
            </div>
            <div style={{ fontFamily: FM, fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginTop: 2 }}>
              // JUDGE SCORES
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sp-hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${C.borderStrong}`,
            borderRadius: 0,
            background: C.white,
            color: C.text,
            cursor: "pointer",
          }}
        >
          <Menu size={20} aria-hidden />
        </button>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(29,28,23,0.55)",
              border: "none",
              padding: 0,
              zIndex: 60,
              cursor: "pointer",
            }}
          />
          <nav
            aria-label="Sponsor menu"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100%",
              width: "min(300px, 86vw)",
              background: C.card,
              borderLeft: `2px solid ${C.red}`,
              zIndex: 61,
              display: "flex",
              flexDirection: "column",
              boxShadow: SHADOW,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: `2px solid ${C.borderStrong}`,
              }}
            >
              <span style={{ fontFamily: FB, fontSize: 22, letterSpacing: "0.02em" }}>
                HACK<span style={{ color: C.red }}>X</span>SPONSOR
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `2px solid ${C.red}`,
                  borderRadius: 0,
                  background: "transparent",
                  color: C.red,
                  cursor: "pointer",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div style={{ padding: "18px 16px", borderBottom: `1.5px solid ${C.border}` }}>
              <div style={{ fontFamily: FM, fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 6 }}>
                // SIGNED IN AS
              </div>
              <div style={{ fontFamily: FM, fontSize: 16, fontWeight: 700 }}>{sessionUser}</div>
              <div style={{ fontFamily: FM, fontSize: 11, fontWeight: 700, marginTop: 4, color: C.red, letterSpacing: "0.06em" }}>
                // SPONSOR
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              <Link
                href="/sponsor/dashboard"
                className="sp-menu-link"
                onClick={() => setMenuOpen(false)}
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  padding: "0 16px",
                  border: `2px solid ${C.borderStrong}`,
                  borderRadius: 0,
                  background: C.white,
                  color: C.text,
                  fontFamily: FM,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  boxShadow: SHADOW_DARK,
                  boxSizing: "border-box",
                }}
              >
                <ClipboardList size={16} aria-hidden />
                Score projects
              </Link>

              <button
                type="button"
                className="sp-logout-btn"
                onClick={() => {
                  setMenuOpen(false);
                  void handleLogout();
                }}
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  padding: "0 16px",
                  border: `2px solid ${C.red}`,
                  borderRadius: 0,
                  background: C.bg,
                  color: C.red,
                  fontFamily: FM,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: SHADOW,
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>LOGOUT</span>
              </button>
            </div>
          </nav>
        </>
      )}

      <div className="sp-scores-body" style={{ padding: "20px 24px 40vh", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: FB, fontSize: 36, letterSpacing: "0.02em", margin: 0, lineHeight: 1 }}>
            JUDGE SCORES
          </h1>
          <p style={{ fontFamily: FM, fontSize: 12, color: C.muted, margin: "8px 0 0", letterSpacing: "0.04em" }}>
            // CRITERION AVERAGES + OVERALL (OUT OF {maxima.overall})
          </p>
        </div>

        <div
          style={{
            background: C.card,
            border: `2px solid ${C.red}`,
            boxShadow: SHADOW,
            padding: 16,
          }}
        >
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search
              size={16}
              aria-hidden
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: C.muted,
                pointerEvents: "none",
              }}
            />
            <input
              className="sp-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="// SEARCH PROJECTS…"
              aria-label="Search projects"
              style={{
                width: "100%",
                minHeight: 44,
                padding: "0 12px 0 38px",
                borderRadius: 0,
                border: `2px solid ${C.borderStrong}`,
                background: C.white,
                fontFamily: FM,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: C.text,
                boxSizing: "border-box",
              }}
            />
          </div>

          {loadError && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                border: `2px solid ${C.red}`,
                background: C.redSoft,
                fontFamily: FM,
                fontSize: 13,
                fontWeight: 700,
                color: C.red,
                boxShadow: SHADOW,
              }}
            >
              {loadError}
            </div>
          )}

          {loading ? (
            <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, padding: "24px 0", color: C.muted, letterSpacing: "0.06em" }}>
              // LOADING SCORES…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, padding: "24px 0", color: C.muted, letterSpacing: "0.06em" }}>
              // NO PROJECTS FOUND
            </div>
          ) : (
            <div className="sp-scores-wrap">
              <table className="sp-scores-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Project</th>
                    <th>Team ID</th>
                    <th>Track</th>
                    <th className="sp-scores-num" title="Technical Execution">Tech</th>
                    <th className="sp-scores-num" title="Problem-Solution Fit">Problem</th>
                    <th className="sp-scores-num" title="Innovation & Creativity">Innov</th>
                    <th className="sp-scores-num" title="Presentation Quality">Present</th>
                    <th className="sp-scores-num" title="Entrepreneurship">Entrep</th>
                    <th className="sp-scores-num">Overall</th>
                    <th className="sp-scores-num">Judges</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project, index) => (
                    <tr key={project.id}>
                      <td style={{ fontWeight: 700, color: C.muted }}>{index + 1}</td>
                      <td>
                        <span style={{ fontFamily: FB, fontSize: 20, letterSpacing: "0.02em", lineHeight: 1 }}>
                          {project.projectName}
                        </span>
                        {project.trackPlace != null && <TrackPlaceMark place={project.trackPlace} />}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>{project.teamId}</td>
                      <td>
                        <TrackPill track={project.track} />
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 12 }}>
                        {fmtAvg(project.criteria.technical, maxima.technical)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 12 }}>
                        {fmtAvg(project.criteria.problem, maxima.problem)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 12 }}>
                        {fmtAvg(project.criteria.innovation, maxima.innovation)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 12 }}>
                        {fmtAvg(project.criteria.presentation, maxima.presentation)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 12 }}>
                        {fmtAvg(project.criteria.entrepreneurship, maxima.entrepreneurship)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, fontSize: 14 }}>
                        {fmtAvg(project.overallJudgeAvg, maxima.overall)}
                      </td>
                      <td className="sp-scores-num" style={{ fontWeight: 700, color: C.muted }}>
                        {project.judgeCount > 0 ? project.judgeCount : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
