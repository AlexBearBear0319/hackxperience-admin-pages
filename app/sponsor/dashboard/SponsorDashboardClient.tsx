"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Eye, EyeOff, LogOut, Menu, Search, Trophy, X } from "lucide-react";
import ScrollToTopButton from "@/app/components/ui/scroll-to-top-button";
import {
  C,
  FM,
  FB,
  CARD_SHADOW,
  CARD_SHADOW_ACTIVE,
  RESPONSIVE_CSS,
} from "./constants";

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
  overallJudgeAvg: number | null;
  trackPlace: 1 | 2 | null;
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
  saving: boolean;
  saved: boolean;
  error: string;
};

type AwardCounts = Record<SponsorAward, { scored: number; total: number }>;

const AWARDS: { key: SponsorAward; label: string; short: string }[] = [
  { key: "entrepreneurial", label: "Entrepreneurial Award", short: "Entrepreneurial" },
  { key: "microsoft_foundry", label: "Microsoft AI Foundry", short: "MS AI Foundry" },
];

function blankDraft(project?: SponsorProject): DraftState {
  return {
    score: project?.sponsorScore != null ? String(project.sponsorScore) : "",
    saving: false,
    saved: project?.sponsorScore != null,
    error: "",
  };
}

function isScoreInvalid(value: string): boolean {
  if (!value.trim()) return true;
  const n = Number(value);
  return !Number.isInteger(n) || n < 0 || n > 100;
}

function judgeLabel(award: SponsorAward) {
  return award === "entrepreneurial" ? "Entrep" : "Technical";
}

function TrackPlaceBadge({ place, track }: { place: 1 | 2; track: string }) {
  const isWinner = place === 1;
  const trackShort = track.length > 18 ? `${track.slice(0, 16)}…` : track;
  return (
    <span
      title={`${isWinner ? "Track winner" : "Track runner-up"} · ${track} (overall judges avg)`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: isWinner ? C.gold : C.silver,
        color: C.text,
        border: `1.5px solid ${C.borderStrong}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      <Trophy size={12} aria-hidden />
      {isWinner ? "1st" : "2nd"} · {trackShort}
    </span>
  );
}

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
  const color = tone === "care" ? C.red : tone === "friction" ? C.azure : C.text;
  const border =
    tone === "care" ? C.red : tone === "friction" ? C.azure : C.borderStrong;

  return (
    <span
      title={track}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: bg,
        color,
        border: `1.5px solid ${border}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank >= 1 && rank <= 3;
  const tone = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.border;
  return (
    <div
      aria-label={`Rank ${rank}`}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: "50%",
        background: isTop3 ? tone : C.cardAlt,
        border: isTop3 ? `2px solid ${tone}` : `2px solid ${C.borderStrong}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FM,
        fontSize: 13,
        fontWeight: 700,
        color: C.text,
      }}
    >
      #{rank}
    </div>
  );
}

function TeamThumbnail({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div
      className="sp-thumb"
      style={{
        width: 88,
        height: 66,
        flexShrink: 0,
        borderRadius: 10,
        border: `1.5px solid ${C.borderStrong}`,
        background: C.cardAlt,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: C.text,
          }}
        >
          No image
        </div>
      )}
    </div>
  );
}

export default function SponsorDashboardClient() {
  const router = useRouter();
  const [award, setAward] = useState<SponsorAward>("entrepreneurial");
  const [sortMode, setSortMode] = useState<SortMode>("roam");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<SponsorProject[]>([]);
  const [winner, setWinner] = useState<ProjectsResponse["winner"]>(null);
  const [counts, setCounts] = useState<AwardCounts>({
    entrepreneurial: { scored: 0, total: 0 },
    microsoft_foundry: { scored: 0, total: 0 },
  });
  const [sessionUser, setSessionUser] = useState("sponsor");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealTrackWinners, setRevealTrackWinners] = useState(false);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const awardRef = useRef(award);
  awardRef.current = award;

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const loadProjects = useCallback(
    async (nextAward: SponsorAward) => {
      setLoading(true);
      setLoadError("");
      const otherAward: SponsorAward =
        nextAward === "entrepreneurial" ? "microsoft_foundry" : "entrepreneurial";

      try {
        const [activeRes, otherRes] = await Promise.all([
          fetch(`/api/sponsor/projects?award=${nextAward}`, { cache: "no-store" }),
          fetch(`/api/sponsor/projects?award=${otherAward}`, { cache: "no-store" }),
        ]);

        const activePayload = (await activeRes.json()) as Partial<ProjectsResponse> & {
          error?: string;
        };
        const otherPayload = (await otherRes.json()) as Partial<ProjectsResponse> & {
          error?: string;
        };

        if (!activeRes.ok) {
          setLoadError(activePayload.error ?? "Unable to load projects.");
          if (activeRes.status === 401 || activeRes.status === 403) {
            router.replace("/sponsor/login");
          }
          return;
        }

        const list = (Array.isArray(activePayload.projects) ? activePayload.projects : []).map(
          (project) => ({
            ...project,
            overallJudgeAvg:
              typeof project.overallJudgeAvg === "number" ? project.overallJudgeAvg : null,
            trackPlace:
              project.trackPlace === 1 || project.trackPlace === 2 ? project.trackPlace : null,
          }),
        );
        setProjects(list);
        setWinner(activePayload.winner ?? null);
        setCounts({
          [nextAward]: {
            scored: activePayload.scoredCount ?? 0,
            total: activePayload.totalCount ?? list.length,
          },
          [otherAward]: {
            scored: otherRes.ok ? (otherPayload.scoredCount ?? 0) : 0,
            total: otherRes.ok ? (otherPayload.totalCount ?? 0) : 0,
          },
        } as AwardCounts);

        if (typeof activePayload.session?.username === "string" && activePayload.session.username) {
          setSessionUser(activePayload.session.username);
        }

        const nextDrafts: Record<string, DraftState> = {};
        for (const project of list) {
          nextDrafts[project.id] = blankDraft(project);
        }
        setDrafts(nextDrafts);
        setActiveId(list[0]?.id ?? null);
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
      return { ...prev, [projectId]: { ...base, ...patch } };
    });
  }

  function applyLocalScore(projectId: string, score: number) {
    setProjects((prev) => {
      const updated = prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              sponsorScore: score,
              sponsorUpdatedAt: new Date().toISOString(),
            }
          : project,
      );

      const ranked = [...updated]
        .filter((project) => project.sponsorScore != null)
        .sort((a, b) => {
          if ((b.sponsorScore ?? 0) !== (a.sponsorScore ?? 0)) {
            return (b.sponsorScore ?? 0) - (a.sponsorScore ?? 0);
          }
          const aTime = a.sponsorUpdatedAt ? Date.parse(a.sponsorUpdatedAt) : 0;
          const bTime = b.sponsorUpdatedAt ? Date.parse(b.sponsorUpdatedAt) : 0;
          return bTime - aTime;
        });

      const ranks = new Map(ranked.map((project, index) => [project.id, index + 1]));
      const withRanks = updated.map((project) => ({
        ...project,
        sponsorRank: ranks.get(project.id) ?? null,
      }));

      const top = ranked[0];
      setWinner(
        top
          ? {
              submissionId: top.id,
              projectName: top.projectName,
              score: top.sponsorScore ?? score,
            }
          : null,
      );

      setCounts((prevCounts) => ({
        ...prevCounts,
        [awardRef.current]: {
          ...prevCounts[awardRef.current],
          scored: ranked.length,
        },
      }));

      return withRanks;
    });
  }

  async function saveScore(projectId: string, score: number) {
    const current = projects.find((project) => project.id === projectId);
    if (current?.sponsorScore === score) {
      updateDraft(projectId, { saving: false, saved: true, error: "" });
      return;
    }

    updateDraft(projectId, { saving: true, saved: false, error: "" });

    try {
      const response = await fetch(`/api/sponsor/scores/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          award: awardRef.current,
          score,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        updateDraft(projectId, {
          saving: false,
          saved: false,
          error: payload.error ?? "Unable to save score.",
        });
        return;
      }

      applyLocalScore(projectId, score);
      updateDraft(projectId, { saving: false, saved: true, error: "", score: String(score) });
    } catch {
      updateDraft(projectId, {
        saving: false,
        saved: false,
        error: "Network error while saving.",
      });
    }
  }

  function handleScoreChange(projectId: string, value: string) {
    updateDraft(projectId, { score: value, saved: false, error: "" });

    const existing = saveTimersRef.current[projectId];
    if (existing) clearTimeout(existing);

    if (!value.trim()) {
      updateDraft(projectId, { error: "" });
      return;
    }

    if (isScoreInvalid(value)) {
      updateDraft(projectId, { error: "Enter a whole number from 0 to 100." });
      return;
    }

    saveTimersRef.current[projectId] = setTimeout(() => {
      void saveScore(projectId, Number(value));
    }, 550);
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
        if (b.sponsorScore !== a.sponsorScore) {
          return b.sponsorScore - a.sponsorScore;
        }
        const aTime = a.sponsorUpdatedAt ? Date.parse(a.sponsorUpdatedAt) : 0;
        const bTime = b.sponsorUpdatedAt ? Date.parse(b.sponsorUpdatedAt) : 0;
        return bTime - aTime;
      });
    } else {
      list.sort((a, b) => {
        if (a.judgeAvg == null && b.judgeAvg == null) return a.roamRank - b.roamRank;
        if (a.judgeAvg == null) return 1;
        if (b.judgeAvg == null) return -1;
        if (b.judgeAvg !== a.judgeAvg) return b.judgeAvg - a.judgeAvg;
        return a.roamRank - b.roamRank;
      });
    }

    return list;
  }, [projects, searchQuery, sortMode]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FM }}>
      <style>{RESPONSIVE_CSS}</style>

      {/* Header */}
      <header
        className="sp-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: `1px solid ${C.border}`,
          background: C.card,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: C.red,
              color: C.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FB,
              fontSize: 22,
              letterSpacing: "0.02em",
            }}
          >
            S
          </div>
          <div style={{ fontFamily: FB, fontSize: 22, letterSpacing: "0.02em", lineHeight: 1 }}>
            HACK<span style={{ color: C.red }}>X</span>SPONSOR
          </div>
        </div>

        <button
          type="button"
          className="sp-hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          style={{
            width: 42,
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${C.borderStrong}`,
            borderRadius: 10,
            background: C.white,
            color: C.text,
            cursor: "pointer",
          }}
        >
          <Menu size={22} aria-hidden />
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
              boxShadow: CARD_SHADOW_ACTIVE,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: `1px solid ${C.border}`,
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
                  border: `1.5px solid ${C.red}`,
                  background: "transparent",
                  color: C.red,
                  cursor: "pointer",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div style={{ padding: "18px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Signed in as</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sessionUser}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: C.red }}>Sponsor</div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              <button
                type="button"
                onClick={() => setRevealTrackWinners((prev) => !prev)}
                aria-pressed={revealTrackWinners}
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  padding: "0 16px",
                  border: `1.5px solid ${revealTrackWinners ? C.red : C.borderStrong}`,
                  borderRadius: 0,
                  background: revealTrackWinners ? C.redSoft : C.white,
                  color: C.text,
                  fontFamily: FM,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {revealTrackWinners ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
                <span>{revealTrackWinners ? "Hide tracks winner" : "Reveal tracks winner"}</span>
              </button>

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
                  border: `1.5px solid ${C.red}`,
                  borderRadius: 0,
                  background: C.bg,
                  color: C.red,
                  fontFamily: FM,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>LOGOUT</span>
              </button>
            </div>
          </nav>
        </>
      )}

      <div className="sp-body" style={{ padding: "20px 24px 40vh", maxWidth: 980, margin: "0 auto" }}>
        {/* Two-pane award switcher */}
        <div role="tablist" aria-label="Awards" style={{ marginBottom: 0 }}>
          <div
            className="sp-award-tabs"
            style={{
              display: "flex",
              gap: 0,
              position: "relative",
              zIndex: 2,
            }}
          >
            {AWARDS.map((item, index) => {
              const active = award === item.key;
              const c = counts[item.key];
              const isFirst = index === 0;
              const isLast = index === AWARDS.length - 1;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`award-tab-${item.key}`}
                  aria-selected={active}
                  aria-controls={`award-pane-${item.key}`}
                  className="sp-award-tab"
                  onClick={() => {
                    if (item.key === award) return;
                    setAward(item.key);
                    setSortMode("roam");
                    setSearchQuery("");
                  }}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    minHeight: 78,
                    padding: "14px 18px",
                    borderRadius: isFirst
                      ? "14px 0 0 0"
                      : isLast
                        ? "0 14px 0 0"
                        : 0,
                    borderTop: active ? `2px solid ${C.red}` : `2px solid ${C.border}`,
                    borderLeft: active
                      ? `2px solid ${C.red}`
                      : isFirst
                        ? `2px solid ${C.border}`
                        : `1px solid ${C.border}`,
                    borderRight: active
                      ? `2px solid ${C.red}`
                      : isLast
                        ? `2px solid ${C.border}`
                        : "none",
                    borderBottom: active ? `2px solid ${C.card}` : `2px solid ${C.border}`,
                    marginBottom: active ? -2 : 0,
                    background: active ? C.card : "#ebe6dc",
                    color: C.text,
                    boxShadow: active ? "none" : "inset 0 -2px 0 rgba(29,28,23,0.06)",
                    cursor: "pointer",
                    fontFamily: FM,
                    position: "relative",
                  }}
                >
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: C.red,
                        borderRadius: isFirst
                          ? "12px 0 0 0"
                          : isLast
                            ? "0 12px 0 0"
                            : 0,
                      }}
                    />
                  )}
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: active ? C.red : C.text }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>
                    {c.scored} / {c.total} scored
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={award}
          id={`award-pane-${award}`}
          role="tabpanel"
          aria-labelledby={`award-tab-${award}`}
          className="sp-award-pane"
          style={{
            background: C.card,
            border: `2px solid ${C.red}`,
            borderRadius: "0 0 14px 14px",
            boxShadow: CARD_SHADOW_ACTIVE,
            padding: "18px 18px 20px",
            position: "relative",
            zIndex: 1,
          }}
        >
        {/* Filters */}
        <div
          className="sp-filters"
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div className="sp-search-wrap" style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
            <Search
              size={18}
              aria-hidden
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: C.text,
                pointerEvents: "none",
              }}
            />
            <input
              id="sp-search"
              className="sp-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search teams"
              style={{
                width: "100%",
                minHeight: 46,
                padding: "0 12px 0 40px",
                borderRadius: 10,
                border: `1.5px solid ${C.borderStrong}`,
                background: C.white,
                fontFamily: FM,
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            className="sp-sort-wrap"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: "0 0 auto",
              minWidth: 0,
            }}
          >
            <ArrowUpDown size={18} aria-hidden style={{ color: C.text, flexShrink: 0 }} />
            <select
              id="sp-sort"
              className="sp-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort by"
              style={{
                minWidth: 240,
                width: "max-content",
                maxWidth: "100%",
                minHeight: 46,
                padding: "0 36px 0 12px",
                borderRadius: 10,
                border: `1.5px solid ${C.borderStrong}`,
                background: C.white,
                fontFamily: FM,
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
              }}
            >
              <option value="roam">{judgeLabel(award)} score</option>
              <option value="mine">My score</option>
            </select>
          </div>
        </div>

        {loadError && (
          <div
            style={{
              marginBottom: 14,
              padding: "14px 16px",
              borderRadius: 12,
              border: `2px solid ${C.red}`,
              background: C.redSoft,
              fontSize: 15,
              fontWeight: 700,
              color: C.red,
            }}
          >
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 16, fontWeight: 700, padding: "24px 0" }}>Loading teams…</div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ fontSize: 16, fontWeight: 700, padding: "24px 0" }}>
            No approved teams for this award.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredProjects.map((project, index) => {
              const draft = drafts[project.id] ?? blankDraft(project);
              const isWinner = winner?.submissionId === project.id;
              const isActive = project.id === activeId;
              const displayRank = sortMode === "mine" && project.sponsorRank != null
                ? project.sponsorRank
                : index + 1;

              return (
                <div
                  key={project.id}
                  className="sp-team-card"
                  onClick={() => setActiveId(project.id)}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    background: C.card,
                    border: isActive || isWinner
                      ? `2px solid ${C.red}`
                      : `1.5px solid ${C.border}`,
                    borderRadius: 14,
                    boxShadow: isActive || isWinner ? CARD_SHADOW_ACTIVE : CARD_SHADOW,
                    padding: "14px 16px",
                    cursor: "pointer",
                  }}
                >
                  <RankBadge rank={displayRank} />
                  <TeamThumbnail url={project.thumbnailUrl} alt={`${project.projectName} thumbnail`} />

                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FB,
                          fontSize: 26,
                          letterSpacing: "0.02em",
                          lineHeight: 1,
                        }}
                      >
                        {project.projectName}
                      </span>
                      {isWinner && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 24,
                            padding: "0 10px",
                            borderRadius: 999,
                            background: C.text,
                            color: C.white,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          #1 BY YOU
                        </span>
                      )}
                      {revealTrackWinners && project.trackPlace != null && (
                        <TrackPlaceBadge place={project.trackPlace} track={project.track} />
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: 26,
                          padding: "0 10px",
                          borderRadius: 8,
                          background: C.cardAlt,
                          border: `1.5px solid ${C.borderStrong}`,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {project.projectName} ({project.teamId})
                      </span>
                      <TrackPill track={project.track} />
                      {project.usesMicrosoftFoundry && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 26,
                            padding: "0 10px",
                            borderRadius: 999,
                            background: C.azure,
                            color: C.white,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                          }}
                        >
                          Uses Microsoft stack
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                      <div>
                        Overall {judgeLabel(award)} score:{" "}
                        <strong style={{ fontSize: 15 }}>
                          {project.judgeAvg != null ? project.judgeAvg : "—"}/100
                        </strong>
                      </div>
                      <div>
                        Your {judgeLabel(award).toLowerCase()} score:{" "}
                        <strong style={{ fontSize: 15 }}>
                          {project.sponsorScore != null ? project.sponsorScore : "—"}/100
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div
                    className="sp-team-actions"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="sp-score-input"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.score}
                      onChange={(e) => handleScoreChange(project.id, e.target.value)}
                      placeholder="0–100"
                      aria-label={`Score for ${project.projectName}`}
                      style={{
                        width: 96,
                        minHeight: 46,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: `2px solid ${C.red}`,
                        background: C.white,
                        fontFamily: FM,
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.text,
                        textAlign: "center",
                      }}
                    />
                    <div
                      className="sp-score-status"
                      style={{ fontSize: 11, fontWeight: 700, minHeight: 14, color: draft.error ? C.red : C.text }}
                    >
                      {draft.error
                        ? draft.error
                        : draft.saving
                          ? "Saving…"
                          : draft.saved
                            ? "Saved"
                            : "Auto-saves"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <div className="fixed bottom-5 right-5 md:bottom-8 md:right-8 z-50">
        <ScrollToTopButton />
      </div>
    </div>
  );
}
