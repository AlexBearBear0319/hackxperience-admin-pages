/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { JudgeProject } from "@/lib/types";
import { C, FM, FB, SPRING, SHADOW, RESPONSIVE_CSS } from "./constants";
import { makeBlankScore, calcLiveTotal, calcMaxTotal, isFieldInvalid, type CriterionKey, type ScoringCriterion } from "./scoring";
import type { ScoreEntry } from "./types";
import { PlaceholderThumb } from "./components/atoms";
import { ScoringPanel } from "./components/ScoringPanel";
import { OverlayModal } from "./components/OverlayModal";
import { useSettings } from "@/lib/hooks/use-settings";

type JudgeProjectsResponse = {
  projects: JudgeProject[];
  savedScores: Record<
    string,
    {
      technical_execution: number | null;
      problem_solution_fit: number | null;
      innovation_creativity: number | null;
      presentation_quality: number | null;
      entrepreneurship: number | null;
      private_comment: string | null;
      total: number | null;
    }
  >;
  session: {
    username: string;
    role: "judge";
  };
  submissionStatusOpen: boolean;
};

// ── Sidebar nav items (visual only — no routing needed for judge portal) ──
const NAV_ITEMS = [
  { key: "score", label: "SCORE PROJECTS", icon: "◆", active: true },
] as const;

export default function JudgeDashboardClient() {
  const { settings } = useSettings();
  const router = useRouter();
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [overlayProject, setOverlayProject] = useState<JudgeProject | null>(null);
  const [activeTrack,    setActiveTrack]    = useState<string>("ALL");
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const [projectsData,   setProjectsData]   = useState<JudgeProject[]>([]);
  const [scores,         setScores]         = useState<Record<string, ScoreEntry>>({});
  const [sessionUser,    setSessionUser]    = useState("judge");
  const [submissionOpen, setSubmissionOpen] = useState(true);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState("");
  const [searchQuery,    setSearchQuery]    = useState("");

  const scoringCriteria = useMemo<readonly ScoringCriterion[]>(
    () => [
      {
        key: "techExec",
        label: "Technical Execution",
        max: Math.max(0, Math.round(settings.technical_execution_value)),
      },
      {
        key: "problemSolution",
        label: "Problem-Solution Fit",
        max: Math.max(0, Math.round(settings.problem_solution_fit_value)),
      },
      {
        key: "innovation",
        label: "Innovation & Creativity",
        max: Math.max(0, Math.round(settings.innovation_creativity_value)),
      },
      {
        key: "presentation",
        label: "Presentation Quality",
        max: Math.max(0, Math.round(settings.presentation_quality_value)),
      },
      {
        key: "entrepreneurship",
        label: "Entrepreneurship",
        max: Math.max(0, Math.round(settings.entrepreneurship_value)),
      },
    ],
    [
      settings.innovation_creativity_value,
      settings.presentation_quality_value,
      settings.problem_solution_fit_value,
      settings.technical_execution_value,
      settings.entrepreneurship_value,
    ],
  );

  const maxScoreTotal = useMemo(() => calcMaxTotal(scoringCriteria), [scoringCriteria]);

  const TRACKS = useMemo(
    () => ["ALL", ...Array.from(new Set(projectsData.map((project) => project.track)))],
    [projectsData]
  );

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/judge/projects", { cache: "no-store" });
      const payload = (await response.json()) as Partial<JudgeProjectsResponse> & { error?: string };
      if (!response.ok) {
        setLoadError(payload.error ?? "Unable to load projects.");
        if (response.status === 401 || response.status === 403) {
          router.replace("/judge/login");
        }
        return;
      }

      const projects = Array.isArray(payload.projects) ? payload.projects : [];
      const savedScores = payload.savedScores ?? {};
      const mergedScores: Record<string, ScoreEntry> = {};

      for (const project of projects) {
        const saved = savedScores[project.id];
        mergedScores[project.id] = {
          techExec: saved?.technical_execution != null ? String(saved.technical_execution) : "",
          problemSolution: saved?.problem_solution_fit != null ? String(saved.problem_solution_fit) : "",
          innovation: saved?.innovation_creativity != null ? String(saved.innovation_creativity) : "",
          presentation: saved?.presentation_quality != null ? String(saved.presentation_quality) : "",
          entrepreneurship: saved?.entrepreneurship != null ? String(saved.entrepreneurship) : "",
          comment: saved?.private_comment ?? "",
          saved: typeof saved?.total === "number",
          savedTotal: typeof saved?.total === "number" ? saved.total : 0,
        };
      }

      setProjectsData(projects);
      setScores(mergedScores);
      if (typeof payload.session?.username === "string" && payload.session.username) {
        setSessionUser(payload.session.username);
      }
      if (typeof payload.submissionStatusOpen === "boolean") {
        setSubmissionOpen(payload.submissionStatusOpen);
      }
    } catch {
      setLoadError("Unable to reach the judge API.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setSubmissionOpen(settings.submission_status);
  }, [settings.submission_status]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network failures and force logout navigation.
    }
    router.replace("/judge/login");
  }, [router]);

  function updateScore(projectId: string, field: string, value: string) {
    setScores((prev) => {
      const base = prev[projectId] ?? makeBlankScore();
      return { ...prev, [projectId]: { ...base, [field]: value, saved: false } };
    });
  }

  async function saveScore(projectId: string) {
    const score = scores[projectId] ?? makeBlankScore();
    if (scoringCriteria.some((criterion) => isFieldInvalid(score[criterion.key as CriterionKey], criterion.max))) {
      return;
    }

    const response = await fetch(`/api/judge/scores/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        techExec: score.techExec,
        problemSolution: score.problemSolution,
        innovation: score.innovation,
        presentation: score.presentation,
        entrepreneurship: score.entrepreneurship,
        comment: score.comment,
      }),
    });

    const payload = await response.json().catch(() => ({} as { error?: string; total?: number }));
    if (!response.ok) {
      setLoadError(payload.error ?? "Unable to save score.");
      return;
    }

    const total = typeof payload.total === "number" ? payload.total : calcLiveTotal(score, scoringCriteria);
    setScores((prev) => ({
      ...prev,
      [projectId]: { ...(prev[projectId] ?? makeBlankScore()), saved: true, savedTotal: total },
    }));
  }

  // Filtered projects for the queue
  const filteredProjects = useMemo(() => {
    let list = activeTrack === "ALL" ? projectsData : projectsData.filter((p) => p.track === activeTrack);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q));
    }
    return list;
  }, [projectsData, activeTrack, searchQuery]);

  const scoredCount   = projectsData.filter((p) => scores[p.id]?.saved).length;
  const remaining     = projectsData.length - scoredCount;
  const progressPct   = projectsData.length > 0 ? Math.round((scoredCount / projectsData.length) * 100) : 0;
  const expandedProject = projectsData.find((p) => p.id === expandedId) ?? null;

  return (
    <div style={{ minHeight: "100vh", background: C.bgPrimary }}>
      <style>{RESPONSIVE_CSS}</style>
      {/* ── Content ── */}
      <div className="r-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Topbar ── */}
      <header
        className="r-topbar"
        style={{
          height: 54, background: C.bgPrimary,
          borderBottom: `1px solid ${C.primary}`,
          boxShadow: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", flexShrink: 0, position: "sticky", top: 0, zIndex: 20,
        }}
      >
        {/* Left: Logo + subtitle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: FB, fontSize: 22, color: C.textPrimary, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            HACK<span style={{ color: C.primary }}>X</span>JUDGE
          </span>
          <span className="r-topbar-status" style={{ fontFamily: FM, fontSize: 12, color: C.borderMedium }}>|</span>
          <span className="r-topbar-status" style={{ fontFamily: FM, fontSize: 11, color: C.textMuted, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            JUDGE PORTAL
          </span>
        </div>

        {/* Right: status + user + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {/* Submission status pill */}
          <div className="r-topbar-status" style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FM, fontSize: 11, color: C.textMuted }}>
            SUBMISSION STATUS:
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: submissionOpen ? C.textSuccess : C.textMuted,
                boxShadow: submissionOpen ? `0 0 6px ${C.borderSuccess}` : "none",
                display: "inline-block",
              }} />
              <span style={{ color: submissionOpen ? C.textSuccess : C.textMuted, fontWeight: 700 }}>
                {submissionOpen ? "OPEN" : "CLOSED"}
              </span>
            </span>
          </div>

          {/* Judge identity */}
          <div className="r-topbar-email" style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FM, fontSize: 11, color: C.textMuted }}>
            JUDGE:
            <span style={{ color: C.textPrimary, fontWeight: 700, marginLeft: 4 }}>{sessionUser}</span>
          </div>

          {/* Logout */}
          <motion.button
            className="r-topbar-logout"
            onClick={handleLogout}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            style={{
              height: 28, padding: "0 14px", background: "transparent",
              border: `1.5px solid ${C.primary}`, borderRadius: 0,
              fontFamily: FM, fontSize: 11, color: C.primary,
              cursor: "pointer", letterSpacing: "0.06em", whiteSpace: "nowrap",
            }}
          >
            LOGOUT
          </motion.button>

          {/* Hamburger */}
          <button
            className="r-hamburger"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            style={{
              background: "none", border: `1px solid ${C.borderMedium}`, color: C.textMuted,
              width: 32, height: 32, cursor: "pointer",
              alignItems: "center", justifyContent: "center", padding: 0,
              flexShrink: 0, transition: "border-color 0.15s, color 0.15s",
            }}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
              <rect y="0" width="16" height="2" rx="1"/>
              <rect y="5" width="16" height="2" rx="1"/>
              <rect y="10" width="16" height="2" rx="1"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div
        className="r-hero"
        style={{ background: C.bgPrimary, borderBottom: `1px solid ${C.primary}`, padding: "16px 32px 14px", position: "relative", overflow: "hidden", flexShrink: 0 }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(29,28,23,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(29,28,23,0.04) 1px, transparent 1px)`, backgroundSize: "20px 20px", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <span
            className="r-hero-badge"
            style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px", background: C.primary, color: C.white, fontFamily: FM, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}
          >
            // MODULE_02 · SCORING
          </span>
          <h1
            className="r-hero-h1"
            style={{ fontFamily: FB, fontSize: 42, lineHeight: "44px", margin: 0, color: C.textPrimary }}
          >
            PROJECT <span style={{ color: C.primary }}>SUBMISSION</span> PORTAL
          </h1>
        </div>
      </div>

      {/* ── Main ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.bgPrimary, padding: "24px", gap: "24px" }}>

          {/* ── Judging Progress section ── */}
          <div
            className="r-progress-section"
            style={{
              background: C.white,
              borderRadius: 0,
              border: `1px solid ${C.primary}`,
              padding: "18px 28px 16px",
              boxShadow: SHADOW
            }}
          >
            {/* Label + bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                Judging Progress
              </div>
              <div style={{ fontFamily: FM, fontSize: 11, color: C.textPrimary, fontWeight: 700 }}>
                {progressPct}%
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: C.borderLight, borderRadius: 0, marginBottom: 10, overflow: "hidden" }}>
              <div
                className="r-progress-bar-fill"
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${C.primary})`,
                  borderRadius: 0,
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>

            {/* Scored text + stat boxes */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontFamily: FM, fontSize: 13, color: C.textPrimary }}>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{scoredCount}</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}> of </span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{projectsData.length}</span>
                <span style={{ color: C.textMuted, fontSize: 11 }}> projects scored</span>
              </div>

              {/* Stat boxes */}
              <div className="r-stat-boxes" style={{ display: "flex", gap: 16 }}>
                {[
                  { icon: "📋", label: "TOTAL PROJECTS", value: projectsData.length },
                  { icon: "✓",  label: "SCORED",         value: scoredCount },
                  { icon: "⏱", label: "REMAINING",      value: remaining },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div>
                      <div style={{ fontFamily: FM, fontSize: 18, fontWeight: 700, color: C.textPrimary, lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ fontFamily: FM, fontSize: 9, color: C.textMuted, letterSpacing: "0.06em", marginTop: 2 }}>
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {loadError && (
              <div style={{ fontFamily: FM, fontSize: 10, color: C.primary, letterSpacing: "0.04em", marginTop: 8 }}>
                // {loadError.toUpperCase()}
              </div>
            )}
          </div>

          {/* ── Project Queue ── */}
          <div
            className="r-queue-section"
            style={{ 
              background: C.white, 
              borderRadius: 0,
              border: `1px solid ${C.primary}`,
              padding: "18px 28px 24px",
              boxShadow: SHADOW
            }}
          >
            {/* Queue header */}
            <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" as const }}>
              Project Queue
            </div>

            {/* Search + filter bar */}
            <div className="r-filter-bar" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              {/* Search input */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <svg
                  width="13" height="13" viewBox="0 0 13 13" fill="none"
                  style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                >
                  <circle cx="5.5" cy="5.5" r="4" stroke={C.textMuted} strokeWidth="1.3"/>
                  <path d="M9 9l2.5 2.5" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search projects, teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    height: 30, paddingLeft: 28, paddingRight: 10,
                    background: C.bgPrimary, border: `1px solid ${C.borderMedium}`,
                    color: C.textPrimary, fontFamily: FM, fontSize: 11,
                    outline: "none", width: 190,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Track pills */}
              <div 
                className="r-track-list"
                style={{ 
                  display: "flex", alignItems: "center", gap: 8, 
                  overflowX: "auto", scrollbarWidth: "none", flexWrap: "nowrap", minWidth: 0,
                  padding: "4px 8px", margin: "-4px 0"
                }}
              >
                {TRACKS.map(track => (
                  <motion.button
                  key={track}
                  onClick={() => { setActiveTrack(track); setExpandedId(null); }}
                  whileHover={activeTrack === track ? { scale: 1.04 } : { borderColor: C.primary, boxShadow: `3px 3px 0 0 ${C.primary}` }}
                  whileTap={{ y: 1 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    padding: "4px 14px",
                    fontFamily: FM, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase" as const,
                    border: `2px solid ${activeTrack === track ? C.primary : C.textPrimary}`,
                    borderRadius: 0,
                    background: activeTrack === track ? C.primary : C.bgPrimary,
                    color: activeTrack === track ? C.white : C.textPrimary,
                    boxShadow: activeTrack === track ? "none" : `3px 3px 0 0 ${C.textPrimary}`,
                    cursor: "pointer", whiteSpace: "nowrap" as const,
                    transition: "background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {track === "ALL" ? "ALL TRACKS" : track}
                </motion.button>
                ))}
              </div>
            </div>

            {/* ── Horizontal card carousel ── */}
            {loading ? (
              <div style={{ fontFamily: FM, fontSize: 12, color: C.textMuted, textAlign: "center", padding: "24px 0", letterSpacing: "0.06em" }}>
                [ LOADING PROJECTS... ]
              </div>
            ) : filteredProjects.length === 0 ? (
              <div style={{ fontFamily: FM, fontSize: 12, color: C.textMuted, textAlign: "center", padding: "24px 0", letterSpacing: "0.06em" }}>
                [ NO APPROVED SUBMISSIONS TO SCORE YET ]
              </div>
            ) : (
              <div
                className="r-card-carousel"
                style={{
                  display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16,
                  scrollbarWidth: "thin" as const,
                }}
              >
                {filteredProjects.map((p) => {
                  const score      = scores[p.id] ?? makeBlankScore();
                  const isSelected = expandedId === p.id;
                  const liveTotal  = calcLiveTotal(score, scoringCriteria);
                  const displayScore = score.saved ? score.savedTotal : liveTotal;

                  return (
                    <motion.div
                      key={p.id}
                      className="r-project-card"
                      onClick={() => setExpandedId(isSelected ? null : p.id)}
                      whileHover={{ boxShadow: `4px 4px 0 0 ${C.textPrimary}` }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        width: 170, minWidth: 170, flexShrink: 0,
                        background: C.bgPrimary,
                        border: isSelected ? `2px solid ${C.primary}` : `1px solid ${C.borderMedium}`,
                        boxShadow: isSelected ? SHADOW : `2px 2px 0 0 ${C.textPrimary}`,
                        cursor: "pointer",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        position: "relative",
                      }}
                    >
                      {/* Selected indicator dot */}
                      {isSelected && (
                        <div style={{
                          position: "absolute", top: 6, left: 6, zIndex: 2,
                          width: 18, height: 18, background: C.primary, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3l2 2 4-4" stroke={C.white} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}

                      {/* Thumbnail */}
                      <div style={{ position: "relative", height: 90, overflow: "hidden", background: C.borderLight }}>
                        <PlaceholderThumb url={p.thumbnailUrl} alt={`${p.name} thumbnail`} w="100%" h={90} />
                      </div>

                      {/* Card info */}
                      <div style={{ padding: "8px 10px 10px" }}>
                        <div style={{ fontFamily: FM, fontSize: 11, color: C.textPrimary, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                          {p.name}
                        </div>
                        <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                          {p.teamName}
                        </div>

                        {/* Track badge */}
                        <div style={{
                          display: "inline-block", padding: "2px 6px",
                          border: `1px solid ${C.borderMedium}`, background: "rgba(204,0,0,0.06)",
                          fontFamily: FM, fontSize: 9, color: C.textMuted,
                          letterSpacing: "0.04em", marginBottom: 8,
                        }}>
                          {p.track}
                        </div>

                        {/* Score */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          {score.saved ? (
                            <span style={{ fontFamily: FM, fontSize: 14, fontWeight: 700, color: C.primary }}>
                              {displayScore}
                            </span>
                          ) : (
                            <span style={{ fontFamily: FM, fontSize: 12, color: C.textMuted }}>—</span>
                          )}
                          <span style={{ fontFamily: FM, fontSize: 10, color: C.textMuted }}>/ {maxScoreTotal}</span>
                        </div>
                        <div style={{ fontFamily: FM, fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                          {score.saved ? "Scored" : "Not scored"}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Scoring detail panel (inline under selected card) ── */}
          <AnimatePresence>
            {expandedProject && (
              <motion.div
                key={`detail-${expandedProject.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
                className="r-detail-section"
              >
                <div className="r-detail-container" style={{
                  background: C.white,
                  borderRadius: 0,
                  border: `1px solid ${C.primary}`,
                  display: "flex", gap: 0,
                  boxShadow: SHADOW,
                  overflow: "hidden"
                }}>

                  {/* Mobile-only project overview (top horizontal bar) */}
                  <div className="r-detail-mobile-only" style={{ padding: "16px", borderBottom: `1px solid ${C.borderLight}`, flexDirection: "column", gap: "12px", background: "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: 96, height: 54, borderRadius: 0, overflow: "hidden", background: C.borderLight, flexShrink: 0, position: "relative" }}>
                        {expandedProject.thumbnailUrl ? (
                          <img src={expandedProject.thumbnailUrl} alt={expandedProject.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontFamily: FM, fontSize: 8, color: C.textMuted }}>NO IMG</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {expandedProject.name}
                          </div>
                        </div>
                        <div style={{ fontFamily: FM, fontSize: 9, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                          {expandedProject.teamName}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <span style={{ padding: "2px 6px", background: C.bgPrimary, border: `1px solid ${C.borderMedium}`, borderRadius: 0, fontFamily: FM, fontSize: 8, fontWeight: 700, color: C.textPrimary, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                            {expandedProject.track}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                        <div style={{ fontFamily: FM, fontSize: 8, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase" as const }}>TOTAL SCORE</div>
                        <div style={{ fontFamily: FM, fontSize: 16, fontWeight: 700, color: C.primary, lineHeight: 1 }}>
                          {scores[expandedProject.id]?.savedTotal ?? 0} <span style={{ fontSize: 10, color: C.textMuted }}>/ {maxScoreTotal}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="r-ghost-btn"
                      onClick={() => setOverlayProject(expandedProject)}
                      style={{ width: "100%", padding: "8px 0", background: "transparent", border: `1px solid ${C.borderMedium}`, borderRadius: 0, fontFamily: FM, fontSize: 10, fontWeight: 700, color: C.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1"/>
                        <path d="M3 3h2.5M3 6h6M3 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      VIEW SUBMISSION
                    </button>
                  </div>

                  {/* Left: project image + info (Desktop) */}
                  <div
                    className="r-detail-left"
                    style={{
                      width: 260, flexShrink: 0,
                      borderRight: `1px solid ${C.borderLight}`,
                      display: "flex", flexDirection: "column",
                      background: "transparent",
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ width: "100%", aspectRatio: "16/9", position: "relative", overflow: "hidden", background: C.borderLight }}>
                      {expandedProject.thumbnailUrl ? (
                        <img
                          src={expandedProject.thumbnailUrl}
                          alt={`${expandedProject.name} thumbnail`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="100%" height="100%" style={{ position: "absolute" }}>
                            <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(204,0,0,0.15)" strokeWidth="1" />
                            <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(204,0,0,0.15)" strokeWidth="1" />
                          </svg>
                          <span style={{ fontFamily: FM, fontSize: 10, color: C.textMuted }}>[ NO IMAGE ]</span>
                        </div>
                      )}
                    </div>

                    {/* Project info */}
                    <div style={{ padding: "14px 16px", flex: 1 }}>
                      <div style={{ fontFamily: FM, fontSize: 14, color: C.textPrimary, fontWeight: 700, marginBottom: 4, wordBreak: "break-word" }}>
                        {expandedProject.name}
                      </div>
                      <div style={{ fontFamily: FM, fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                        {expandedProject.teamName}
                      </div>
                      <div style={{
                        display: "inline-block", padding: "3px 8px",
                        border: `1px solid ${C.borderMedium}`, background: "rgba(204,0,0,0.06)",
                        fontFamily: FM, fontSize: 9, color: C.textMuted,
                        letterSpacing: "0.06em", marginBottom: 14,
                      }}>
                        {expandedProject.track}
                      </div>

                      {/* Total score badge */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontFamily: FM, fontSize: 9, color: C.textMuted, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" as const }}>
                          Total Score
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          <span style={{ fontFamily: FB, fontSize: 32, color: C.textPrimary, lineHeight: 1 }}>
                            {scores[expandedProject.id]?.savedTotal ?? 0}
                          </span>
                          <span style={{ fontFamily: FM, fontSize: 13, color: C.textMuted }}>/ {maxScoreTotal}</span>
                        </div>
                      </div>

                      {/* View Submission button */}
                      <motion.button
                        onClick={() => setOverlayProject(expandedProject)}
                        whileHover={{ scale: 1.03, borderColor: C.primary }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        style={{
                          width: "100%", height: 34,
                          background: "transparent",
                          border: `1px solid ${C.textPrimary}`,
                          fontFamily: FM, fontSize: 11, color: C.textPrimary,
                          cursor: "pointer", letterSpacing: "0.06em",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          transition: "border-color 0.15s",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1"/>
                          <path d="M3 3h2.5M3 6h6M3 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                        VIEW SUBMISSION
                      </motion.button>
                    </div>
                  </div>

                  {/* Right: scoring panel */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ScoringPanel
                      score={scores[expandedProject.id] ?? makeBlankScore()}
                      onChange={(field, value) => updateScore(expandedProject.id, field, value)}
                      onSave={() => saveScore(expandedProject.id)}
                      criteria={scoringCriteria}
                      projectId={expandedProject.id}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>

      {/* Overlay modal */}
      <AnimatePresence>
        {overlayProject && (
          <OverlayModal project={overlayProject} onClose={() => setOverlayProject(null)} />
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: "fixed", inset: 0, background: "rgba(29,28,23,0.75)", zIndex: 60 }}
              onClick={() => setMobileNavOpen(false)}
            />

            {/* Drawer */}
            <motion.nav
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{
                position: "fixed", top: 0, left: 0, height: "100%", width: 260,
                background: C.bgPrimary, borderRight: `1px solid ${C.borderMedium}`,
                zIndex: 61, display: "flex", flexDirection: "column", overflowY: "auto",
              }}
              aria-label="Mobile navigation"
            >
              {/* Header */}
              <div style={{
                height: 54, padding: "0 20px", flexShrink: 0,
                borderBottom: `1px solid ${C.primary}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: FB, fontSize: 20, color: C.textPrimary }}>
                  HACK<span style={{ color: C.primary }}>X</span>JUDGE
                </span>
                <button
                  type="button"
                  className="r-icon-btn-red"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                  style={{
                    background: "transparent", border: `1px solid ${C.primary}`,
                    color: C.primary, width: 28, height: 28, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Nav */}
              <div style={{ flex: 1, paddingTop: 12 }}>
                {NAV_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => setMobileNavOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 0 12px 26px",
                      background: item.active ? "rgba(204,0,0,0.07)" : "transparent",
                      borderLeft: item.active ? `3px solid ${C.primary}` : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontFamily: FM, fontSize: 11, color: item.active ? C.primary : C.textMuted }}>
                      {item.icon}
                    </span>
                    <span style={{ fontFamily: FM, fontSize: 11, color: item.active ? C.textPrimary : C.textMuted, letterSpacing: "0.06em" }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Judge info */}
              <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.borderLight}`, borderBottom: `1px solid ${C.borderLight}` }}>
                <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted }}>
                  JUDGE: <span style={{ color: C.textPrimary, fontWeight: 700 }}>{sessionUser}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: submissionOpen ? C.textSuccess : C.textMuted,
                    display: "inline-block",
                  }} />
                  <span style={{ fontFamily: FM, fontSize: 10, color: submissionOpen ? C.textSuccess : C.textMuted }}>
                    SUBMISSION {submissionOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
              </div>

              {/* Footer logout */}
              <div style={{ flexShrink: 0, padding: "16px 20px" }}>
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING}
                  style={{
                    width: "100%", height: 34,
                    background: "transparent", border: `1px solid ${C.primary}`,
                    fontFamily: FM, fontSize: 11, color: C.primary, cursor: "pointer",
                    letterSpacing: "0.06em", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8,
                  }}
                >
                  LOGOUT
                </motion.button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
