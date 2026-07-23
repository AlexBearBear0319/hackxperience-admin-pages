/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Montserrat, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import Navbar from "../components/navbar";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSettings } from "@/lib/hooks/use-settings";
import { HACKX_SUBMISSION_TRACKS } from "@/lib/hackathon-content";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const RED = "#c00000";
const CREAM_BG = "#f2ede5";
const DARK_BG = "#1d1c17";
const OFF_WHITE = "#fef9f1";
const MUTED = "#7a7669";
const LINE = "#d8d2c5";
const GREEN = "#16a34a";

const FS = "var(--font-montserrat), system-ui, sans-serif";
const FM = "var(--font-ibm-plex-mono), ui-monospace, monospace";
const SHADOW = "6px 6px 0 0 #1d1c17";
const SHADOW_SM = "4px 4px 0 0 #1d1c17";

function fmtDeadline(d: Date) {
  return d.toLocaleString("en-SG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore", timeZoneName: "short" });
}

const STEP_NAMES = ["IDENTITY", "ASSETS", "MANIFEST", "REVIEW"];

interface Member {
  id: string;
  name: string;
  university: string;
  role: string;
  email: string;
}

interface FormState {
  projectName: string;
  teamId: string;             // pre-assigned team slot, e.g. "TEAM_07" → team_id (TEXT, the only team column)
  track: string;
  description: string;
  pitch: string;
  techStack: string[];
  otherTechStack: string;
  usesMicrosoftFoundry: boolean;
  githubRepoUrl: string;
  liveDemoUrl: string;
  pitchDeckShareUrl: string;
  pitchDeckFile: File | null;
  pitchDeckUploadUrl: string | null; // URL from Storage (populated from DB)
  demoVideoUrl: string;
  thumbnailFile: File | null;
  thumbnailUrl: string | null;     // URL from Storage (populated from DB)
  members: Member[];
}

interface Tick { d: number; h: number; m: number; s: number }

interface LastSaved { step: number; stepName: string; time: Date }

type SerializableForm = Omit<FormState, 'pitchDeckFile' | 'thumbnailFile'>;

interface StoredDraft {
  form: SerializableForm;
  step: number;
  maxReached: number;
  lastUpdated: string;
}

interface StoredSubmission {
  editToken: string;
  submittedAt: string;
  form: SerializableForm;
}

function serializeForm(form: FormState): SerializableForm {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pitchDeckFile: _pdf, thumbnailFile: _tf, ...rest } = form;
  return rest;
}

function deserializeForm(stored: SerializableForm): FormState {
  // Migrate drafts/DB responses that still use the old field names from before the rename
  const s = stored as SerializableForm & Record<string, unknown>;
  return {
    ...stored,
    githubRepoUrl:      (s.githubRepoUrl      ?? s.githubUrl      ?? "") as string,
    liveDemoUrl:        (s.liveDemoUrl         ?? s.liveUrl        ?? "") as string,
    pitchDeckShareUrl:  (s.pitchDeckShareUrl   ?? s.pitchDeckUrl   ?? "") as string,
    pitchDeckUploadUrl: (s.pitchDeckUploadUrl  ?? s.pitchDeckFileUrl ?? null) as string | null,
    demoVideoUrl:       (s.demoVideoUrl        ?? "") as string,
    otherTechStack:     (s.otherTechStack      ?? "") as string,
    teamId:             (s.teamId != null ? String(s.teamId) : "") as string,
    usesMicrosoftFoundry: Boolean(s.usesMicrosoftFoundry ?? false),
    members: ((stored.members ?? []) as Member[]).map((m) => ({
      id:         m.id         ?? Date.now().toString(),
      name:       m.name       ?? "",
      university: m.university ?? "",
      role:       m.role       ?? "",
      email:      m.email      ?? "",
    })),
    pitchDeckFile: null,
    thumbnailFile: null,
  };
}

function hasAnyDraftInput(form: FormState) {
  if (
    form.projectName.trim() ||
    form.teamId.trim() ||
    form.track.trim() ||
    form.description.trim() ||
    form.pitch.trim() ||
    form.githubRepoUrl.trim() ||
    form.liveDemoUrl.trim() ||
    form.pitchDeckShareUrl.trim() ||
    form.demoVideoUrl.trim()
  ) {
    return true;
  }

  if (form.techStack.length > 0) return true;
  if (form.otherTechStack.trim()) return true;
  if (form.pitchDeckFile || form.thumbnailFile) return true;

  return form.members.some(
    (member) =>
      member.name?.trim() ||
      member.university?.trim() ||
      member.role?.trim() ||
      member.email?.trim(),
  );
}

const DRAFT_PLACEHOLDER_TEXT = "[DRAFT]";
const DRAFT_PLACEHOLDER_URL = "https://example.com/draft";

function buildDraftPayload({
  form,
  fallbackTeamId,
  fallbackTrack,
}: {
  form: FormState;
  fallbackTeamId: string;
  fallbackTrack: string;
}) {
  const serialized = serializeForm(form);

  return {
    ...serialized,
    projectName: serialized.projectName.trim() || DRAFT_PLACEHOLDER_TEXT,
    teamId: serialized.teamId.trim() || fallbackTeamId,
    track: serialized.track.trim() || fallbackTrack,
    description: serialized.description.trim() || DRAFT_PLACEHOLDER_TEXT,
    pitch: serialized.pitch.trim() || DRAFT_PLACEHOLDER_TEXT,
    githubRepoUrl: serialized.githubRepoUrl.trim() || DRAFT_PLACEHOLDER_URL,
    pitchDeckShareUrl: serialized.pitchDeckShareUrl.trim() || DRAFT_PLACEHOLDER_URL,
    isDraft: true,
  };
}

function isValidUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try { new URL(url); return true; } catch { return false; }
}

// Strict-enough email format check: single @, non-empty local part, dotted domain.
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateStep(step: number, form: FormState, maxTeamSize: number): boolean {
  switch (step) {
    case 0: {
      const descWords = form.description.trim() ? form.description.trim().split(/\s+/).length : 0;
      const pitchWords = form.pitch.trim() ? form.pitch.trim().split(/\s+/).length : 0;
      const otherTechValid = !form.techStack.includes("OTHER") || !!form.otherTechStack.trim();
      return !!(
        form.projectName.trim() &&
        form.teamId.trim() &&
        form.track &&
        form.description.trim() && 
        descWords <= 6 &&
        form.pitch.trim() &&
        pitchWords <= 150 &&
        form.techStack.length > 0 &&
        otherTechValid &&
        (form.thumbnailFile || form.thumbnailUrl)
      );
    }
    case 1: return isValidUrl(form.githubRepoUrl) &&
                   isValidUrl(form.pitchDeckShareUrl) &&
                   // Live Demo URL is optional — valid when blank, or a real URL when provided.
                   (!form.liveDemoUrl.trim() || isValidUrl(form.liveDemoUrl)) &&
                   isValidUrl(form.demoVideoUrl);
    case 2: return form.members.length > 0 && form.members.length <= maxTeamSize && form.members.every(m => m.name?.trim() && m.university?.trim() && m.role?.trim() && isValidEmail(m.email ?? ""));
    default: return true;
  }
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function safeDecodeUrlSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getAssetFileName(file?: File | null, url?: string | null): string {
  if (file?.name) return file.name;
  if (!url) return "Uploaded file";

  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    return segment ? safeDecodeUrlSegment(segment) : "Uploaded file";
  } catch {
    const segment = url.split("/").filter(Boolean).pop();
    return segment ? safeDecodeUrlSegment(segment) : "Uploaded file";
  }
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "Size unavailable";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

function ThumbnailPreview({ file, url: urlProp }: { file?: File | null; url?: string | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setObjectUrl(null); return; }
    const u = URL.createObjectURL(file);
    setObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const src = objectUrl ?? urlProp ?? null;
  if (!src) return null;
  return (
    <img
      src={src}
      alt="Thumbnail preview"
      style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "contain", display: "block" }}
    />
  );
}

// ─── Atoms ────────────────────────────────────────────────────

function Mono({ children, color = DARK_BG, size = 11, weight = 600, style }: {
  children: React.ReactNode; color?: string; size?: number; weight?: number; style?: React.CSSProperties;
}) {
  return (
    <span style={{ fontFamily: FM, fontSize: size, fontWeight: weight, letterSpacing: "0.06em", color, textTransform: "uppercase", ...style }}>
      {children}
    </span>
  );
}

function FieldLabel({ children, hint, required }: { children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: FM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: DARK_BG, whiteSpace: "nowrap" }}>
        {children}
        {required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
      </span>
      {hint && (
        <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          // {hint}
        </span>
      )}
    </div>
  );
}

function SInput({ value, onChange, onBlur, placeholder, suffix, h = 44, hasError }: {
  value: string; onChange?: (v: string) => void; onBlur?: () => void; placeholder?: string; suffix?: string; h?: number; hasError?: boolean;
}) {
  return (
    <div style={{ position: "relative", boxShadow: SHADOW_SM }}>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          width: "100%", height: h, background: "#fff", border: `1.5px solid ${hasError ? RED : DARK_BG}`,
          padding: `0 ${suffix ? 60 : 14}px 0 14px`, fontFamily: FM, fontSize: 13,
          color: DARK_BG, outline: "none", boxSizing: "border-box",
        }}
      />
      {suffix && (
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontFamily: FM, fontSize: 10, color: hasError ? RED : MUTED, pointerEvents: "none" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function STextarea({ value, onChange, placeholder, suffix, h = 90, hasError }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; suffix?: string; h?: number; hasError?: boolean;
}) {
  return (
    <div style={{ position: "relative", boxShadow: SHADOW_SM }}>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", height: h, background: "#fff", border: `1.5px solid ${hasError ? RED : DARK_BG}`,
          padding: "12px 14px", fontFamily: FM, fontSize: 13, color: DARK_BG, outline: "none",
          resize: "none", lineHeight: 1.5, boxSizing: "border-box", paddingBottom: suffix ? 28 : 12,
        }}
      />
      {suffix && (
        <span style={{ position: "absolute", right: 10, bottom: 10, fontFamily: FM, fontSize: 10, color: hasError ? RED : MUTED, pointerEvents: "none" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Badge({ n, size = 28 }: { n: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, background: RED, color: "#fff", fontFamily: FM, fontWeight: 800, fontSize: size > 26 ? 13 : 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", letterSpacing: "0.04em" }}>
      {n}
    </div>
  );
}

function RedBtn({ children, onClick, ghost, full, disabled }: {
  children: React.ReactNode; onClick?: () => void; ghost?: boolean; full?: boolean; disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 46, padding: "0 22px",
        background: ghost ? "transparent" : disabled ? "#9a9a9a" : RED,
        color: ghost ? DARK_BG : "#fff",
        border: `1.5px solid ${DARK_BG}`,
        fontFamily: FM, fontWeight: 700, fontSize: 12, letterSpacing: "0.14em",
        textTransform: "uppercase", whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : SHADOW,
        width: full ? "100%" : "auto",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}

function STag({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px",
        border: `1.5px solid ${DARK_BG}`,
        background: active ? RED : "#fff", color: active ? "#fff" : DARK_BG,
        fontFamily: FM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", whiteSpace: "nowrap",
        boxShadow: active ? SHADOW_SM : "none", cursor: "pointer", userSelect: "none",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, padding = 22, style, dark, className }: {
  children: React.ReactNode; padding?: number; style?: React.CSSProperties; dark?: boolean; className?: string;
}) {
  return (
    <div className={className} style={{ background: dark ? DARK_BG : "#fff", border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW, padding, position: "relative", ...style }}>
      <div style={{ position: "absolute", top: -1.5, left: -1.5, right: -1.5, height: 4, background: RED }} />
      {children}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────

function ConfirmModal({ form, onCancel, onConfirm, isEditing }: {
  form: FormState; onCancel: () => void; onConfirm: () => void; isEditing: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW,
          padding: 28, maxWidth: 480, width: "100%", position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: -1.5, left: -1.5, right: -1.5, height: 4, background: RED }} />
        <Mono color={RED} size={11} weight={800} style={{ letterSpacing: "0.14em", display: "block", marginBottom: 16 }}>
          // Confirm Submission
        </Mono>
        <div style={{ fontFamily: FS, fontSize: 20, fontWeight: 800, color: DARK_BG, marginBottom: 4 }}>
          {form.projectName || "Your Project"}
        </div>
        <div style={{ fontFamily: FM, fontSize: 12, color: MUTED, marginBottom: 20 }}>
          {form.teamId} · {form.track}
        </div>
        <div style={{ background: "rgba(192,0,0,0.05)", border: `1px dashed ${RED}`, padding: "12px 14px", marginBottom: 24 }}>
          <div style={{ fontFamily: FM, fontSize: 11.5, color: DARK_BG, lineHeight: 1.65 }}>
            {isEditing
              ? <>Your updated submission will <span style={{ fontWeight: 800, color: RED }}>replace</span> your previous one. You may resubmit again any time before the deadline.</>
              : <>Your submission will be marked <span style={{ fontWeight: 800, color: RED }}>PENDING</span> until reviewed by the organiser. You may resubmit any time before the deadline.</>
            }
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <RedBtn ghost onClick={onCancel}>Cancel</RedBtn>
          <RedBtn onClick={onConfirm}>Confirm &amp; Submit</RedBtn>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page Hero ────────────────────────────────────────────────

function PageHero({ tick, deadline }: { tick: Tick; deadline: Date | null }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="submit-page-hero" style={{ padding: "36px 48px 28px", display: "flex", alignItems: "flex-end", gap: 32, justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px", background: RED, color: "#fff", fontFamily: FM, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
          // MODULE_01 · PROJECT_REGISTRY
        </span>
        <div style={{ height: 14 }} />
        <div style={{ fontFamily: FS, fontWeight: 800, fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 0.96, letterSpacing: "-0.02em", textTransform: "uppercase", color: DARK_BG }}>
          SUBMIT YOUR<br />
          <span style={{ color: RED }}>PROJECT</span>
        </div>
        <div style={{ height: 14 }} />
        <Mono color={MUTED} size={11} style={{ whiteSpace: "normal" }}>// 24-HOUR HACKXPERIENCE 2026 · ONE RECORD PER TEAM · RESUBMIT UNTIL DEADLINE</Mono>
      </div>
      {deadline && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px", background: DARK_BG, color: "#fff", fontFamily: FM, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
            // DEADLINE_IN
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {([["DAYS", tick.d], ["HOURS", tick.h], ["MINS", tick.m], ["SECS", tick.s]] as [string, number][]).map(([u, n]) => (
              <div key={u} style={{ minWidth: 76, padding: "10px 0", background: "#fff", border: `1.5px solid ${DARK_BG}`, textAlign: "center", boxShadow: SHADOW_SM }}>
                <div style={{ fontFamily: FM, fontSize: 30, fontWeight: 700, color: RED, lineHeight: 1 }}>{pad(n)}</div>
                <div style={{ height: 4 }} />
                <Mono color={MUTED} size={9}>{u}</Mono>
              </div>
            ))}
          </div>
          {deadline && <Mono color={MUTED} size={10}>// Deadline: {fmtDeadline(deadline)}</Mono>}
        </div>
      )}
    </div>
  );
}

// ─── Step Rail ────────────────────────────────────────────────

function getStepRows(maxTeamSize: number): [string, string, string][] {
  return [
    ["01", "IDENTITY", "Name, track, pitch"],
    ["02", "ASSETS", "Repo, deck, files"],
    ["03", "MANIFEST", `1-${maxTeamSize} members`],
    ["04", "REVIEW", "Confirm + submit"],
  ];
}

function StepRail({ active, onStepClick, maxReached, maxTeamSize, lastSaved }: {
  active: number;
  onStepClick: (i: number) => void;
  maxReached: number;
  maxTeamSize: number;
  lastSaved: LastSaved | null;
}) {
  return (
    <div className="submit-step-rail" style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      {getStepRows(maxTeamSize).map(([n, label, sub], i) => {
        const isA = i === active;
        const isD = i !== active && i <= maxReached;
        const isClickable = i <= maxReached;
        return (
          <motion.div
            key={i}
            className="submit-step-rail-item"
            animate={{
              background: isA ? DARK_BG : "#fff",
              x: isA ? -4 : 0,
              boxShadow: isA ? SHADOW_SM : "none",
            }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => isClickable && onStepClick(i)}
            style={{
              display: "flex", gap: 12, padding: "16px 18px",
              border: `1.5px solid ${DARK_BG}`,
              borderBottom: i < 3 ? "none" : `1.5px solid ${DARK_BG}`,
              cursor: isClickable ? "pointer" : "default",
            }}
          >
            <div style={{ flex: "0 0 auto" }}>
              <div style={{
                width: 32, height: 32,
                background: isD || isA ? RED : "transparent",
                border: isD || isA ? "none" : `1.5px solid ${isA ? "#fff" : DARK_BG}`,
                color: "#fff", fontFamily: FM, fontWeight: 800, fontSize: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isD ? "✓" : n}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Mono color={isA ? "#fff" : DARK_BG} size={11} weight={800}>[{n}]</Mono>
                <Mono color={isA ? "#fff" : DARK_BG} size={11} weight={700}>{label}</Mono>
              </div>
              <div style={{ height: 4 }} />
              <span style={{ fontFamily: FM, fontSize: 10, color: isA ? "rgba(255,255,255,0.55)" : MUTED }}>{sub}</span>
            </div>
          </motion.div>
        );
      })}
      <div className="submit-step-rail-saved" style={{ padding: "10px 18px", border: `1.5px solid ${DARK_BG}`, borderTop: "none", background: "#fff" }}>
        {lastSaved ? (
          <div style={{ fontFamily: FM, fontSize: 10, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1.5 }}>
            // Saved · [{STEP_NAMES[lastSaved.step]}]<br />
            {timeAgo(lastSaved.time)}
          </div>
        ) : (
          <div style={{ fontFamily: FM, fontSize: 10, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            // Unsaved
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Info Sidebar ─────────────────────────────────────────────

function InfoSidebar({ step }: { step: number }) {
  const pcts = [25, 50, 75, 95];
  const pct = pcts[step] ?? 25;
  return (
    <div className="submit-info-sidebar" style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 18 }}>
      <Card padding={18}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Mono size={11} weight={800}>&gt; PROGRESS</Mono>
          <Mono color={RED} size={12} weight={800}>{pct}%</Mono>
        </div>
        <div style={{ height: 8, background: "#e9e3d6", border: `1.5px solid ${DARK_BG}`, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: RED, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ height: 14 }} />
        {[
          ["done", "Team registered"],
          [step >= 1 ? "done" : "now", "Project Identity"],
          [step >= 2 ? "done" : step === 1 ? "now" : "todo", "Assets uploaded"],
          [step >= 3 ? "done" : step === 2 ? "now" : "todo", "Team manifest"],
          ["todo", "Submitted"],
        ].map(([s, l], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
            <div style={{
              width: 16, height: 16, border: `1.5px solid ${DARK_BG}`,
              background: s === "done" ? RED : s === "now" ? DARK_BG : "#fff",
              color: "#fff", fontFamily: FM, fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
            }}>
              {s === "done" ? "✓" : s === "now" ? "·" : ""}
            </div>
            <Mono color={s === "todo" ? MUTED : DARK_BG} size={10} weight={s === "todo" ? 500 : 700}>{l}</Mono>
          </div>
        ))}
      </Card>

      <Card padding={16} dark>
        <Mono color={RED} size={11} weight={800}>// DEADLINE_ALERT</Mono>
        <div style={{ height: 8 }} />
        <div style={{ fontFamily: FM, fontSize: 11, color: "#fff", lineHeight: 1.55 }}>
          Late submissions <span style={{ color: RED, fontWeight: 800 }}>NOT</span> accepted.<br />
          Repo must be public · Demo link live.
        </div>
      </Card>
    </div>
  );
}

// ─── Step sub-components ──────────────────────────────────────

function StepHeader({ n, title, status }: { n: string; title: string; status: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <Badge n={n} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Mono color={RED} size={12} weight={800} style={{ letterSpacing: "0.14em" }}>&gt; {title}</Mono>
        <div style={{ height: 4 }} />
        <Mono color={MUTED} size={10} style={{ whiteSpace: "normal" }}>// {status}</Mono>
      </div>
      <Mono color={MUTED} size={11}>STEP {n} / 04</Mono>
    </div>
  );
}

function FormFooter({ onNext, onBack, nextLabel, showBack = true, disabled }: {
  onNext?: () => void; onBack?: () => void; nextLabel: string; showBack?: boolean; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1.5px dashed ${LINE}`, marginTop: 22, paddingTop: 18 }}>
      <div />
      <div style={{ display: "flex", gap: 12 }}>
        {showBack && <RedBtn ghost onClick={onBack}>&lt; Back</RedBtn>}
        <RedBtn onClick={onNext} disabled={disabled}>{nextLabel}</RedBtn>
      </div>
    </div>
  );
}

// ─── Duplicate-check helpers ──────────────────────────────────

type CheckStatus = "idle" | "checking" | "taken" | "available";
type UploadStatus = "idle" | "loading" | "done";

function CheckMsg({ status, takenMsg }: { status: CheckStatus | undefined; takenMsg: string }) {
  if (!status || status === "idle") return null;
  if (status === "checking") return (
    <Mono color={MUTED} size={11} style={{ marginTop: 5 }}>// CHECKING…</Mono>
  );
  if (status === "taken") return (
    <Mono color={RED} size={11} weight={800} style={{ marginTop: 5 }}>&gt;&gt; [ERR: {takenMsg}]</Mono>
  );
  return (
    <Mono color="#3a9e6a" size={11} weight={700} style={{ marginTop: 5 }}>&gt; [OK: AVAILABLE]</Mono>
  );
}

// ─── Step 01: Identity ────────────────────────────────────────

const TECH_TAGS = ["REACT", "NEXT.JS", "TAILWIND", "NODE.JS", "PYTHON", "OPENAI API", "SUPABASE", "FIREBASE", "VERCEL", "GITHUB", "OTHER"];
const TRACKS = [...HACKX_SUBMISSION_TRACKS];
// Pre-assigned team slots — the submissions table has a single team_id TEXT column,
// so this dropdown writes "TEAM_01".."TEAM_29" directly (no separate name column).
const TEAM_IDS = Array.from({ length: 29 }, (_, i) => `TEAM_${String(i + 1).padStart(2, "0")}`);
const UNIVERSITIES = ['NUS', 'NTU', 'SMU', 'SUTD', 'SIT', 'SUSS', 'SIM', 'Kaplan', 'PSB Academy', 'MDIS', 'James Cook University', 'Curtin Singapore', 'Other'];

function Step01({
  form,
  setForm,
  onNext,
  maxTeamSize,
  tracks,
  maxFileSizeMb,
  thumbnailError,
  setThumbnailError,
  fieldChecks,
  checkField,
  clearCheck,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onNext: () => void;
  maxTeamSize: number;
  tracks: string[];
  maxFileSizeMb: number;
  thumbnailError: string | null;
  setThumbnailError: (message: string | null) => void;
  fieldChecks: Record<string, CheckStatus>;
  checkField: (key: string, dbField: string, value: string) => Promise<void>;
  clearCheck: (key: string) => void;
}) {
  const set = (k: keyof FormState) => (v: string) => setForm({ ...form, [k]: v });
  const toggleTag = (tag: string) => {
    const removing = form.techStack.includes(tag);
    const stack = removing ? form.techStack.filter(t => t !== tag) : [...form.techStack, tag];
    setForm({ ...form, techStack: stack, ...(tag === "OTHER" && removing ? { otherTechStack: "" } : {}) });
  };
  const words = (s: string) => s.trim() ? s.trim().split(/\s+/).length : 0;
  const thumbRef = useRef<HTMLInputElement>(null);
  const thumbUploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [thumbUploadStatus, setThumbUploadStatus] = useState<UploadStatus>(
    form.thumbnailFile || form.thumbnailUrl ? "done" : "idle",
  );
  const [thumbUploadProgress, setThumbUploadProgress] = useState<number>(
    form.thumbnailFile || form.thumbnailUrl ? 100 : 0,
  );
  const thumbnailFileName = getAssetFileName(form.thumbnailFile, form.thumbnailUrl);
  const thumbnailSizeLabel = formatFileSize(form.thumbnailFile?.size);

  useEffect(() => {
    return () => {
      if (thumbUploadTimerRef.current) {
        clearInterval(thumbUploadTimerRef.current);
      }
    };
  }, []);

  const simulateThumbUpload = () => {
    if (thumbUploadTimerRef.current) {
      clearInterval(thumbUploadTimerRef.current);
    }

    setThumbUploadStatus("loading");
    setThumbUploadProgress(0);
    let progress = 0;

    thumbUploadTimerRef.current = setInterval(() => {
      progress = Math.min(100, progress + 14 + Math.floor(Math.random() * 24));
      setThumbUploadProgress(progress);

      if (progress >= 100) {
        setThumbUploadStatus("done");
        if (thumbUploadTimerRef.current) {
          clearInterval(thumbUploadTimerRef.current);
          thumbUploadTimerRef.current = null;
        }
      }
    }, 160);
  };

  return (
    <>
      <StepHeader n="01" title="PROJECT_IDENTITY" status="Name, track, pitch, thumbnail, and tech stack" />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <FieldLabel required>Project Name</FieldLabel>
          <SInput
            value={form.projectName}
            onChange={(v) => { set("projectName")(v); clearCheck("projectName"); }}
            onBlur={() => void checkField("projectName", "project_name", form.projectName)}
            placeholder="Enter your project name…"
            hasError={fieldChecks.projectName === "taken"}
          />
          <CheckMsg status={fieldChecks.projectName} takenMsg="PROJECT NAME ALREADY SUBMITTED" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 18 }}>
          <div>
            <FieldLabel required hint="YOUR PRE-ASSIGNED TEAM SLOT">Team ID</FieldLabel>
            <div style={{ position: "relative", boxShadow: SHADOW_SM }}>
              <select
                value={form.teamId}
                onChange={(e) => { setForm({ ...form, teamId: e.target.value }); clearCheck("teamId"); void checkField("teamId", "team_id", e.target.value); }}
                style={{ width: "100%", height: 44, background: "#fff", border: `1.5px solid ${fieldChecks.teamId === "taken" ? RED : DARK_BG}`, padding: "0 36px 0 14px", fontFamily: FM, fontSize: 13, color: form.teamId ? DARK_BG : MUTED, appearance: "none", outline: "none", cursor: "pointer", boxSizing: "border-box" }}
              >
                <option value="">Select team ID…</option>
                {TEAM_IDS.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
              <Mono color={MUTED} size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>▾</Mono>
            </div>
            <CheckMsg status={fieldChecks.teamId} takenMsg="TEAM ID ALREADY SUBMITTED — USE YOUR EDIT LINK TO UPDATE" />
          </div>
          <div>
            <FieldLabel required>Track</FieldLabel>
            <div style={{ position: "relative", boxShadow: SHADOW_SM }}>
              <select
                value={form.track}
                onChange={(e) => set("track")(e.target.value)}
                style={{ width: "100%", height: 44, background: "#fff", border: `1.5px solid ${DARK_BG}`, padding: "0 36px 0 14px", fontFamily: FM, fontSize: 13, color: form.track ? DARK_BG : MUTED, appearance: "none", outline: "none", cursor: "pointer", boxSizing: "border-box" }}
              >
                <option value="">Select track…</option>
                {tracks.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Mono color={MUTED} size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>▾</Mono>
            </div>
          </div>
        </div>
        <div>
          <FieldLabel required hint="MAX 6 WORDS">Project Description</FieldLabel>
          <SInput
            value={form.description}
            onChange={set("description")}
            placeholder="e.g. AI campus food-waste tracker"
            suffix={`${words(form.description)} / 6`}
            hasError={words(form.description) > 6}
          />
          {words(form.description) > 6 && (
            <span className="block mt-2 text-xs font-mono font-bold text-[#CC0000]">&gt;&gt; [ERR: MAX 6 WORDS EXCEEDED]</span>
          )}
        </div>
        <div>
          <FieldLabel required hint="MAX 150 WORDS">Short Pitch</FieldLabel>
          <STextarea
            value={form.pitch}
            onChange={set("pitch")}
            placeholder="What does it do, and who is it for?"
            suffix={`${words(form.pitch)} / 150`}
            h={86}
            hasError={words(form.pitch) > 150}
          />
          {words(form.pitch) > 150 && (
            <span className="block mt-2 text-xs font-mono font-bold text-[#CC0000]">&gt;&gt; [ERR: MAX 150 WORDS EXCEEDED]</span>
          )}
        </div>
        <div>
          <FieldLabel required hint="16:9 RECOMMENDED">Thumbnail</FieldLabel>
          <input ref={thumbRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => {
              setThumbnailError(null);
              const file = e.target.files?.[0];
              if (file && file.size > maxFileSizeMb * 1024 * 1024) {
                setThumbnailError(`File exceeds maximum allowed size of ${maxFileSizeMb} MB`);
                e.target.value = "";
                return;
              }
              setForm({ ...form, thumbnailFile: file ?? null });
              if (file) {
                simulateThumbUpload();
              } else {
                setThumbUploadStatus("idle");
                setThumbUploadProgress(0);
              }
            }} />
          <div style={{ width: "clamp(260px, 33.333%, 460px)" }}>
            <motion.div
              onClick={() => thumbRef.current?.click()}
              whileHover={{ borderColor: RED, backgroundColor: "rgba(192,0,0,0.04)" }}
              whileTap={{ scale: 0.995 }}
              transition={{ duration: 0.15 }}
              style={{
                aspectRatio: "16 / 9", border: `1.5px dashed ${DARK_BG}`, background: OFF_WHITE,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 6, boxShadow: SHADOW_SM, cursor: "pointer", overflow: "hidden",
              }}
            >
              {form.thumbnailFile || form.thumbnailUrl ? (
                <>
                  <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        width: "33.333%",
                        minWidth: 110,
                        maxWidth: 180,
                        border: `1.5px solid ${DARK_BG}`,
                        boxShadow: SHADOW_SM,
                        background: "#fff",
                        overflow: "hidden",
                      }}
                    >
                      <ThumbnailPreview file={form.thumbnailFile} url={form.thumbnailUrl} />
                    </div>
                  </div>
                  <span
                    title={thumbnailFileName}
                    style={{
                      width: "90%",
                      fontFamily: FM,
                      fontSize: 10,
                      color: MUTED,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textTransform: "none",
                    }}
                  >
                    {thumbnailFileName}
                  </span>
                  <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, textTransform: "none" }}>
                    {thumbnailSizeLabel}
                  </span>
                  <Mono color={MUTED} size={10}>// Click to replace</Mono>
                </>
              ) : (
                <>
                  <Mono color={MUTED} size={11}>[ Click to Upload ]</Mono>
                  <Mono color={MUTED} size={10}>.JPG .PNG .WEBP · ≤ {maxFileSizeMb} MB</Mono>
                  <Mono color={MUTED} size={10}>// 1 file only</Mono>
                  <Mono color={MUTED} size={10}>// Cropped to 16:9 on display</Mono>
                </>
              )}
            </motion.div>
            {(form.thumbnailFile || form.thumbnailUrl) && (thumbUploadStatus === "loading" || thumbUploadStatus === "done") && (
              <div
                style={{
                  marginTop: 6,
                  background: "rgba(255,255,255,0.92)",
                  border: `1px solid ${DARK_BG}`,
                  padding: "6px 8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Mono color={thumbUploadStatus === "done" ? GREEN : RED} size={10} weight={800}>
                    {thumbUploadStatus === "done" ? "[ Upload Complete ]" : `[ Uploading ${Math.round(thumbUploadProgress)}% ]`}
                  </Mono>
                  <Mono color={MUTED} size={9}>// 1 file only</Mono>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div
                    title={thumbnailFileName}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: FM,
                      fontSize: 10,
                      color: MUTED,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {thumbnailFileName}
                  </div>
                  <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, whiteSpace: "nowrap", textTransform: "none" }}>
                    {thumbnailSizeLabel}
                  </span>
                </div>
                <div style={{ height: 4, background: "#ece6d8", border: `1px solid ${DARK_BG}`, position: "relative" }}>
                  <motion.div
                    initial={false}
                    animate={{ width: `${thumbUploadProgress}%` }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      background: thumbUploadStatus === "done" ? GREEN : RED,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {thumbnailError && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 6 }}>
              // {thumbnailError}
            </Mono>
          )}
        </div>
        <div>
          <FieldLabel required hint="SELECT ALL THAT APPLY">Tech Stack</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TECH_TAGS.map(t => <STag key={t} active={form.techStack.includes(t)} onClick={() => toggleTag(t)}>{t}</STag>)}
          </div>
          {form.techStack.includes("OTHER") && (
            <div style={{ marginTop: 10 }}>
              <FieldLabel required hint="COMMA-SEPARATED · AUTO-UPPERCASED">Specify Other Tech</FieldLabel>
              <SInput
                value={form.otherTechStack}
                onChange={(v) => setForm({ ...form, otherTechStack: v })}
                placeholder="e.g. Flutter, Rust, TensorFlow"
              />
            </div>
          )}
        </div>
        <div>
          <FieldLabel hint="AZURE AI FOUNDRY / AI STUDIO">Uses Microsoft AI Foundry?</FieldLabel>
          <div style={{ display: "flex", gap: 10 }}>
            {([["YES", true], ["NO", false]] as [string, boolean][]).map(([label, val]) => {
              const active = form.usesMicrosoftFoundry === val;
              return (
                <motion.button
                  key={label}
                  type="button"
                  onClick={() => setForm({ ...form, usesMicrosoftFoundry: val })}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  style={{
                    minWidth: 92, height: 42, padding: "0 20px",
                    border: `1.5px solid ${DARK_BG}`,
                    background: active ? RED : "#fff",
                    color: active ? "#fff" : DARK_BG,
                    fontFamily: FM, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em",
                    textTransform: "uppercase", cursor: "pointer",
                    boxShadow: active ? SHADOW_SM : "none",
                  }}
                >
                  [ {label} ]
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
      <FormFooter onNext={onNext} nextLabel="Next: Assets →" showBack={false} disabled={
        !validateStep(0, form, maxTeamSize) ||
        fieldChecks.teamId === "taken" || fieldChecks.teamId === "checking" ||
        fieldChecks.projectName === "taken" || fieldChecks.projectName === "checking"
      } />
    </>
  );
}

// ─── Step 02: Assets ──────────────────────────────────────────

function Step02({
  form,
  setForm,
  onNext,
  onBack,
  maxTeamSize,
  maxFileSizeMb,
  pitchDeckError,
  setPitchDeckError,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onNext: () => void;
  onBack: () => void;
  maxTeamSize: number;
  maxFileSizeMb: number;
  pitchDeckError: string | null;
  setPitchDeckError: (message: string | null) => void;
}) {
  const set = (k: keyof FormState) => (v: string) => setForm({ ...form, [k]: v });
  const deckRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const deckUploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deckUploadStatus, setDeckUploadStatus] = useState<UploadStatus>(
    form.pitchDeckFile || form.pitchDeckUploadUrl ? "done" : "idle",
  );
  const [deckUploadProgress, setDeckUploadProgress] = useState<number>(
    form.pitchDeckFile || form.pitchDeckUploadUrl ? 100 : 0,
  );
  const pitchDeckFileName = getAssetFileName(form.pitchDeckFile, form.pitchDeckUploadUrl);
  const pitchDeckSizeLabel = formatFileSize(form.pitchDeckFile?.size);
  const [isDeckHovering, setIsDeckHovering] = useState(false);
  const touch = (k: string) => () => setTouched(t => ({ ...t, [k]: true }));

  useEffect(() => {
    return () => {
      if (deckUploadTimerRef.current) {
        clearInterval(deckUploadTimerRef.current);
      }
    };
  }, []);

  const simulateDeckUpload = () => {
    if (deckUploadTimerRef.current) {
      clearInterval(deckUploadTimerRef.current);
    }

    setDeckUploadStatus("loading");
    setDeckUploadProgress(0);
    let progress = 0;

    deckUploadTimerRef.current = setInterval(() => {
      progress = Math.min(100, progress + 12 + Math.floor(Math.random() * 26));
      setDeckUploadProgress(progress);

      if (progress >= 100) {
        setDeckUploadStatus("done");
        if (deckUploadTimerRef.current) {
          clearInterval(deckUploadTimerRef.current);
          deckUploadTimerRef.current = null;
        }
      }
    }, 160);
  };

  const canPreviewDeck = Boolean(form.pitchDeckFile || form.pitchDeckUploadUrl);
  const previewDeck = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (form.pitchDeckFile) {
      const localUrl = URL.createObjectURL(form.pitchDeckFile);
      window.open(localUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(localUrl), 60_000);
      return;
    }

    if (form.pitchDeckUploadUrl) {
      window.open(form.pitchDeckUploadUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <StepHeader n="02" title="ASSETS" status="Link your repo, pitch deck, and demo video" />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <FieldLabel required hint="MUST BE PUBLIC">GitHub Repo URL</FieldLabel>
          <SInput value={form.githubRepoUrl} onChange={set("githubRepoUrl")} onBlur={touch("githubRepoUrl")} placeholder="https://github.com/your-org/your-repo" />
          {touched.githubRepoUrl && form.githubRepoUrl && !isValidUrl(form.githubRepoUrl) && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 5 }}>// Invalid URL — must start with https://</Mono>
          )}
        </div>
        <div>
          <FieldLabel hint="OPTIONAL">Live Demo URL</FieldLabel>
          <SInput value={form.liveDemoUrl} onChange={set("liveDemoUrl")} onBlur={touch("liveDemoUrl")} placeholder="https://your-project.vercel.app" />
          {touched.liveDemoUrl && form.liveDemoUrl && !isValidUrl(form.liveDemoUrl) && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 5 }}>// Invalid URL — must start with https://</Mono>
          )}
        </div>
        <div>
          <FieldLabel required hint="GOOGLE DRIVE / CANVA / SLIDES SHARE LINK">Pitch Deck Share URL</FieldLabel>
          <SInput value={form.pitchDeckShareUrl} onChange={set("pitchDeckShareUrl")} onBlur={touch("pitchDeckShareUrl")} placeholder="https://drive.google.com/… or Canva / Slides link" />
          {touched.pitchDeckShareUrl && form.pitchDeckShareUrl && !isValidUrl(form.pitchDeckShareUrl) && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 5 }}>// Invalid URL — must start with https://</Mono>
          )}
        </div>
        <div>
          <FieldLabel hint="PDF / PPTX · OPTIONAL">Upload Pitch Deck</FieldLabel>
          <input ref={deckRef} type="file" accept=".pdf,.ppt,.pptx" style={{ display: "none" }}
            onChange={(e) => {
              setPitchDeckError(null);
              const file = e.target.files?.[0];
              if (file && file.size > maxFileSizeMb * 1024 * 1024) {
                setPitchDeckError(`File exceeds maximum allowed size of ${maxFileSizeMb} MB`);
                e.target.value = "";
                return;
              }
              setForm({ ...form, pitchDeckFile: file ?? null });
              if (file) {
                simulateDeckUpload();
              } else {
                setDeckUploadStatus("idle");
                setDeckUploadProgress(0);
              }
            }} />
          <motion.div
            onClick={() => deckRef.current?.click()}
            onMouseEnter={() => setIsDeckHovering(true)}
            onMouseLeave={() => setIsDeckHovering(false)}
            whileHover={{ borderColor: RED, backgroundColor: "rgba(192,0,0,0.04)" }}
            whileTap={{ scale: 0.995 }}
            transition={{ duration: 0.15 }}
            style={{
              height: 130, border: `1.5px dashed ${DARK_BG}`, background: OFF_WHITE,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, boxShadow: SHADOW_SM, cursor: "pointer", position: "relative", overflow: "hidden",
            }}
          >
            {canPreviewDeck && (
              <button
                type="button"
                onClick={previewDeck}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  height: 24,
                  padding: "0 8px",
                  border: `1.5px solid ${DARK_BG}`,
                  background: isDeckHovering ? RED : "#fff",
                  color: isDeckHovering ? "#fff" : DARK_BG,
                  fontFamily: FM,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: isDeckHovering ? 1 : 0,
                  pointerEvents: isDeckHovering ? "auto" : "none",
                  cursor: "pointer",
                  transition: "opacity 0.15s ease, background 0.15s ease, color 0.15s ease",
                }}
              >
                Preview
              </button>
            )}
            {form.pitchDeckFile ? (
              <>
                <Mono color={RED} size={12} weight={800}>[ File Attached ]</Mono>
                <Mono color={MUTED} size={10}>{pitchDeckFileName}</Mono>
                <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, textTransform: "none" }}>{pitchDeckSizeLabel}</span>
                <Mono color={MUTED} size={10}>// Click to replace</Mono>
              </>
            ) : form.pitchDeckUploadUrl ? (
              <>
                <Mono color={RED} size={12} weight={800}>[ Existing File Ready ]</Mono>
                <Mono color={MUTED} size={10}>{pitchDeckFileName}</Mono>
                <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, textTransform: "none" }}>{pitchDeckSizeLabel}</span>
                <Mono color={MUTED} size={10}>// Click to replace</Mono>
              </>
            ) : (
              <>
                <Mono color={MUTED} size={12}>[ Click to Upload ]</Mono>
                <Mono color={MUTED} size={10}>.PDF .PPTX · ≤ {maxFileSizeMb} MB</Mono>
                <Mono color={MUTED} size={10}>// 1 file only</Mono>
              </>
            )}
          </motion.div>
          {(form.pitchDeckFile || form.pitchDeckUploadUrl) && (deckUploadStatus === "loading" || deckUploadStatus === "done") && (
            <div
              style={{
                marginTop: 6,
                background: "rgba(255,255,255,0.92)",
                border: `1px solid ${DARK_BG}`,
                padding: "6px 8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Mono color={deckUploadStatus === "done" ? GREEN : RED} size={10} weight={800}>
                  {deckUploadStatus === "done" ? "[ Upload Complete ]" : `[ Uploading ${Math.round(deckUploadProgress)}% ]`}
                </Mono>
                <Mono color={MUTED} size={9}>// 1 file only</Mono>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <div
                  title={pitchDeckFileName}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: FM,
                    fontSize: 10,
                    color: MUTED,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pitchDeckFileName}
                </div>
                <span style={{ fontFamily: FM, fontSize: 10, color: MUTED, whiteSpace: "nowrap", textTransform: "none" }}>
                  {pitchDeckSizeLabel}
                </span>
              </div>
              <div style={{ height: 4, background: "#ece6d8", border: `1px solid ${DARK_BG}`, position: "relative" }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${deckUploadProgress}%` }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    background: deckUploadStatus === "done" ? GREEN : RED,
                  }}
                />
              </div>
            </div>
          )}
          {pitchDeckError && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 6 }}>
              // {pitchDeckError}
            </Mono>
          )}
        </div>
        <div>
          <FieldLabel required hint="YOUTUBE / LOOM / GOOGLE DRIVE · REQUIRED">Demo Video URL</FieldLabel>
          <SInput value={form.demoVideoUrl} onChange={set("demoVideoUrl")} onBlur={touch("demoVideoUrl")} placeholder="https://youtube.com/… or Loom / Google Drive link" />
          {touched.demoVideoUrl && form.demoVideoUrl && !isValidUrl(form.demoVideoUrl) && (
            <Mono color={RED} size={10} style={{ display: "block", marginTop: 5 }}>// Invalid URL — must start with https://</Mono>
          )}
        </div>
      </div>
      <FormFooter onNext={onNext} onBack={onBack} nextLabel="Next: Team →" disabled={!validateStep(1, form, maxTeamSize)} />
    </>
  );
}

// ─── Step 03: Team Manifest ───────────────────────────────────

const memberInputStyle: React.CSSProperties = {
  height: 36, border: `1.5px solid ${DARK_BG}`, padding: "0 10px",
  fontFamily: FM, fontSize: 12, color: DARK_BG, outline: "none",
  width: "100%", boxShadow: SHADOW_SM, boxSizing: "border-box",
};

const memberSelectStyle: React.CSSProperties = {
  height: 36, border: `1.5px solid ${DARK_BG}`, padding: "0 20px 0 8px",
  fontFamily: FM, fontSize: 12, outline: "none",
  width: "100%", boxShadow: SHADOW_SM, boxSizing: "border-box",
  background: "#fff", appearance: "none", cursor: "pointer",
};

function Step03({
  form,
  setForm,
  onNext,
  onBack,
  maxTeamSize,
  fieldChecks,
  checkField,
  clearCheck,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onNext: () => void;
  onBack: () => void;
  maxTeamSize: number;
  fieldChecks: Record<string, CheckStatus>;
  checkField: (key: string, dbField: string, value: string) => Promise<void>;
  clearCheck: (key: string) => void;
}) {
  const addMember = () => {
    if (form.members.length < maxTeamSize)
      setForm({ ...form, members: [...form.members, { id: Date.now().toString(), name: "", university: "", role: "", email: "" }] });
  };
  const removeMember = (id: string) => {
    clearCheck(`member:${id}`);
    setForm({ ...form, members: form.members.filter(m => m.id !== id) });
  };
  const updateMember = (id: string, k: keyof Member, v: string) =>
    setForm({ ...form, members: form.members.map(m => m.id === id ? { ...m, [k]: v } : m) });

  return (
    <>
      <StepHeader n="03" title="TEAM_MANIFEST" status={`Add all team members — min 1, max ${maxTeamSize} · Currently ${form.members.length}`} />
      <Mono color="#555555" size={10.5} weight={600} style={{ display: "block", marginBottom: 16, lineHeight: 1.6, whiteSpace: "normal" }}>
        // LIST ALL TEAM MEMBERS. ONLY REGISTERED MEMBERS ARE ELIGIBLE TO PARTICIPATE IN VOTING AND ENTER THE LUCKY DRAW.
      </Mono>
      {/* Horizontal-scroll wrapper — keeps the member table's column layout intact on narrow screens */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "36px 1.3fr 0.85fr 1fr 1.3fr 28px", gap: 6, background: DARK_BG, padding: "10px 8px", border: `1.5px solid ${DARK_BG}` }}>
        {["#", "Name", "University", "Role", "Email", ""].map((h, i) => (
          <Mono key={i} color="#fff" size={10} weight={800} style={{ padding: "0 4px" }}>{h}</Mono>
        ))}
      </div>
      <AnimatePresence>
        {form.members.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "36px 1.3fr 0.85fr 1fr 1.3fr 28px", gap: 6, alignItems: "center", padding: "8px", borderLeft: `1.5px solid ${DARK_BG}`, borderRight: `1.5px solid ${DARK_BG}`, borderBottom: `1.5px solid ${LINE}`, background: "#fff" }}>
              <Badge n={String(i + 1).padStart(2, "0")} size={26} />
              <input value={m.name} onChange={(e) => updateMember(m.id, "name", e.target.value)} placeholder="Full name" style={memberInputStyle} />
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={m.university}
                  onChange={(e) => updateMember(m.id, "university", e.target.value)}
                  style={{ ...memberSelectStyle, color: m.university ? DARK_BG : MUTED }}
                >
                  <option value="" disabled>[ SELECT UNI ]</option>
                  {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontFamily: FM, fontSize: 10, color: MUTED, pointerEvents: "none" }}>▾</span>
              </div>
              <input value={m.role} onChange={(e) => updateMember(m.id, "role", e.target.value)} placeholder="Lead / Dev…" style={memberInputStyle} />
              {(() => {
                const emailInvalid = !!m.email.trim() && !isValidEmail(m.email);
                return (
                  <div>
                    <input
                      value={m.email}
                      onChange={(e) => { updateMember(m.id, "email", e.target.value); clearCheck(`member:${m.id}`); }}
                      onBlur={() => void checkField(`member:${m.id}`, "member_email", m.email)}
                      placeholder="name@mail.sim.edu"
                      style={{ ...memberInputStyle, borderColor: emailInvalid || fieldChecks[`member:${m.id}`] === "taken" ? RED : DARK_BG }}
                    />
                    {emailInvalid ? (
                      <span className="block mt-1 text-xs font-mono font-bold text-[#CC0000]">&gt;&gt; [ERR: INVALID EMAIL FORMAT]</span>
                    ) : (
                      <CheckMsg status={fieldChecks[`member:${m.id}`]} takenMsg="EMAIL ALREADY REGISTERED" />
                    )}
                  </div>
                );
              })()}
              <motion.button
                onClick={() => removeMember(m.id)}
                whileHover={{ background: RED, color: "#fff", borderColor: RED }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={{ width: 28, height: 28, border: `1.5px solid ${DARK_BG}`, background: "#fff", fontFamily: FM, fontSize: 14, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >×</motion.button>
            </div>
          </motion.div>
        ))}
        {form.members.length < maxTeamSize && (
          <motion.div
            key="add-member"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              onClick={addMember}
              whileHover={{ background: "rgba(192,0,0,0.1)" }}
              whileTap={{ scale: 0.99 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", border: `1.5px solid ${DARK_BG}`, background: "rgba(192,0,0,0.04)", cursor: "pointer" }}
            >
              <Badge n={String(form.members.length + 1).padStart(2, "0")} size={26} />
              <Mono color={RED} size={11} weight={800}>[ + Add Member ] — Row {form.members.length + 1} of {maxTeamSize}</Mono>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>
      <FormFooter onNext={onNext} onBack={onBack} nextLabel="Next: Review →" disabled={
        !validateStep(2, form, maxTeamSize) ||
        form.members.some((m) => fieldChecks[`member:${m.id}`] === "taken" || fieldChecks[`member:${m.id}`] === "checking")
      } />
    </>
  );
}

// ─── Step 04: Review & Submit ─────────────────────────────────

function Step04({ form, onBack, onSubmit, isEditing, isPastDeadline, resubmissionOpen, isSubmitting, submitError }: {
  form: FormState; onBack: () => void; onSubmit: () => void;
  isEditing: boolean; isPastDeadline: boolean;
  resubmissionOpen: boolean;
  isSubmitting: boolean; submitError: string | null;
}) {
  const [consent, setConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const RRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "9px 0", borderBottom: `1px dashed ${LINE}`, alignItems: "baseline" }}>
      <Mono color={MUTED} size={10} weight={700}>// {label}</Mono>
      <span style={{ fontFamily: mono ? FM : FS, fontSize: 12.5, color: DARK_BG, lineHeight: 1.5, wordBreak: "break-all" }}>{value || "—"}</span>
    </div>
  );

  const RBlock = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
    <div style={{ border: `1.5px solid ${DARK_BG}`, background: "#fff", boxShadow: SHADOW_SM, padding: 18, position: "relative", marginBottom: 14 }}>
      <div style={{ position: "absolute", top: -1.5, left: -1.5, right: -1.5, height: 3, background: RED }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Badge n={n} size={26} />
        <Mono color={RED} size={12} weight={800} style={{ letterSpacing: "0.12em" }}>{title}</Mono>
      </div>
      {children}
    </div>
  );

  return (
    <>
      <StepHeader n="04" title="REVIEW & SUBMIT" status="Check your details, give consent, and submit" />
      <div style={{ maxHeight: 480, overflow: "auto", paddingRight: 4 }}>
        <RBlock n="01" title="PROJECT_IDENTITY">
          <RRow label="Project" value={form.projectName} />
          <RRow label="Team ID" value={form.teamId} mono />
          <RRow label="Track" value={form.track} />
          <RRow label="Description" value={form.description} />
          <RRow label="Pitch" value={form.pitch} />
          <RRow label="Stack" value={[
            ...form.techStack.filter(t => t !== "OTHER"),
            ...form.otherTechStack.split(",").map(t => t.trim().toUpperCase()).filter(Boolean),
          ].filter((t, i, arr) => arr.indexOf(t) === i).join(" · ")} mono />
          <RRow label="MS AI Foundry" value={form.usesMicrosoftFoundry ? "YES" : "NO"} mono />
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "9px 0", alignItems: "start" }}>
            <Mono color={MUTED} size={10} weight={700}>// Thumbnail</Mono>
            <div style={{ border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW_SM, background: OFF_WHITE, maxWidth: 300, overflow: "hidden" }}>
              {form.thumbnailFile || form.thumbnailUrl ? (
                <ThumbnailPreview file={form.thumbnailFile} url={form.thumbnailUrl} />
              ) : (
                <div style={{ aspectRatio: "16 / 9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mono color={MUTED} size={10}>// No thumbnail uploaded</Mono>
                </div>
              )}
            </div>
          </div>
        </RBlock>

        <RBlock n="02" title="ASSETS">
          <RRow label="Repo" value={form.githubRepoUrl} mono />
          <RRow label="Live Demo URL" value={form.liveDemoUrl} mono />
          <RRow label="Pitch Deck Share URL" value={form.pitchDeckShareUrl} mono />
          <RRow label="Deck File" value={form.pitchDeckFile ? form.pitchDeckFile.name : ""} mono />
          <RRow label="Video Demo URL" value={form.demoVideoUrl} mono />
        </RBlock>

        <RBlock n="03" title="TEAM_MANIFEST">
          <RRow label="Members" value={form.members.filter(m => m.name).map(m => `${m.name} (${m.role})`).join(", ")} />
        </RBlock>

        <motion.div
          onClick={() => setConsent(!consent)}
          whileHover={{ background: "rgba(192,0,0,0.08)" }}
          whileTap={{ scale: 0.995 }}
          transition={{ duration: 0.15 }}
          style={{ border: `1.5px solid ${DARK_BG}`, background: "rgba(192,0,0,0.04)", padding: 16, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 14 }}
        >
          <motion.div
            animate={{ background: consent ? RED : "transparent" }}
            transition={{ duration: 0.15 }}
            style={{ width: 18, height: 18, border: `1.5px solid ${RED}`, color: "#fff", fontFamily: FM, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", marginTop: 2 }}
          >
            <AnimatePresence mode="wait">
              {consent && (
                <motion.span
                  key="check"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >✓</motion.span>
              )}
            </AnimatePresence>
          </motion.div>
          <div>
            <Mono color={RED} size={11} weight={800}>// Consent — Required</Mono>
            <div style={{ height: 4 }} />
            <div style={{ fontFamily: FS, fontSize: 12.5, lineHeight: 1.55, color: DARK_BG }}>
              I confirm all team members consent to this submission, the repo is public, and this project was built within the 24-hour HackXperience window.
            </div>
          </div>
        </motion.div>
      </div>

      <div style={{ marginTop: 10, marginBottom: isPastDeadline ? 8 : 14 }}>
        <span style={{ fontFamily: FM, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", color: MUTED, textTransform: "uppercase" }}>
          // Your submission will be marked pending until reviewed by the organiser.
        </span>
      </div>

      {isPastDeadline && (
        <div style={{ background: "rgba(192,0,0,0.06)", border: `1px dashed ${RED}`, padding: "10px 14px", marginBottom: 12 }}>
          <Mono color={RED} size={11} weight={700}>// Submissions closed — deadline has passed.</Mono>
        </div>
      )}

      {isEditing && !resubmissionOpen && (
        <div style={{ background: "rgba(192,0,0,0.06)", border: `1px dashed ${RED}`, padding: "10px 14px", marginBottom: 12 }}>
          <Mono color={RED} size={11} weight={700}>// Resubmissions are currently disabled by the organizer.</Mono>
        </div>
      )}

      {submitError && (
        <div style={{ background: "rgba(192,0,0,0.06)", border: `1px dashed ${RED}`, padding: "10px 14px", marginBottom: 12 }}>
          <Mono color={RED} size={11} weight={700}>// Error: {submitError}</Mono>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1.5px dashed ${LINE}`, paddingTop: 18 }}>
        <RedBtn ghost onClick={onBack} disabled={isSubmitting}>&lt; Back</RedBtn>
        <RedBtn onClick={() => setShowModal(true)} disabled={!consent || isPastDeadline || (isEditing && !resubmissionOpen) || isSubmitting}>
          {isSubmitting ? "Submitting…" : isEditing ? "Update Submission" : "Submit"}
        </RedBtn>
      </div>

      <AnimatePresence>
        {showModal && (
          <ConfirmModal
            form={form}
            onCancel={() => setShowModal(false)}
            onConfirm={() => { setShowModal(false); onSubmit(); }}
            isEditing={isEditing}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Post-Submission Survey (highly recommended, non-blocking) ─
// 6 questions: 5 auto-advancing single-tap choices + 1 final free-text
// screen. No skip/exit hatch once started — shown only after a successful
// submission, so it never gates the submission itself. A failed
// POST to /api/survey is caught and logged, never surfaced to the user.

type SurveyStepDef =
  | {
      type: "choice"; key: string; question: string; options: string[];
      // For ordinal scales (e.g. 1-5) — labels the endpoints so it's never
      // ambiguous which end is good/bad, and a short hint line under the question.
      optionLabels?: Record<string, string>;
      scaleHint?: string;
    }
  | { type: "text"; key: string; question: string };

const SURVEY_STEPS: SurveyStepDef[] = [
  {
    type: "choice", key: "overall_rating", question: "RATE YOUR HACKXPERIENCE",
    options: ["1", "2", "3", "4", "5"],
    optionLabels: { "1": "WORST", "5": "BEST" },
    scaleHint: "1 = WORST · 5 = BEST",
  },
  { type: "choice", key: "heard_from", question: "HOW'D YOU HEAR ABOUT HACKXPERIENCE?", options: ["INSTAGRAM", "FRIEND", "POSTER", "TELEGRAM", "OTHER"] },
  {
    type: "choice", key: "venue_rating", question: "RATE THE VENUE & LOGISTICS",
    options: ["1", "2", "3", "4", "5"],
    optionLabels: { "1": "WORST", "5": "BEST" },
    scaleHint: "1 = WORST · 5 = BEST",
  },
  { type: "choice", key: "biggest_challenge", question: "BIGGEST CHALLENGE YOU FACED?", options: ["TIME", "TEAM COORDINATION", "TECH ISSUES", "IDEA & SCOPE", "NONE"] },
  { type: "choice", key: "would_rejoin", question: "WOULD YOU JOIN AGAIN?", options: ["YES", "MAYBE", "NO"] },
  { type: "text", key: "final_feedback", question: "ANYTHING ELSE?" },
];

function surveyStorageKey(teamId: string) {
  return `hx26_survey_${teamId}`;
}

function SurveyStep({
  n, total, question, type, options, optionLabels, scaleHint,
  onChoice, textValue, onTextChange, onSubmitText, submitting,
}: {
  n: number; total: number; question: string; type: "choice" | "text";
  options?: string[];
  optionLabels?: Record<string, string>;
  scaleHint?: string;
  onChoice?: (value: string) => void;
  textValue?: string; onTextChange?: (v: string) => void;
  onSubmitText?: () => void;
  submitting?: boolean;
}) {
  const pct = Math.round((n / total) * 100);
  return (
    <div>
      <Mono color={MUTED} size={10} weight={700}>// STEP {n}/{total}</Mono>
      <div style={{ height: 4 }} />
      <div style={{ height: 6, background: "#e9e3d6", border: `1.5px solid ${DARK_BG}`, position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: RED, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ fontFamily: FS, fontSize: 17, fontWeight: 800, color: DARK_BG, marginBottom: scaleHint ? 4 : 16, lineHeight: 1.3 }}>
        {question}
      </div>
      {scaleHint && (
        <Mono color={MUTED} size={10} weight={700} style={{ display: "block", marginBottom: 16 }}>// {scaleHint}</Mono>
      )}

      {type === "choice" && options && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))", gap: 10 }}>
          {options.map(opt => {
            const subLabel = optionLabels?.[opt];
            return (
              <motion.button
                key={opt}
                type="button"
                onClick={() => onChoice?.(opt)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                style={{
                  minHeight: 52, padding: "10px 14px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  border: `1.5px solid ${DARK_BG}`, background: "#fff", color: DARK_BG,
                  fontFamily: FM, fontSize: 13, fontWeight: 800, letterSpacing: "0.06em",
                  textTransform: "uppercase", cursor: "pointer", boxShadow: SHADOW_SM,
                }}
              >
                <span>{opt}</span>
                {subLabel && <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: "0.08em" }}>{subLabel}</span>}
              </motion.button>
            );
          })}
        </div>
      )}

      {type === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <STextarea
            value={textValue ?? ""}
            onChange={(v) => onTextChange?.(v.slice(0, 200))}
            placeholder="Type your feedback…"
            suffix={`${(textValue ?? "").length} / 200`}
            h={80}
          />
          <RedBtn onClick={onSubmitText} disabled={submitting} full>
            {submitting ? "Submitting…" : "[ Done ]"}
          </RedBtn>
        </div>
      )}
    </div>
  );
}

function SurveyComplete() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 20, height: 20, background: GREEN, color: "#fff", fontFamily: FM, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        ✓
      </div>
      <Mono color={MUTED} size={11} weight={600}>
        // Feedback received — thanks for helping us improve!
      </Mono>
    </div>
  );
}

function SurveyWizard({ teamId }: { teamId: string }) {
  const [phase, setPhase] = useState<"prompt" | "active" | "done">("prompt");
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedbackText, setFeedbackText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) { setHydrated(true); return; }
    try {
      const prior = localStorage.getItem(surveyStorageKey(teamId));
      if (prior === "done") setPhase("done");
    } catch { /* localStorage unavailable — treat as first visit */ }
    setHydrated(true);
  }, [teamId]);

  if (!hydrated || !teamId) return null;

  const markDone = () => {
    try { localStorage.setItem(surveyStorageKey(teamId), "done"); } catch { /* non-fatal */ }
  };

  const handleChoiceAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (step < SURVEY_STEPS.length - 1) setStep(step + 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    const finalAnswers = { ...answers, final_feedback: feedbackText.trim() };
    markDone();
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, answers: finalAnswers }),
      });
      if (!res.ok) {
        console.warn("Survey submit failed:", await res.text().catch(() => res.statusText));
      }
    } catch (err) {
      // Never surfaced to the user — a failed save must not affect the
      // success page or the team_id it already confirmed.
      console.warn("Survey submit error:", err);
    } finally {
      setSaving(false);
      setPhase("done");
    }
  };

  const current = SURVEY_STEPS[step];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} style={{ marginBottom: 18 }}>
      <Card padding={20}>
        {phase === "prompt" && (
          <div>
            <Mono color={RED} size={11} weight={800} style={{ letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>&gt; Quick Feedback</Mono>
            <div style={{ fontFamily: FS, fontSize: 15, fontWeight: 700, color: DARK_BG, marginBottom: 4 }}>
              Got 45 seconds? Help us make HackXperience better.
            </div>
            <Mono color={MUTED} size={10} style={{ display: "block", marginBottom: 16 }}>// {SURVEY_STEPS.length} QUICK TAPS · HIGHLY RECOMMENDED</Mono>
            <RedBtn onClick={() => setPhase("active")}>[ Start Survey ]</RedBtn>
          </div>
        )}

        {phase === "active" && (
          <SurveyStep
            n={step + 1}
            total={SURVEY_STEPS.length}
            question={current.question}
            type={current.type}
            options={current.type === "choice" ? current.options : undefined}
            optionLabels={current.type === "choice" ? current.optionLabels : undefined}
            scaleHint={current.type === "choice" ? current.scaleHint : undefined}
            onChoice={(v) => handleChoiceAnswer(current.key, v)}
            textValue={feedbackText}
            onTextChange={setFeedbackText}
            onSubmitText={handleFinish}
            submitting={saving}
          />
        )}

        {phase === "done" && <SurveyComplete />}
      </Card>
    </motion.div>
  );
}

// ─── Success State ────────────────────────────────────────────

function SuccessState({ form, editToken, isNew }: { form: FormState; editToken: string | null; isNew: boolean }) {
  const now = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" });

  useEffect(() => {
    if (!isNew) return;
    const fire = (opts: confetti.Options) => confetti({ zIndex: 9999, ...opts });
    fire({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.65 } });
    fire({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.65 } });
    setTimeout(() => fire({ particleCount: 50, spread: 100, origin: { y: 0.55 } }), 250);
  }, [isNew]);

  const up = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" as const, delay },
  });

  return (
    <div>
      {/* Header */}
      <motion.div {...up(0)} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.06 }}
          style={{ width: 56, height: 56, background: GREEN, color: "#fff", fontFamily: FM, fontWeight: 800, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >✓</motion.div>
        <div>
          <Mono color={GREEN} size={11} weight={800} style={{ letterSpacing: "0.1em" }}>// Submission Received</Mono>
          <div style={{ fontFamily: FS, fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em" }}>You&apos;re in! Good luck!</div>
        </div>
      </motion.div>

      {/* Thumbnail */}
      <motion.div {...up(0.1)} style={{ marginBottom: 24, maxWidth: 420, border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW_SM, overflow: "hidden" }}>
        {form.thumbnailFile || form.thumbnailUrl ? (
          <ThumbnailPreview file={form.thumbnailFile} url={form.thumbnailUrl} />
        ) : (
          <div style={{ aspectRatio: "16 / 9", background: OFF_WHITE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mono color={MUTED} size={11}>// No thumbnail uploaded</Mono>
          </div>
        )}
      </motion.div>

      {/* ID + Timestamp cards */}
      <motion.div {...up(0.18)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14, marginBottom: 18 }}>
        <Card padding={16}>
          <Mono color={MUTED} size={10} weight={600}>// Submission ID</Mono>
          <div style={{ height: 6 }} />
          <div style={{ fontFamily: FM, fontSize: 16, fontWeight: 700, color: DARK_BG }}>HX26-{form.teamId || "TEAM"}-A3F1</div>
          <div style={{ height: 4 }} />
          <Mono color={MUTED} size={10}>Status: PENDING · Admin will review.</Mono>
        </Card>
        <Card padding={16}>
          <Mono color={MUTED} size={10} weight={600}>// Timestamp</Mono>
          <div style={{ height: 6 }} />
          <div style={{ fontFamily: FM, fontSize: 14, fontWeight: 700, color: DARK_BG }}>{now} SGT</div>
          <div style={{ height: 4 }} />
          <Mono color={MUTED} size={10}>Before deadline.</Mono>
        </Card>
      </motion.div>

      {/* What Happens Next */}
      <motion.div {...up(0.26)} style={{ marginBottom: 18 }}>
        <Card padding={18}>
          <Mono color={RED} size={11} weight={800} style={{ letterSpacing: "0.1em" }}>&gt; What Happens Next</Mono>
          <div style={{ height: 12 }} />
          {[
            ["01", "Admin reviews your submission", ""],
            ["02", "Judges score approved entries", ""],
            ["03", "Results posted to Project Gallery", "1st / 2nd / 3rd / Crowd Choice announced post-event."],
          ].map(([n, t, sub], i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.36 + i * 0.09 }}
              style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: i ? `1px dashed ${LINE}` : "none" }}
            >
              <Badge n={n} size={24} />
              <div>
                <div style={{ fontFamily: FS, fontSize: 13, fontWeight: 700 }}>{t}</div>
                {sub && <div style={{ fontFamily: FM, fontSize: 11, color: MUTED, marginTop: 2 }}>// {sub}</div>}
              </div>
            </motion.div>
          ))}
        </Card>
      </motion.div>

      {/* Post-submission survey — highly recommended, collapsed by default,
          never blocks or hides the confirmation above. Only shown right after
          a fresh submit, not when revisiting an existing submission via edit link. */}
      {isNew && form.teamId && <SurveyWizard teamId={form.teamId} />}

      {/* Edit link */}
      {editToken && (
        <motion.div {...up(0.62)} style={{ marginBottom: 18 }}>
          <Card padding={18} style={{ background: "rgba(29,28,23,0.03)" }}>
            <Mono color={DARK_BG} size={11} weight={800}>&gt; Edit Your Submission</Mono>
            <div style={{ height: 10 }} />
            <div style={{ fontFamily: FM, fontSize: 11, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
              // Save this link — paste it to reopen your submission before the deadline. Files must be re-uploaded.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0, background: "#fff", border: `1.5px solid ${DARK_BG}`, padding: "10px 14px", fontFamily: FM, fontSize: 11, color: DARK_BG, wordBreak: "break-all" }}>
                {`${typeof window !== "undefined" ? window.location.origin : ""}/submit?token=${editToken}`}
              </div>
              <RedBtn onClick={() => navigator.clipboard.writeText(`${window.location.origin}/submit?token=${editToken}`)}>
                Copy
              </RedBtn>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Back button */}
      <motion.div {...up(editToken ? 0.72 : 0.62)}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <RedBtn>&gt; Back to HackXperience →</RedBtn>
        </Link>
      </motion.div>
    </div>
  );
}

// ─── Submission Landing ───────────────────────────────────────

function SubmissionLanding({ tick, onStart, hasDraft, isPastDeadline, isSubmissionOpen, deadline, maxTeamSize }: {
  tick: Tick; onStart: () => void; hasDraft: boolean;
  isPastDeadline: boolean; isSubmissionOpen: boolean; deadline: Date | null; maxTeamSize: number;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const isBeforeOpen = !isSubmissionOpen;
  return (
    <div style={{ minHeight: "calc(100vh - 44px)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 48px 64px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ marginBottom: 32 }}
      >
        <span style={{
          display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px",
          background: isBeforeOpen ? MUTED : GREEN,
          color: "#fff", fontFamily: FM, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        }}>
          {isBeforeOpen ? "// Submissions Closed" : "// Submissions Open"}
        </span>
      </motion.div>

      {/* ── Before-open gate ── */}
      {isBeforeOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 32, alignItems: "stretch" }}>
          {/* Left: countdown card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
            style={{ background: DARK_BG, border: `2px solid ${DARK_BG}`, boxShadow: `12px 12px 0 0 ${RED}`, padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 440, position: "relative" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: RED }} />
            <div>
              <Mono color={MUTED} size={11} weight={700} style={{ letterSpacing: "0.14em" }}>// Submission_Gate · Locked</Mono>
              <div style={{ height: 24 }} />
              <div style={{ fontFamily: FS, fontWeight: 800, fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 0.93, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>
                SUBMISSIONS<br />CURRENTLY CLOSED
              </div>
              <div style={{ height: 32 }} />
              <div style={{ display: "flex", gap: 8 }}>
                {([["DAYS", tick.d], ["HRS", tick.h], ["MIN", tick.m], ["SEC", tick.s]] as [string, number][]).map(([u, n]) => (
                  <div key={u} style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", textAlign: "center" }}>
                    <div style={{ fontFamily: FM, fontSize: 36, fontWeight: 700, color: RED, lineHeight: 1 }}>{pad(n)}</div>
                    <div style={{ height: 6 }} />
                    <span style={{ fontFamily: FM, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{u}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {deadline && (
                <div style={{ borderTop: "1px dashed rgba(255,255,255,0.12)", paddingTop: 20, marginTop: 28 }}>
                  <Mono color="rgba(255,255,255,0.35)" size={10} weight={600}>// Deadline</Mono>
                  <div style={{ height: 8 }} />
                  <div style={{ fontFamily: FM, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>
                    {deadline.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Singapore" })}
                    {" · "}
                    {deadline.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore", timeZoneName: "short" })}
                  </div>
                </div>
              )}
              <div style={{ height: 16 }} />
              <div style={{ fontFamily: FM, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
                // Submissions are currently disabled by the organiser.<br />
                // Please check back later.
              </div>
            </div>
          </motion.div>

          {/* Right: prepare card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.12 }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            <div style={{ background: "#fff", border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW_SM, padding: "24px 22px", position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", top: -1.5, left: -1.5, right: -1.5, height: 3, background: RED }} />
              <Mono size={11} weight={800} style={{ display: "block", marginBottom: 6 }}>&gt; Prepare in Advance</Mono>
              <div style={{ fontFamily: FS, fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 20 }}>
                Get these ready so you can submit the moment the portal opens.
              </div>
              {([
                ["01", "Project Identity", "Your project name, team name, chosen track, and a short pitch (~100 words)."],
                ["02", "GitHub Repo", "A public repository link — must be accessible to judges by the deadline."],
                ["03", "Pitch Deck", "A PDF deck or a shareable Google Slides / Canva link."],
                ["04", "Team Details", `Full name, student ID, role, and email for every member (1-${maxTeamSize} people).`],
              ] as [string, string, string][]).map(([n, title, desc], i) => (
                <div key={n} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: i ? `1px dashed ${LINE}` : "none" }}>
                  <Badge n={n} size={26} />
                  <div>
                    <div style={{ fontFamily: FM, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: DARK_BG, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontFamily: FS, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ width: "100%", height: 72, background: DARK_BG, border: `1.5px solid ${DARK_BG}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <div style={{ width: 7, height: 7, background: MUTED, flexShrink: 0 }} />
              <Mono color={MUTED} size={12} weight={700}>// Portal Locked · Opens at Hackathon Start</Mono>
            </div>
          </motion.div>
        </div>
      )}

      {!isBeforeOpen && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 32, alignItems: "stretch" }}>
        {/* Left: dark terminal card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          style={{ background: DARK_BG, border: `2px solid ${DARK_BG}`, boxShadow: `12px 12px 0 0 ${RED}`, padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 440 }}
        >
          <div>
            <Mono color={GREEN} size={11} weight={700} style={{ letterSpacing: "0.14em" }}>Status: Submissions Open</Mono>
            <div style={{ height: 24 }} />
            <div style={{ fontFamily: FS, fontWeight: 800, fontSize: "clamp(40px, 4.5vw, 64px)", lineHeight: 0.93, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>
              SUBMIT<br />YOUR<br /><span style={{ color: RED }}>PROJECT.</span>
            </div>
            <div style={{ height: 28 }} />
            <div style={{ fontFamily: FM, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
              // One submission per team<br />
              // Resubmit until deadline<br />
              // Repo must be public
            </div>
          </div>

          {deadline && (
            <div style={{ marginTop: 40 }}>
              <Mono color="rgba(255,255,255,0.4)" size={10} weight={600}>// Time Remaining</Mono>
              <div style={{ height: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                {([["DAYS", tick.d], ["HRS", tick.h], ["MIN", tick.m], ["SEC", tick.s]] as [string, number][]).map(([u, n]) => (
                  <div key={u} style={{ flex: 1, padding: "10px 0", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", textAlign: "center" }}>
                    <div style={{ fontFamily: FM, fontSize: 26, fontWeight: 700, color: RED, lineHeight: 1 }}>{pad(n)}</div>
                    <div style={{ height: 4 }} />
                    <span style={{ fontFamily: FM, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{u}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 8 }} />
              {deadline && <Mono color="rgba(255,255,255,0.3)" size={10}>// Deadline: {fmtDeadline(deadline)}</Mono>}
            </div>
          )}
        </motion.div>

        {/* Right: steps + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.12 }}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Steps card */}
          <div style={{ background: "#fff", border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW_SM, padding: "24px 22px", position: "relative", flex: 1 }}>
            <div style={{ position: "absolute", top: -1.5, left: -1.5, right: -1.5, height: 3, background: RED }} />
            <Mono size={11} weight={800} style={{ display: "block", marginBottom: 20 }}>&gt; How to Submit</Mono>
            {([
              ["01", "Identity", "Fill in your project name, team name, track, and a short pitch."],
              ["02", "Assets", "Link your GitHub repo and pitch deck URL. Upload your deck if you have it."],
              ["03", "Team", `Add all team members — minimum 1, maximum ${maxTeamSize}.`],
              ["04", "Review", "Check your submission, give consent, and submit. You can resubmit until the deadline."],
            ] as [string, string, string][]).map(([n, title, desc], i) => (
              <div key={n} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: i ? `1px dashed ${LINE}` : "none" }}>
                <Badge n={n} size={26} />
                <div>
                  <div style={{ fontFamily: FM, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: DARK_BG, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: FS, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Draft banner */}
          {hasDraft && !isPastDeadline && (
            <div style={{ background: "rgba(22,163,74,0.08)", border: `1px dashed ${GREEN}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <Mono color={GREEN} size={11} weight={700}>// Draft detected — resume where you left off</Mono>
              <RedBtn onClick={onStart}>Continue Draft</RedBtn>
            </div>
          )}

          {/* CTA */}
          {isPastDeadline || !isSubmissionOpen ? (
            <div style={{ width: "100%", height: 72, background: DARK_BG, border: `1.5px solid ${DARK_BG}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mono color={MUTED} size={13} weight={700}>// Submissions Closed{deadline ? ` · ${fmtDeadline(deadline)}` : ""}</Mono>
            </div>
          ) : (
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{
                width: "100%", height: 72, background: RED, color: "#fff",
                border: `1.5px solid ${DARK_BG}`, boxShadow: SHADOW,
                fontFamily: FM, fontSize: 16, fontWeight: 800, letterSpacing: "0.16em",
                textTransform: "uppercase", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
              }}
            >
              &gt; Submit ▶
            </motion.button>
          )}
        </motion.div>
      </div>}
    </div>
  );
}

// ─── Initial Form State ───────────────────────────────────────

const INITIAL_FORM: FormState = {
  projectName: "", teamId: "", track: "", description: "", pitch: "",
  techStack: [], otherTechStack: "", usesMicrosoftFoundry: false, githubRepoUrl: "", liveDemoUrl: "", pitchDeckShareUrl: "",
  pitchDeckFile: null, pitchDeckUploadUrl: null, demoVideoUrl: "",
  thumbnailFile: null, thumbnailUrl: null,
  members: [{ id: "initial", name: "", university: "", role: "", email: "" }],
};

// ─── Main Page ────────────────────────────────────────────────

export default function SubmitPage() {
  const { settings, deadlineAt, loading: settingsLoading, error: settingsError, refresh: refreshSettings } = useSettings();
  const [view, setView] = useState<"landing" | "form">("landing");
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [tick, setTick] = useState<Tick>({ d: 0, h: 0, m: 0, s: 0 });
  const [lastSaved, setLastSaved] = useState<LastSaved | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isNewSubmission, setIsNewSubmission] = useState(false);
  const [isMountLoading, setIsMountLoading] = useState(true);
  const [thumbnailUploadError, setThumbnailUploadError] = useState<string | null>(null);
  const [pitchDeckUploadError, setPitchDeckUploadError] = useState<string | null>(null);
  const [fieldChecks, setFieldChecks] = useState<Record<string, CheckStatus>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const draftFallbackTeamIdRef = useRef(`draft_${Math.random().toString(36).slice(2, 12)}`);
  const draftSyncInFlightRef = useRef(false);

  const maxTeamSize = settings.max_team_size;
  const maxFileSizeMb = settings.max_file_size;
  const isSubmissionOpen = settings.submission_status;
  const isResubmissionOpen = settings.resubmission_status;
  const trackOptions = settings.active_tracks.length > 0 ? settings.active_tracks : TRACKS;
  const isPastDeadline = deadlineAt !== null && nowMs > deadlineAt.getTime();

  // Load from DB (via token) or localStorage draft on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const storedToken = urlToken ?? localStorage.getItem("hx26_edit_token");

    if (storedToken) {
      fetch(`/api/submissions/${storedToken}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) {
            // Token not found in DB — clear stale localStorage token
            localStorage.removeItem("hx26_edit_token");
          } else {
            setForm(deserializeForm(data));
            setEditToken(storedToken);
            const isDraftFromDb = Boolean((data as { isDraft?: unknown }).isDraft);
            if (urlToken) {
              setView("form");
              setIsEditing(true);
            } else if (isDraftFromDb) {
              setView("form");
              setHasDraft(true);
            } else {
              setSubmitted(true);
            }
          }
        })
        .catch(() => { /* network error — fall through to landing */ })
        .finally(() => setIsMountLoading(false));
      return;
    }

    // No token — check for a saved draft
    const rawDraft = localStorage.getItem("project_submission_draft");
    if (rawDraft) {
      try {
        const draft: StoredDraft = JSON.parse(rawDraft);
        setForm(deserializeForm(draft.form));
        setStep(draft.step);
        setMaxReached(draft.maxReached);
        setHasDraft(true);
      } catch { /* corrupt draft — ignore */ }
    }
    setIsMountLoading(false);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deadlineAt) {
      setTick({ d: 0, h: 0, m: 0, s: 0 });
      return;
    }
    const diff = deadlineAt.getTime() - nowMs;
    if (diff <= 0) {
      setTick({ d: 0, h: 0, m: 0, s: 0 });
      return;
    }
    setTick({
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    });
  }, [deadlineAt, nowMs]);

  // Autosave: debounce 1.5s after any form change, persist to localStorage
  useEffect(() => {
    const id = setTimeout(() => {
      const now = new Date();
      setLastSaved({ step, stepName: STEP_NAMES[step], time: now });
      if (!submitted) {
        localStorage.setItem("project_submission_draft", JSON.stringify({
          form: serializeForm(form),
          step,
          maxReached,
          lastUpdated: now.toISOString(),
        } satisfies StoredDraft));
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [form, step, maxReached, submitted]);

  // Database draft sync removed. Drafts are now handled solely via localStorage.

  const checkField = useCallback(async (key: string, dbField: string, value: string) => {
    const v = value.trim();
    if (!v || editToken) return;
    setFieldChecks((prev) => ({ ...prev, [key]: "checking" }));
    try {
      const res = await fetch(
        `/api/submissions/check?field=${encodeURIComponent(dbField)}&value=${encodeURIComponent(v)}`,
      );
      const { exists } = (await res.json()) as { exists: boolean };
      setFieldChecks((prev) => ({ ...prev, [key]: exists ? "taken" : "available" }));
    } catch {
      // Silent — server-side 409 is the fallback.
      setFieldChecks((prev) => ({ ...prev, [key]: "idle" }));
    }
  }, [editToken]);

  const clearCheck = useCallback((key: string) => {
    setFieldChecks((prev) => (prev[key] === "idle" ? prev : { ...prev, [key]: "idle" }));
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setThumbnailUploadError(null);
    setPitchDeckUploadError(null);

    try {
      const latestSettings = await refreshSettings().catch(() => settings);
      const configuredLimitMb = latestSettings.max_file_size;
      const maxFileBytes = configuredLimitMb * 1024 * 1024;
      const tooLargeMessage = `File exceeds maximum allowed size of ${configuredLimitMb} MB`;

      if (!latestSettings.submission_status) {
        throw new Error("Submissions are currently closed.");
      }

      if (isEditing && !latestSettings.resubmission_status) {
        throw new Error("Resubmissions are currently disabled.");
      }

      if (form.members.length > latestSettings.max_team_size) {
        throw new Error(`Team exceeds maximum size of ${latestSettings.max_team_size} members.`);
      }

      if (form.thumbnailFile && form.thumbnailFile.size > maxFileBytes) {
        setThumbnailUploadError(tooLargeMessage);
        throw new Error(tooLargeMessage);
      }

      if (form.pitchDeckFile && form.pitchDeckFile.size > maxFileBytes) {
        setPitchDeckUploadError(tooLargeMessage);
        throw new Error(tooLargeMessage);
      }

      // 1. Upload files to Supabase Storage (if selected)
      // Preserve existing URLs when no new file is chosen
      let thumbnailUrl: string | null = form.thumbnailUrl ?? null;
      let pitchDeckUploadUrl: string | null = form.pitchDeckUploadUrl ?? null;

      if (form.thumbnailFile) {
        const ext = form.thumbnailFile.name.split(".").pop();
        const path = `thumbnails/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabaseBrowser.storage
          .from("submission-assets")
          .upload(path, form.thumbnailFile, { upsert: true });
        if (!error) {
          const { data } = supabaseBrowser.storage.from("submission-assets").getPublicUrl(path);
          thumbnailUrl = data.publicUrl;
        }
      }

      if (form.pitchDeckFile) {
        const ext = form.pitchDeckFile.name.split(".").pop();
        const path = `pitch-decks/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabaseBrowser.storage
          .from("submission-assets")
          .upload(path, form.pitchDeckFile, { upsert: true });
        if (!error) {
          const { data } = supabaseBrowser.storage.from("submission-assets").getPublicUrl(path);
          pitchDeckUploadUrl = data.publicUrl;
        }
      }

      // 2. Build payload — resolve "OTHER" into actual tech stack entries
      const baseStack = form.techStack.filter(t => t !== "OTHER");
      const customEntries = form.otherTechStack
        .split(",")
        .map(t => t.trim().toUpperCase())
        .filter(Boolean);
      const resolvedStack = [...new Set([...baseStack, ...customEntries])];

      const payload = {
        ...serializeForm(form),
        techStack: resolvedStack,
        thumbnailUrl,
        pitchDeckUploadUrl,
        isDraft: false,
      };

      // 3. POST (create) or PUT (update)
      const url = editToken
        ? `/api/submissions/${editToken}`
        : "/api/submissions";
      const method = editToken ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Submission failed. Please try again.");
      }

      const result = await res.json();
      const token: string = result.editToken;

      // 4. Store just the token locally (source of truth is now the DB)
      localStorage.setItem("hx26_edit_token", token);
      localStorage.removeItem("project_submission_draft");

      setEditToken(token);
      setSubmitted(true);
      setIsNewSubmission(true);
      setIsEditing(false);
      setHasDraft(false);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    const next = step + 1;
    setStep(next);
    setMaxReached(prev => Math.max(prev, next));
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: CREAM_BG,
    backgroundImage: `linear-gradient(rgba(29,28,23,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(29,28,23,0.03) 1px, transparent 1px)`,
    backgroundSize: "20px 20px",
    backgroundPosition: "-1px -1px",
    fontFamily: FS,
    color: DARK_BG,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`${montserrat.variable} ${ibmPlexMono.variable}`}
      style={pageStyle}
    >
      <Navbar />
      <div style={{ paddingTop: 44 }}>
        {(isMountLoading || settingsLoading) && (
          <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mono color={MUTED} size={12} weight={600}>// Loading…</Mono>
          </div>
        )}
        {!(isMountLoading || settingsLoading) && <>
        {view === "landing" && (
          <SubmissionLanding
            tick={tick}
            onStart={() => setView("form")}
            hasDraft={hasDraft}
            isPastDeadline={isPastDeadline}
            isSubmissionOpen={isSubmissionOpen}
            deadline={deadlineAt}
            maxTeamSize={maxTeamSize}
          />
        )}
        {view === "form" && !submitted && isSubmissionOpen && (
          <>
            <PageHero tick={tick} deadline={deadlineAt} />
            <style>{`
              @media (max-width: 1024px) {
                .submit-page-hero {
                  padding: 24px 16px 16px !important;
                }
                .submit-form-layout {
                  padding: 0 16px 16px !important;
                  flex-direction: column !important;
                }
                .submit-step-rail,
                .submit-info-sidebar {
                  width: 100% !important;
                }
                .submit-step-rail {
                  flex-direction: row !important;
                  overflow-x: auto !important;
                  max-width: 100% !important;
                  margin-bottom: 16px !important;
                  gap: 0 !important;
                  -webkit-overflow-scrolling: touch;
                }
                .submit-step-rail-item {
                  flex: 1 0 auto !important;
                  border: 1.5px solid #1A1A1A !important;
                  border-right: none !important;
                  padding: 10px 14px !important;
                }
                .submit-step-rail-item:nth-child(4) {
                  border-right: 1.5px solid #1A1A1A !important;
                }
                .submit-step-rail-saved {
                  display: none !important;
                }
                .submit-form-card {
                  padding: 16px !important;
                  width: 100% !important;
                }
              }
            `}</style>
            <div className="submit-form-layout" style={{ padding: "0 48px 48px", display: "flex", gap: 24, alignItems: "flex-start" }}>
              <StepRail
                active={step}
                onStepClick={(i) => { if (i <= maxReached) setStep(i); }}
                maxReached={maxReached}
                maxTeamSize={maxTeamSize}
                lastSaved={lastSaved}
              />
              <Card className="submit-form-card" padding={28} style={{ flex: 1, minWidth: 0, minHeight: 520 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {step === 0 && (
                      <Step01
                        form={form}
                        setForm={setForm}
                        onNext={goNext}
                        maxTeamSize={maxTeamSize}
                        tracks={trackOptions}
                        maxFileSizeMb={maxFileSizeMb}
                        thumbnailError={thumbnailUploadError}
                        setThumbnailError={setThumbnailUploadError}
                        fieldChecks={fieldChecks}
                        checkField={checkField}
                        clearCheck={clearCheck}
                      />
                    )}
                    {step === 1 && (
                      <Step02
                        form={form}
                        setForm={setForm}
                        onNext={goNext}
                        onBack={() => setStep(0)}
                        maxTeamSize={maxTeamSize}
                        maxFileSizeMb={maxFileSizeMb}
                        pitchDeckError={pitchDeckUploadError}
                        setPitchDeckError={setPitchDeckUploadError}
                      />
                    )}
                    {step === 2 && <Step03 form={form} setForm={setForm} onNext={goNext} onBack={() => setStep(1)} maxTeamSize={maxTeamSize} fieldChecks={fieldChecks} checkField={checkField} clearCheck={clearCheck} />}
                    {step === 3 && (
                      <Step04
                        form={form}
                        onBack={() => setStep(2)}
                        onSubmit={handleSubmit}
                        isEditing={isEditing}
                        isPastDeadline={isPastDeadline}
                        resubmissionOpen={isResubmissionOpen}
                        isSubmitting={isSubmitting}
                        submitError={submitError}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Card>
              <InfoSidebar step={step} />
            </div>
          </>
        )}
        {view === "form" && !submitted && !isSubmissionOpen && (
          <div style={{ padding: "48px" }}>
            <Card padding={24}>
              <Mono color={RED} size={12} weight={700}>
                // SUBMISSIONS ARE CURRENTLY CLOSED.
              </Mono>
              {deadlineAt && (
                <Mono color={MUTED} size={10} style={{ display: "block", marginTop: 8 }}>
                  // DEADLINE: {fmtDeadline(deadlineAt)}
                </Mono>
              )}
              {settingsError && (
                <Mono color={RED} size={10} style={{ display: "block", marginTop: 8 }}>
                  // {settingsError}
                </Mono>
              )}
            </Card>
          </div>
        )}
        {submitted && (
          <div style={{ padding: "48px" }}>
            <Card padding={28}>
              <SuccessState form={form} editToken={editToken} isNew={isNewSubmission} />
            </Card>
          </div>
        )}
        </>}
      </div>
    </motion.div>
  );
}
