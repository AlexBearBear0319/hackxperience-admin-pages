/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { motion } from "framer-motion";
import { C, FM, FB, SPRING } from "../constants";
import { CRITERIA, isFieldInvalid, calcLiveTotal, type CriterionKey, type ScoringCriterion } from "../scoring";
import type { ScoreEntry } from "../types";

// Subtitles for each criterion matching the design
const CRITERION_SUBTITLES: Record<string, string> = {
  techExec:        "Code quality, system design, functionality, reliability, and robustness.",
  problemSolution: "How well the solution addresses the problem and meets user needs.",
  innovation:      "Originality of idea, creative approach, and differentiation.",
  presentation:    "Clarity, structure, delivery, and visual appeal of the presentation.",
  entrepreneurship: "Market demand, target user adoption, long-term sustainability, and future vision."
};

function CriterionIcon({ color, criteriaKey }: { color: string; criteriaKey: string }) {
  return (
    <div style={{
      width: 36, height: 36, background: color, borderRadius: 0,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      color: C.white,
    }}>
      {criteriaKey === "techExec" && (
        <span style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 13, fontWeight: 700 }}>&lt;/&gt;</span>
      )}
      {criteriaKey === "problemSolution" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h6v3a2 2 0 1 1 0 4v3H4V6z" />
          <path d="M14 6h6v10h-6v-3a2 2 0 1 0 0-4v-3z" />
        </svg>
      )}
      {criteriaKey === "innovation" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Bulb body */}
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          {/* Bulb */}
          <path d="M15.5 15c.5-1.5 1.5-2.5 1.5-4a5 5 0 0 0-10 0c0 1.5 1 2.5 1.5 4h7z" />
          {/* Bright effect */}
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="4.5" y1="4.5" x2="6" y2="6" />
          <line x1="19.5" y1="4.5" x2="18" y2="6" />
          <line x1="2" y1="11" x2="4" y2="11" />
          <line x1="22" y1="11" x2="20" y2="11" />
        </svg>
      )}
      {criteriaKey === "presentation" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Screen Frame */}
          <rect x="3" y="3" width="18" height="12" rx="1" />
          {/* Slide Content: Mini image box on the left, bullet text lines on the right */}
          <rect x="5.5" y="5.5" width="4.5" height="4.5" rx="0.5" />
          <line x1="12" y1="6.5" x2="18.5" y2="6.5" />
          <line x1="12" y1="9.5" x2="16.5" y2="9.5" />
          {/* Tripod Legs */}
          <path d="M12 15v3" />
          <path d="M8 21l4-3 4 3" />
        </svg>
      )}
      {criteriaKey === "entrepreneurship" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Plant pot */}
          <path d="M6 14h12l-1.2 6.5H7.2L6 14z" />
          <path d="M5 10.5h14v3.5H5v-3.5z" />
          {/* Central stem */}
          <path d="M12 10.5V5" />
          {/* Left and right leaves (scaled up slightly) */}
          <path d="M12 7.5C9.5 7.5 7 5.5 7 2.5c3 0 5 2 5 5z" />
          <path d="M12 7.5c2.5 0 5-2 5-5-3 0-5 2-5 5z" />
        </svg>
      )}
    </div>
  );
}

const ICON_COLORS = [C.primary, C.primary, C.primary, C.primary];

export function ScoringPanel({ score, onChange, onSave, criteria, projectId: _projectId }: {
  score: ScoreEntry;
  onChange: (field: string, value: string) => void;
  onSave: () => void;
  criteria?: readonly ScoringCriterion[];
  projectId?: string;
}) {
  const activeCriteria = criteria ?? CRITERIA;
  const anyInvalid = activeCriteria.some(c => isFieldInvalid(score[c.key as CriterionKey], c.max));
  const liveTotal  = calcLiveTotal(score, activeCriteria);
  const maxTotal   = activeCriteria.reduce((s, c) => s + c.max, 0);

  function step(key: string, max: number, delta: number) {
    const current = parseInt(score[key as CriterionKey]) || 0;
    const next    = Math.min(max, Math.max(0, current + delta));
    onChange(key, String(next));
  }

  return (
    <div
      className="r-scoring-panel"
      style={{
        background: "transparent",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        .portal-ta::placeholder { color: ${C.textMuted}; font-family: var(--font-ibm-plex-mono), monospace; font-size: 12px; opacity: 1; }
        .portal-ta:focus { border-color: ${C.primary} !important; outline: none; }
        .r-stepper-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .r-stepper-btn:hover { background: ${C.primary} !important; color: ${C.white} !important; border-color: ${C.primary} !important; }
        .r-stepper-btn:active { transform: scale(0.92); }
        .r-score-input::-webkit-inner-spin-button,
        .r-score-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .r-score-input { -moz-appearance: textfield; }
        .r-score-input:focus { border-color: ${C.primary} !important; outline: none; }
      `}</style>

      {/* Scoring rows */}
      <div style={{ flex: 1, padding: "0 16px" }}>
        {activeCriteria.map((c, i) => {
          const val      = parseInt(score[c.key as CriterionKey]) || 0;
          const invalid  = isFieldInvalid(score[c.key as CriterionKey], c.max);
          const subtitle = CRITERION_SUBTITLES[c.key] ?? "";

          return (
            <div
              key={c.key}
              className="r-score-row"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 0",
                borderBottom: i < activeCriteria.length - 1 ? `1px solid ${C.borderLight}` : "none",
              }}
            >
              <CriterionIcon color={ICON_COLORS[i] ?? C.primary} criteriaKey={c.key} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="r-stepper-label"
                  style={{ fontFamily: FM, fontSize: 12, color: C.textPrimary, letterSpacing: "0.02em", fontWeight: 700 }}
                >
                  {c.label}
                </div>
                <div className="r-score-desc" style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                  {subtitle}
                </div>
                {invalid && (
                  <div style={{ fontFamily: FM, fontSize: 10, color: C.primary, marginTop: 2, lineHeight: 1.4 }}>
                    Please input the current criteria within {c.max}
                  </div>
                )}
              </div>

              {/* Stepper */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="r-stepper-btn"
                  onClick={() => step(c.key, c.max, -1)}
                  style={{
                    width: 26, height: 26,
                    background: "transparent",
                    border: `1px solid ${C.borderMedium}`,
                    color: C.textMuted,
                    fontFamily: FM, fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, lineHeight: 1,
                  }}
                  aria-label={`Decrease ${c.label}`}
                >
                  −
                </button>
                <input
                  type="number"
                  className="r-score-input"
                  value={score[c.key as CriterionKey]}
                  min={0}
                  max={c.max}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    onChange(c.key, e.target.value);
                  }}
                  style={{
                    width: 38, height: 26,
                    fontFamily: FM, fontSize: 15, fontWeight: 700,
                    color: invalid ? C.primary : C.textPrimary,
                    background: "transparent",
                    border: `1px solid ${invalid ? C.primary : C.borderMedium}`,
                    textAlign: "center",
                    padding: 0,
                    transition: "border-color 0.15s",
                  }}
                  aria-label={`${c.label} score`}
                />
                <button
                  type="button"
                  className="r-stepper-btn"
                  onClick={() => step(c.key, c.max, +1)}
                  style={{
                    width: 26, height: 26,
                    background: "transparent",
                    border: `1px solid ${C.borderMedium}`,
                    color: C.textMuted,
                    fontFamily: FM, fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, lineHeight: 1,
                  }}
                  aria-label={`Increase ${c.label}`}
                >
                  +
                </button>
                <span style={{ fontFamily: FM, fontSize: 11, color: C.textMuted, minWidth: 28 }}>/ {c.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Private comments */}
      <div style={{ padding: "14px 16px 0", borderTop: `1px solid ${C.borderLight}` }}>
        <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" as const }}>
          Private Comments (Optional)
        </div>
        <textarea
          className="portal-ta"
          value={score.comment}
          onChange={e => onChange("comment", e.target.value)}
          placeholder="Share your feedback with the team (optional)..."
          maxLength={1000}
          style={{
            width: "100%", height: 72,
            background: "transparent",
            border: `1px solid ${C.borderMedium}`,
            color: C.textPrimary, fontFamily: FM, fontSize: 12,
            padding: "10px 12px", resize: "none", outline: "none",
            boxSizing: "border-box", lineHeight: 1.5,
            transition: "border-color 0.15s",
          }}
        />
        <div style={{ fontFamily: FM, fontSize: 10, color: C.textMuted, textAlign: "right", marginTop: 4 }}>
          {score.comment.length} / 1000
        </div>
      </div>

      {/* Footer: save indicator + TOTAL + SAVE SCORE button */}
      <div style={{
        padding: "12px 16px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
        borderTop: `1px solid ${C.borderLight}`,
      }}>
        {/* Left: save / live total */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {score.saved ? (
            <>
              <div style={{
                width: 18, height: 18, background: C.textSuccess, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke={C.white} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: FM, fontSize: 10, color: C.textPrimary, fontWeight: 700 }}>Saved</div>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: FM, fontSize: 11, color: C.textMuted }}>
              TOTAL{" "}
              <span style={{ fontFamily: FB, fontSize: 20, color: C.textPrimary, verticalAlign: "middle" }}>
                {liveTotal}
              </span>
              <span style={{ color: C.textMuted }}> / {maxTotal}</span>
            </div>
          )}
        </div>

        {/* Right: SAVE SCORE */}
        <motion.button
          onClick={onSave}
          disabled={anyInvalid}
          whileHover={anyInvalid ? {} : { scale: 1.03 }}
          whileTap={anyInvalid ? {} : { scale: 0.96 }}
          transition={SPRING}
          style={{
            height: 38, padding: "0 20px",
            background: anyInvalid ? C.borderLight : C.primary,
            border: "none",
            fontFamily: FB, fontSize: 18,
            color: anyInvalid ? C.textMuted : C.white,
            cursor: anyInvalid ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            display: "flex", alignItems: "center", gap: 8,
            transition: "background 0.15s",
            boxShadow: anyInvalid ? "none" : `3px 3px 0 0 ${C.textPrimary}`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          SAVE SCORE
        </motion.button>
      </div>
    </div>
  );
}
