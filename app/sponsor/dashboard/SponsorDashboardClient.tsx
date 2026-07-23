/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { C, FM, FB, SHADOW, SPRING, RESPONSIVE_CSS } from "./constants";

type SponsorAward = "entrepreneurial" | "microsoft_foundry";
type SortMode = "roam" | "mine";

type SponsorProject = {
  id: string;
  projectName: string;
  teamId: string;
  track: string;
  memberCount: number;
  thumbnailUrl: string | null;
  usesMicrosoftFoundry: boolean;
  judgeAvg: number | null;
  roamRank: number;
  sponsorScore: number | null;
  sponsorComment: string | null;
  sponsorRank: number | null;
  sponsorUpdatedAt: string | null;
};

type ProjectsResponse = {
  award: SponsorAward;
  roamCriterion: "entrepreneurship" | "technical_execution";
  projects: SponsorProject[];
  scoredCount: number;
  totalCount: number;
  winner: { submissionId: string; projectName: string; score: number } | null;
  session: { username: string; role: string };
  error?: string;
};

type DraftState = {
  score: string;
  comment: string;
  dirty: boolean;
  saving: boolean;
  error: string;
};

const AWARDS: { key: SponsorAward; label: string; short: string }[] = [
  { key: "entrepreneurial", label: "Entrepreneurial Award", short: "ENTREPRENEURIAL" },
  { key: "microsoft_foundry", label: "Microsoft AI Foundry Award", short: "MS AI FOUNDRY" },
];

function roamLabel(criterion: ProjectsResponse["roamCriterion"] | null) {
  if (criterion === "entrepreneurship") return "Judge avg · Entrepreneurship";
  if (criterion === "technical_execution") return "Judge avg · Technical Execution";
  return "Judge avg";
}

function blankDraft(project?: SponsorProject): DraftState {
  return {
    score: project?.sponsorScore != null ? String(project.sponsorScore) : "",
    comment: project?.sponsorComment ?? "",
    dirty: false,
    saving: false,
    error: "",
  };
}

function isScoreInvalid(value: string): boolean {
  if (!value.trim()) return true;
  const n = Number(value);
  return !Number.isInteger(n) || n < 0 || n > 100;
}

export default function SponsorDashboardClient() {
  const router = useRouter();
  const [award, setAward] = useState<SponsorAward>("entrepreneurial");
  const [sortMode, setSortMode] = useState<SortMode>("roam");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<SponsorProject[]>([]);
  const [winner, setWinner] = useState<ProjectsResponse["winner"]>(null);
  const [roamCriterion, setRoamCriterion] = useState<ProjectsResponse["roamCriterion"] | null>(null);
  const [scoredCount, setScoredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sessionUser, setSessionUser] = useState("sponsor");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  const loadProjects = useCallback(
    async (nextAward: SponsorAward) => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(`/api/sponsor/projects?award=${nextAward}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as Partial<ProjectsResponse> & { error?: string };
        if (!response.ok) {
          setLoadError(payload.error ?? "Unable to load projects.");
          if (response.status === 401 || response.status === 403) {
            router.replace("/sponsor/login");
          }
          return;
        }

        const list = Array.isArray(payload.projects) ? payload.projects : [];
        setProjects(list);
        setWinner(payload.winner ?? null);
        setRoamCriterion(payload.roamCriterion ?? null);
        setScoredCount(typeof payload.scoredCount === "number" ? payload.scoredCount : 0);
        setTotalCount(typeof payload.totalCount === "number" ? payload.totalCount : list.length);
        if (typeof payload.session?.username === "string" && payload.session.username) {
          setSessionUser(payload.session.username);
        }

        const nextDrafts: Record<string, DraftState> = {};
        for (const project of list) {
          nextDrafts[project.id] = blankDraft(project);
        }
        setDrafts(nextDrafts);
      } catch {
        setLoadError("Unable to reach the sponsor API.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadProjects(award);
  }, [award, loadProjects]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Force navigation even if logout request fails.
    }
    router.replace("/sponsor/login");
  }, [router]);

  function updateDraft(projectId: string, patch: Partial<DraftState>) {
    setDrafts((prev) => {
      const base = prev[projectId] ?? blankDraft();
      return { ...prev, [projectId]: { ...base, ...patch, dirty: true } };
    });
  }

  async function saveScore(projectId: string) {
    const draft = drafts[projectId] ?? blankDraft();
    if (isScoreInvalid(draft.score)) {
      setDrafts((prev) => ({
        ...prev,
        [projectId]: { ...draft, error: "Enter an integer score from 0–100." },
      }));
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [projectId]: { ...draft, saving: true, error: "" },
    }));

    try {
      const response = await fetch(`/api/sponsor/scores/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          award,
          score: Number(draft.score),
          comment: draft.comment.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setDrafts((prev) => ({
          ...prev,
          [projectId]: {
            ...(prev[projectId] ?? draft),
            saving: false,
            error: payload.error ?? "Unable to save score.",
          },
        }));
        return;
      }

      await loadProjects(award);
    } catch {
      setDrafts((prev) => ({
        ...prev,
        [projectId]: {
          ...(prev[projectId] ?? draft),
          saving: false,
          error: "Network error while saving.",
        },
      }));
    }
  }

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          p.teamId.toLowerCase().includes(q) ||
          p.track.toLowerCase().includes(q),
      );
    }

    if (sortMode === "mine") {
      list.sort((a, b) => {
        if (a.sponsorScore == null && b.sponsorScore == null) {
          return a.roamRank - b.roamRank;
        }
        if (a.sponsorScore == null) return 1;
        if (b.sponsorScore == null) return -1;
        if (b.sponsorScore !== a.sponsorScore) return b.sponsorScore - a.sponsorScore;
        const aTime = a.sponsorUpdatedAt ? Date.parse(a.sponsorUpdatedAt) : 0;
        const bTime = b.sponsorUpdatedAt ? Date.parse(b.sponsorUpdatedAt) : 0;
        return bTime - aTime;
      });
    } else {
      list.sort((a, b) => a.roamRank - b.roamRank);
    }

    return list;
  }, [projects, searchQuery, sortMode]);

  const progressPct = totalCount > 0 ? Math.round((scoredCount / totalCount) * 100) : 0;
  const activeAwardMeta = AWARDS.find((item) => item.key === award)!;

  return (
    <div style={{ minHeight: "100vh", background: C.bgPrimary }}>
      <style>{RESPONSIVE_CSS}</style>

      {/* Topbar */}
      <header
        className="sp-topbar"
        style={{
          height: 54,
          borderBottom: `1px solid ${C.primary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: C.bgPrimary,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: FB, fontSize: 22, color: C.textPrimary, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            HACK<span style={{ color: C.primary }}>X</span>SPONSOR
          </span>
          <span className="sp-topbar-meta" style={{ fontFamily: FM, fontSize: 12, color: C.borderMedium }}>
            |
          </span>
          <span className="sp-topbar-meta" style={{ fontFamily: FM, fontSize: 11, color: C.textMuted, letterSpacing: "0.06em" }}>
            SPONSOR PORTAL
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="sp-topbar-meta" style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FM, fontSize: 11, color: C.textMuted }}>
            STATUS:
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.textSuccess,
                  boxShadow: `0 0 6px ${C.textSuccess}`,
                  display: "inline-block",
                }}
              />
              <span style={{ color: C.textSuccess, fontWeight: 700 }}>LIVE JUDGING</span>
            </span>
          </div>
          <div className="sp-topbar-meta" style={{ fontFamily: FM, fontSize: 11, color: C.textMuted }}>
            HACKXPERIENCE &apos;26
          </div>
          <div style={{ fontFamily: FM, fontSize: 11, color: C.textMuted }}>
            SPONSOR: <span style={{ color: C.textPrimary, fontWeight: 700 }}>{sessionUser}</span>
          </div>
          <motion.button
            type="button"
            onClick={handleLogout}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            className="sp-ghost-btn"
            style={{
              height: 28,
              padding: "0 14px",
              background: "transparent",
              border: `1.5px solid ${C.primary}`,
              fontFamily: FM,
              fontSize: 11,
              color: C.primary,
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            LOGOUT
          </motion.button>
        </div>
      </header>

      {/* Hero */}
      <div
        className="sp-hero"
        style={{
          borderBottom: `1px solid ${C.primary}`,
          padding: "18px 32px 16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(29,28,23,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(29,28,23,0.04) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 22,
              padding: "0 10px",
              background: C.primary,
              color: C.white,
              fontFamily: FM,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            // AWARD SCORING · BOOTH ROAM
          </span>
          <h1
            className="sp-hero-h1"
            style={{
              margin: 0,
              fontFamily: FB,
              fontSize: 40,
              letterSpacing: "0.02em",
              color: C.textPrimary,
              lineHeight: 1,
            }}
          >
            SCORE TEAMS · PICK YOUR #1
          </h1>
          <p style={{ margin: "10px 0 0", fontFamily: FM, fontSize: 12, color: C.textMuted, maxWidth: 560, lineHeight: 1.5 }}>
            Required score 0–100 per team. Highest score wins the award — no separate winner button.
            Default order follows judge averages for booth roaming.
          </p>
        </div>
      </div>

      <div className="sp-body" style={{ padding: "20px 32px 40px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Award tabs */}
        <div className="sp-tabs" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {AWARDS.map((item) => {
            const active = award === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className="sp-tab"
                onClick={() => {
                  setAward(item.key);
                  setSortMode("roam");
                  setSearchQuery("");
                }}
                style={{
                  flex: 1,
                  minWidth: 180,
                  height: 44,
                  border: `1.5px solid ${active ? C.primary : C.textPrimary}`,
                  background: active ? C.primary : C.bgCard,
                  color: active ? C.white : C.textPrimary,
                  fontFamily: FM,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  boxShadow: active ? SHADOW : "none",
                }}
              >
                [ {item.short} ]
              </button>
            );
          })}
        </div>

        {/* Progress + winner */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
          className="sp-stat-grid"
        >
          <div
            style={{
              background: C.bgCard,
              border: `1.5px solid ${C.textPrimary}`,
              boxShadow: SHADOW,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontFamily: FM, fontSize: 10, color: C.primary, letterSpacing: "0.1em", marginBottom: 6 }}>
              // {activeAwardMeta.short} · PROGRESS
            </div>
            <div style={{ fontFamily: FB, fontSize: 28, color: C.textPrimary, letterSpacing: "0.02em" }}>
              {scoredCount} / {totalCount} SCORED
            </div>
            <div style={{ marginTop: 10, height: 8, background: C.borderLight, position: "relative" }}>
              <div
                className="sp-progress-fill"
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${progressPct}%`,
                  background: C.primary,
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: C.bgCard,
              border: `1.5px solid ${C.textPrimary}`,
              boxShadow: SHADOW,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontFamily: FM, fontSize: 10, color: C.primary, letterSpacing: "0.1em", marginBottom: 6 }}>
              // CURRENT #1 BY YOUR SCORES
            </div>
            {winner ? (
              <>
                <div style={{ fontFamily: FB, fontSize: 24, color: C.textPrimary, letterSpacing: "0.02em", lineHeight: 1.05 }}>
                  {winner.projectName}
                </div>
                <div style={{ marginTop: 6, fontFamily: FM, fontSize: 12, color: C.textMuted }}>
                  SCORE <span style={{ color: C.primary, fontWeight: 700 }}>{winner.score}</span> / 100
                </div>
              </>
            ) : (
              <div style={{ fontFamily: FM, fontSize: 13, color: C.textMuted, paddingTop: 4 }}>
                No scores yet
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <input
            className="sp-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search project, team id, track…"
            style={{
              flex: "1 1 220px",
              height: 40,
              padding: "0 12px",
              border: `1.5px solid ${C.textPrimary}`,
              background: C.bgCard,
              fontFamily: FM,
              fontSize: 12,
              color: C.textPrimary,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {(
              [
                { key: "roam", label: "SORT: ROAM (JUDGE AVG)" },
                { key: "mine", label: "SORT: MY SCORE" },
              ] as const
            ).map((item) => {
              const active = sortMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className="sp-ghost-btn"
                  onClick={() => setSortMode(item.key)}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    border: `1.5px solid ${active ? C.primary : C.textPrimary}`,
                    background: active ? "rgba(204,0,0,0.08)" : C.bgCard,
                    color: active ? C.primary : C.textPrimary,
                    fontFamily: FM,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontFamily: FM, fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
          // {roamLabel(roamCriterion)} · nulls last · {filteredProjects.length} shown
        </div>

        {loadError && (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              border: `1.5px solid ${C.primary}`,
              background: "rgba(204,0,0,0.06)",
              fontFamily: FM,
              fontSize: 12,
              color: C.primary,
            }}
          >
            // ERROR: {loadError}
          </div>
        )}

        {loading ? (
          <div style={{ fontFamily: FM, fontSize: 13, color: C.textMuted, padding: "32px 0" }}>
            // LOADING PROJECTS…
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ fontFamily: FM, fontSize: 13, color: C.textMuted, padding: "32px 0" }}>
            // NO APPROVED TEAMS FOR THIS AWARD
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredProjects.map((project) => {
              const draft = drafts[project.id] ?? blankDraft(project);
              const isWinner = winner?.submissionId === project.id;
              const invalid = draft.score.trim() !== "" && isScoreInvalid(draft.score);

              return (
                <div
                  key={project.id}
                  style={{
                    background: C.bgCard,
                    border: `1.5px solid ${isWinner ? C.primary : C.textPrimary}`,
                    boxShadow: isWinner ? SHADOW : "none",
                    padding: "16px 16px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span
                          style={{
                            fontFamily: FM,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            color: C.primary,
                            border: `1px solid ${C.primary}`,
                            padding: "2px 8px",
                          }}
                        >
                          ROAM #{project.roamRank}
                        </span>
                        {project.sponsorRank != null && (
                          <span
                            style={{
                              fontFamily: FM,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              color: C.textMuted,
                              border: `1px solid ${C.borderMedium}`,
                              padding: "2px 8px",
                            }}
                          >
                            YOUR RANK #{project.sponsorRank}
                          </span>
                        )}
                        {isWinner && (
                          <span
                            style={{
                              fontFamily: FM,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              background: C.primary,
                              color: C.white,
                              padding: "2px 8px",
                            }}
                          >
                            #1 WINNER
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: FB,
                          fontSize: 26,
                          letterSpacing: "0.02em",
                          color: C.textPrimary,
                          lineHeight: 1.05,
                        }}
                      >
                        {project.projectName}
                      </div>
                      <div style={{ marginTop: 6, fontFamily: FM, fontSize: 11, color: C.textMuted }}>
                        {project.teamId} · {project.track} · {project.memberCount} member
                        {project.memberCount === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontFamily: FM, fontSize: 11, color: C.textMuted }}>
                      <div style={{ letterSpacing: "0.06em", marginBottom: 4 }}>JUDGE AVG</div>
                      <div style={{ fontFamily: FB, fontSize: 28, color: C.textPrimary, lineHeight: 1 }}>
                        {project.judgeAvg != null ? project.judgeAvg : "—"}
                      </div>
                      {project.judgeAvg == null && (
                        <div style={{ marginTop: 2, color: C.textMuted }}>Unscored</div>
                      )}
                    </div>
                  </div>

                  <div
                    className="sp-card-actions"
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      borderTop: `1px solid ${C.borderLight}`,
                      paddingTop: 12,
                    }}
                  >
                    <div style={{ flex: "0 0 auto" }}>
                      <div style={{ fontFamily: FM, fontSize: 10, color: C.primary, letterSpacing: "0.08em", marginBottom: 6 }}>
                        YOUR SCORE (0–100) *
                      </div>
                      <input
                        className="sp-score-input"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={draft.score}
                        onChange={(e) =>
                          updateDraft(project.id, { score: e.target.value, error: "" })
                        }
                        placeholder="0–100"
                        style={{
                          width: 110,
                          height: 42,
                          padding: "0 10px",
                          border: `1.5px solid ${invalid ? C.primary : C.textPrimary}`,
                          background: "#fff",
                          fontFamily: FM,
                          fontSize: 16,
                          fontWeight: 700,
                          color: C.textPrimary,
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 180px" }}>
                      <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, letterSpacing: "0.08em", marginBottom: 6 }}>
                        PRIVATE NOTE (OPTIONAL)
                      </div>
                      <input
                        type="text"
                        value={draft.comment}
                        onChange={(e) =>
                          updateDraft(project.id, { comment: e.target.value, error: "" })
                        }
                        placeholder="Booth notes…"
                        maxLength={500}
                        style={{
                          width: "100%",
                          height: 42,
                          padding: "0 10px",
                          border: `1.5px solid ${C.borderMedium}`,
                          background: "#fff",
                          fontFamily: FM,
                          fontSize: 12,
                          color: C.textPrimary,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div style={{ flex: "0 0 auto", paddingTop: 18 }}>
                      <button
                        type="button"
                        className="sp-save-btn"
                        disabled={draft.saving || isScoreInvalid(draft.score)}
                        onClick={() => void saveScore(project.id)}
                        style={{
                          height: 42,
                          padding: "0 18px",
                          background: C.primary,
                          border: `1.5px solid ${C.primary}`,
                          color: C.white,
                          fontFamily: FM,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                          boxShadow: SHADOW,
                        }}
                      >
                        {draft.saving ? "SAVING…" : draft.dirty || project.sponsorScore == null ? "SAVE" : "SAVED"}
                      </button>
                    </div>
                  </div>

                  {draft.error && (
                    <div style={{ marginTop: 8, fontFamily: FM, fontSize: 11, color: C.primary }}>
                      // {draft.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .sp-stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
