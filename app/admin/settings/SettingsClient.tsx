"use client";

import { Check, LogOut, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShellConfig, type AdminMetric } from "../components/AdminShell";
import { usePortalSettings } from "../components/PortalSettingsContext";
import { HACKX_TRACKS, type AdminSubmission } from "@/lib/types";
import {
  createAdminJudge,
  deleteAdminJudge,
  fetchAdminJudges,
  fetchAdminSettings,
  fetchAdminSubmissions,
  updateAdminJudge,
  updateAdminSettings,
  type AdminJudge,
  type AdminSettingsRow,
} from "@/lib/client/admin-api";
import { logoutPortal } from "@/lib/client/auth-api";
import styles from "./Settings.module.css";

function buildMetrics(all: AdminSubmission[]): AdminMetric[] {
  const pending = all.filter((submission) => submission.status === "pending").length;
  const approved = all.filter((submission) => submission.status === "approved").length;
  const rejected = all.filter((submission) => submission.status === "rejected").length;
  return [
    { key: "total", label: "TOTAL_SUBMISSIONS", value: String(all.length), helper: "received", tone: "neutral" },
    { key: "pending", label: "PENDING", value: String(pending), helper: "awaiting review", tone: "amber" },
    { key: "approved", label: "APPROVED", value: String(approved), helper: "cleared for showcase", tone: "emerald" },
    { key: "rejected", label: "REJECTED", value: String(rejected), helper: "returned to team", tone: "red" },
    { key: "deadline_countdown", label: "DEADLINE_COUNTDOWN", value: "00.00.00.00", helper: "until close", tone: "neutral" },
  ];
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`${styles.toggle} ${on ? styles.toggleOn : styles.toggleOff}`}
      onClick={onToggle}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DeadlineRow({
  deadline,
  onSave,
}: {
  deadline: string | null | undefined;
  onSave: (isoString: string) => void;
}) {
  const [localVal, setLocalVal] = useState(() => toDatetimeLocalValue(deadline));

  useEffect(() => {
    setLocalVal(toDatetimeLocalValue(deadline));
  }, [deadline]);

  return (
    <div className={styles.configRow}>
      <span className={styles.configLabel}>
        DEADLINE
        <span className={styles.configSub}>// SUBMISSION CLOSE (LOCAL TIMEZONE)</span>
      </span>
      <div className={styles.deadlineControl}>
        <input
          type="datetime-local"
          className={styles.deadlineInput}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          aria-label="Submission deadline"
        />
        <button
          type="button"
          className={styles.deadlineSaveBtn}
          disabled={!localVal}
          onClick={() => {
            if (!localVal) return;
            onSave(new Date(localVal).toISOString());
          }}
        >
          SET
        </button>
      </div>
    </div>
  );
}

function SubmissionConfigPanel({
  submissionsOpen,
  allowResubmissions,
  maxTeamSize,
  maxFileSizeMb,
  deadline,
  onToggleSubmissionsOpen,
  onToggleResubmissions,
  onSaveConfig,
  onDeadlineSave,
}: {
  submissionsOpen: boolean;
  allowResubmissions: boolean;
  maxTeamSize: number;
  maxFileSizeMb: number;
  deadline: string | null | undefined;
  onToggleSubmissionsOpen: () => void;
  onToggleResubmissions: () => void;
  onSaveConfig: (maxTeamSize: number, maxFileSizeMb: number) => Promise<void>;
  onDeadlineSave: (isoString: string) => void;
}) {
  const [teamSizeRaw, setTeamSizeRaw] = useState(String(maxTeamSize));
  const [fileSizeRaw, setFileSizeRaw] = useState(String(maxFileSizeMb));
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => { setTeamSizeRaw(String(maxTeamSize)); }, [maxTeamSize]);
  useEffect(() => { setFileSizeRaw(String(maxFileSizeMb)); }, [maxFileSizeMb]);

  const teamSizeError = teamSizeRaw === "" || parseInt(teamSizeRaw, 10) <= 0;
  const fileSizeError = fileSizeRaw === "" || parseInt(fileSizeRaw, 10) <= 0;
  const hasErrors = teamSizeError || fileSizeError;

  async function handleSaveConfig() {
    if (hasErrors) return;
    await onSaveConfig(parseInt(teamSizeRaw, 10), parseInt(fileSizeRaw, 10));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>&gt; SUBMISSION_CONFIG</h3>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.configRow}>
          <span className={styles.configLabel}>
            SUBMISSION WINDOW
            <span className={styles.configSub}>
              {submissionsOpen ? "// ACCEPTING ENTRIES" : "// CLOSED TO ENTRIES"}
            </span>
          </span>
          <Toggle on={submissionsOpen} onToggle={onToggleSubmissionsOpen} label="Toggle submission window" />
        </div>

        <div className={styles.divider} />

        <div className={styles.configRow}>
          <span className={styles.configLabel}>
            ALLOW RESUBMISSIONS
            <span className={styles.configSub}>{"// TEAMS MAY OVERWRITE SUBMISSION"}</span>
          </span>
          <Toggle on={allowResubmissions} onToggle={onToggleResubmissions} label="Toggle resubmissions" />
        </div>

        <div className={styles.divider} />

        <div className={styles.configRow}>
          <span className={styles.configLabel}>
            MAX TEAM SIZE
            <span className={styles.configSub}>{"// MEMBERS PER SUBMISSION"}</span>
          </span>
          <div>
            <input
              type="text"
              inputMode="numeric"
              className={`${styles.numberInput}${teamSizeError ? ` ${styles.numberInputError}` : ""}`}
              value={teamSizeRaw}
              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setTeamSizeRaw(e.target.value); }}
              aria-label="Max team size"
            />
            {teamSizeError && <span className={styles.inputErrorMsg}>&gt;&gt; [ERR: INTEGER_REQUIRED]</span>}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.configRow}>
          <span className={styles.configLabel}>
            MAX FILE SIZE
            <span className={styles.configSub}>{"// PER SUBMISSION UPLOAD"}</span>
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="text"
                inputMode="numeric"
                className={`${styles.numberInput}${fileSizeError ? ` ${styles.numberInputError}` : ""}`}
                value={fileSizeRaw}
                onChange={(e) => { if (/^\d*$/.test(e.target.value)) setFileSizeRaw(e.target.value); }}
                aria-label="Max file size in MB"
              />
              <span className={styles.inputUnit}>MB</span>
            </div>
            {fileSizeError && <span className={styles.inputErrorMsg}>&gt;&gt; [ERR: INTEGER_REQUIRED]</span>}
          </div>
        </div>

        <div className={styles.divider} />

        <DeadlineRow deadline={deadline} onSave={onDeadlineSave} />
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          className={styles.updateBtn}
          disabled={hasErrors}
          onClick={() => void handleSaveConfig()}
        >
          [ UPDATE ]
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => {
            setTeamSizeRaw(String(DEFAULT_TEAM_SIZE));
            setFileSizeRaw(String(DEFAULT_FILE_SIZE_MB));
          }}
        >
          [ RESET ]
        </button>
        {saveSuccess && <p className={styles.updateSuccessMsg}>&gt; SAVED!</p>}
      </div>
    </section>
  );
}

type Criterion = {
  key:
    | "technical_execution_value"
    | "problem_solution_fit_value"
    | "innovation_creativity_value"
    | "presentation_quality_value";
  label: string;
  maxPts: number;
};

function JudgingCriteriaPanel({
  criteria,
  onSave,
}: {
  criteria: Criterion[];
  onSave: (values: Record<Criterion["key"], number>) => Promise<void>;
}) {
  const [rawValues, setRawValues] = useState<Record<Criterion["key"], string>>(
    () => Object.fromEntries(criteria.map((c) => [c.key, String(c.maxPts)])) as Record<Criterion["key"], string>
  );
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    setRawValues(
      Object.fromEntries(criteria.map((c) => [c.key, String(c.maxPts)])) as Record<Criterion["key"], string>
    );
  }, [criteria]);

  const errors = useMemo(
    () =>
      Object.fromEntries(
        criteria.map((c) => {
          const raw = rawValues[c.key] ?? "";
          const parsed = parseInt(raw, 10);
          return [c.key, raw === "" || Number.isNaN(parsed) || parsed <= 0];
        })
      ) as Record<Criterion["key"], boolean>,
    [criteria, rawValues]
  );

  const hasErrors = Object.values(errors).some(Boolean);

  const total = useMemo(
    () =>
      criteria.reduce((sum, c) => {
        const parsed = parseInt(rawValues[c.key] ?? "0", 10);
        return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
      }, 0),
    [criteria, rawValues]
  );

  function handleChange(key: Criterion["key"], value: string) {
    if (/^\d*$/.test(value)) setRawValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (hasErrors) return;
    await onSave(
      Object.fromEntries(criteria.map((c) => [c.key, parseInt(rawValues[c.key], 10)])) as Record<Criterion["key"], number>
    );
    setUpdateSuccess(true);
    setTimeout(() => setUpdateSuccess(false), 3000);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>&gt; JUDGING_CRITERIA</h3>
      </div>
      <div className={styles.panelBody}>
        {criteria.map((criterion) => (
          <div key={criterion.key} className={styles.criteriaRow}>
            <span className={styles.criteriaLabel}>{criterion.label}</span>
            <div>
              <div className={styles.criteriaControls}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`${styles.numberInput}${errors[criterion.key] ? ` ${styles.numberInputError}` : ""}`}
                  value={rawValues[criterion.key] ?? ""}
                  onChange={(e) => handleChange(criterion.key, e.target.value)}
                  aria-label={`${criterion.label} max points`}
                />
                <span className={styles.inputUnit}>pts</span>
              </div>
              {errors[criterion.key] && (
                <span className={styles.inputErrorMsg}>&gt;&gt; [ERR: INTEGER_REQUIRED]</span>
              )}
            </div>
          </div>
        ))}
        <p className={styles.criteriaTotal}>
          TOTAL <strong>{total}</strong> pts
        </p>
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          className={styles.updateBtn}
          disabled={hasErrors}
          onClick={() => void handleSave()}
        >
          [ UPDATE ]
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() =>
            setRawValues(
              Object.fromEntries(
                criteria.map((c) => [c.key, String(DEFAULT_JUDGING[c.key])])
              ) as Record<Criterion["key"], string>
            )
          }
        >
          [ RESET ]
        </button>
        {updateSuccess && (
          <p className={styles.updateSuccessMsg}>&gt; UPDATE SUCCESSFUL!</p>
        )}
      </div>
    </section>
  );
}

function TracksPanel({
  activeTracks,
  onToggleTrack,
  onDeleteTrack,
}: {
  activeTracks: Set<string>;
  onToggleTrack: (track: string) => void;
  onDeleteTrack: (track: string) => void;
}) {
  const [newTrackInput, setNewTrackInput] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Local list of custom track names — persists even when a custom track is toggled off,
  // so the row stays visible and only an explicit [ X ] removes it entirely.
  const [localCustomTracks, setLocalCustomTracks] = useState<string[]>(() =>
    Array.from(activeTracks).filter(
      (t) => !HACKX_TRACKS.includes(t as (typeof HACKX_TRACKS)[number]),
    ),
  );

  // Merge server-side custom tracks that arrive after the initial load (e.g. settings fetch).
  useEffect(() => {
    setLocalCustomTracks((prev) => {
      const incoming = Array.from(activeTracks).filter(
        (t) => !HACKX_TRACKS.includes(t as (typeof HACKX_TRACKS)[number]),
      );
      const next = [...prev];
      for (const t of incoming) {
        if (!next.includes(t)) next.push(t);
      }
      return next.length === prev.length && next.every((t, i) => t === prev[i]) ? prev : next;
    });
  }, [activeTracks]);

  const allTracks = useMemo(
    () => [...HACKX_TRACKS, ...localCustomTracks],
    [localCustomTracks],
  );

  function handleAdd() {
    const trimmed = newTrackInput.trim();
    const alreadyExists =
      HACKX_TRACKS.includes(trimmed as (typeof HACKX_TRACKS)[number]) ||
      localCustomTracks.includes(trimmed);
    if (!trimmed || alreadyExists) return;
    setLocalCustomTracks((prev) => [...prev, trimmed]);
    if (!activeTracks.has(trimmed)) onToggleTrack(trimmed);
    setNewTrackInput("");
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    onDeleteTrack(pendingDelete);
    setLocalCustomTracks((prev) => prev.filter((t) => t !== pendingDelete));
    setPendingDelete(null);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>&gt; TRACKS</h3>
      </div>
      <div className={styles.panelBody}>
        {allTracks.map((track, index) => {
          const id = `TRACK_${String(index + 1).padStart(2, "0")}`;
          const enabled = activeTracks.has(track);
          const isCustom = !HACKX_TRACKS.includes(track as (typeof HACKX_TRACKS)[number]);
          return (
            <div key={track} className={styles.trackRow}>
              <div className={styles.trackInfo}>
                <div className={styles.trackId}>{id}</div>
                <div className={styles.trackName}>{track}</div>
              </div>
              <div className={styles.trackActions}>
                {isCustom && (
                  <button
                    type="button"
                    className={styles.removeTrackBtn}
                    onClick={() => setPendingDelete(track)}
                    aria-label={`Delete track ${track}`}
                  >
                    [ X ]
                  </button>
                )}
                <Toggle on={enabled} onToggle={() => onToggleTrack(track)} label={`Toggle ${id}`} />
              </div>
            </div>
          );
        })}

        <div className={styles.trackAddSection}>
          <input
            type="text"
            className={styles.trackAddInput}
            value={newTrackInput}
            placeholder="new_track_name"
            onChange={(e) => setNewTrackInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            aria-label="New track name"
          />
          <button
            type="button"
            className={styles.trackAddBtn}
            onClick={handleAdd}
            disabled={
              !newTrackInput.trim() ||
              HACKX_TRACKS.includes(newTrackInput.trim() as (typeof HACKX_TRACKS)[number]) ||
              localCustomTracks.includes(newTrackInput.trim())
            }
          >
            [ ADD ]
          </button>
        </div>
      </div>

      {pendingDelete && (
        <div className={styles.modalOverlay} onClick={() => setPendingDelete(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-track-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalAccent} />
            <p id="delete-track-title" className={styles.modalTitle}>DELETE_TRACK</p>
            <p className={styles.modalWarning}>{"// THIS WILL REMOVE IT FROM ACTIVE TRACKS"}</p>
            <p className={styles.modalBody}>
              Are you sure you want to remove &quot;{pendingDelete}&quot;?
            </p>
            <div className={styles.modalButtons}>
              <button type="button" className={styles.modalYes} onClick={handleConfirmDelete}>
                YES
              </button>
              <button type="button" className={styles.modalNo} onClick={() => setPendingDelete(null)}>
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminSessionPanel({
  username,
  duration,
  onLogout,
}: {
  username: string;
  duration: string;
  onLogout: () => void;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>&gt; ADMIN_SESSION</h3>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.sessionInfo}>
          <div className={styles.sessionField}>
            <span className={styles.sessionFieldLabel}>ADMIN_ID</span>
            <span className={`${styles.sessionFieldValue} ${styles.accent}`}>{username}</span>
          </div>
          <div className={styles.sessionField}>
            <span className={styles.sessionFieldLabel}>ROLE</span>
            <span className={styles.sessionFieldValue}>ADMIN</span>
          </div>
          <div className={styles.sessionField}>
            <span className={styles.sessionFieldLabel}>SESSION_START</span>
            <span className={styles.sessionFieldValue}>ACTIVE</span>
          </div>
          <div className={styles.sessionField}>
            <span className={styles.sessionFieldLabel}>DURATION</span>
            <span className={styles.sessionFieldValue}>{duration}</span>
          </div>
        </div>
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          <LogOut aria-hidden="true" />
          <span>LOGOUT_SESSION</span>
        </button>
      </div>
    </section>
  );
}

type EditingState = { id: string; username: string } | null;
type AddingState = { username: string; password: string } | null;

function JudgeAccountsPanel({
  judges,
  onCreate,
  onUpdate,
  onDelete,
}: {
  judges: AdminJudge[];
  onCreate: (payload: { username: string; password: string }) => Promise<void>;
  onUpdate: (id: string, payload: { username?: string; password?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [adding, setAdding] = useState<AddingState>(null);

  async function confirmEdit() {
    if (!editing || !editing.username.trim()) return;
    try {
      await onUpdate(editing.id, { username: editing.username.trim() });
      setEditing(null);
    } catch {
      // Keep the row open so the admin can fix and retry.
    }
  }

  function cancelEdit() {
    setEditing(null);
  }

  function startEdit(judge: AdminJudge) {
    setAdding(null);
    setEditing({ id: judge.id, username: judge.username });
  }

  function startAdd() {
    setEditing(null);
    setAdding({ username: "", password: "" });
  }

  async function confirmAdd() {
    if (!adding || !adding.username.trim() || !adding.password) return;
    try {
      await onCreate({ username: adding.username.trim(), password: adding.password });
      setAdding(null);
    } catch {
      // Keep the row open so the admin can fix and retry.
    }
  }

  function cancelAdd() {
    setAdding(null);
  }

  return (
    <section className={`${styles.panel} ${styles.fullCol}`}>
      <div className={styles.panelHead}>
        <h3>&gt; JUDGE_ACCOUNTS</h3>
      </div>

      <div className={styles.judgeTableScroll}><div className={styles.judgeTable}>
        <div className={styles.tableHead}>JUDGE_ID</div>
        <div className={styles.tableHead}>JUDGE NAME</div>
        <div className={styles.tableHead}>STATUS</div>
        <div className={styles.tableHead}>LAST LOGGED IN</div>
        <div className={styles.tableHead}>ACTIONS</div>

        {judges.map((judge) =>
          editing?.id === judge.id ? (
            <div className={styles.addFormRow} key={judge.id}>
              <div className={styles.addFormCell} data-label="JUDGE_ID">
                <input
                  type="text"
                  className={styles.addInput}
                  value={String(judge.id)}
                  readOnly
                  aria-label="Judge ID"
                />
              </div>
              <div className={styles.addFormCell} data-label="JUDGE NAME">
                <input
                  type="text"
                  className={styles.addInput}
                  value={editing.username}
                  placeholder="Judge username..."
                  onChange={(event) => setEditing((prev) => prev && { ...prev, username: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void confirmEdit();
                    if (event.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                  aria-label="Judge username"
                />
              </div>
              <div className={styles.addFormCell} data-label="STATUS">
                <span className={styles.statusActive}>ACTIVE</span>
              </div>
              <div className={styles.addFormCell} data-label="LAST LOGGED IN">
                <span style={{ color: "#7a7669", fontSize: 10 }}>—</span>
              </div>
              <div className={styles.addFormCell} data-label="ACTIONS">
                <div className={styles.addFormActions}>
                  <button type="button" className={styles.confirmBtn} onClick={() => void confirmEdit()} aria-label="Confirm edit">
                    <Check aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.cancelBtn} onClick={cancelEdit} aria-label="Cancel edit">
                    <X aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.judgeRow} key={judge.id}>
              <div className={styles.judgeCell} data-label="JUDGE_ID">{judge.id}</div>
              <div className={styles.judgeCell} data-label="JUDGE NAME">{judge.username}</div>
              <div className={styles.judgeCell} data-label="STATUS">
                <span className={styles.statusActive}>ACTIVE</span>
              </div>
              <div className={styles.judgeCell} data-label="LAST LOGGED IN">
                {formatLastLogin(judge.last_login)}
              </div>
              <div className={styles.judgeCell} data-label="ACTIONS">
                <div className={styles.judgeActions}>
                  <button type="button" className={styles.editBtn} onClick={() => startEdit(judge)}>
                    [ EDIT ]
                  </button>
                  <button type="button" className={styles.deleteBtn} aria-label="Delete judge" onClick={() => void onDelete(judge.id)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ),
        )}

        {adding && (
          <div className={styles.addFormRow}>
            <div className={styles.addFormCell} data-label="JUDGE_ID">
              <span style={{ color: "#7a7669", fontSize: 10 }}>// AUTO</span>
            </div>
            <div className={styles.addFormCell} data-label="JUDGE NAME">
              <input
                type="text"
                className={styles.addInput}
                value={adding.username}
                placeholder="judge_username"
                onChange={(event) => setAdding((prev) => prev && { ...prev, username: event.target.value })}
                aria-label="New judge username"
                autoFocus
              />
            </div>
            <div className={styles.addFormCell} data-label="STATUS">
              <span className={styles.statusActive}>ACTIVE</span>
            </div>
            <div className={styles.addFormCell} data-label="LAST LOGGED IN">
              <input
                type="password"
                className={styles.addInput}
                value={adding.password}
                placeholder="Initial password..."
                onChange={(event) => setAdding((prev) => prev && { ...prev, password: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirmAdd();
                  if (event.key === "Escape") cancelAdd();
                }}
                aria-label="New judge password"
              />
            </div>
            <div className={styles.addFormCell} data-label="ACTIONS">
              <div className={styles.addFormActions}>
                <button type="button" className={styles.confirmBtn} onClick={() => void confirmAdd()} aria-label="Confirm add">
                  <Check aria-hidden="true" />
                </button>
                <button type="button" className={styles.cancelBtn} onClick={cancelAdd} aria-label="Cancel add">
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div></div>

      <div className={styles.panelFooter}>
        <button
          type="button"
          className={styles.addJudgeBtn}
          onClick={startAdd}
          disabled={!!adding}
        >
          <Plus aria-hidden="true" style={{ width: 12, height: 12 }} />
          <span>ADD_JUDGE</span>
        </button>
      </div>
    </section>
  );
}

const DEFAULT_TEAM_SIZE = 5;
const DEFAULT_FILE_SIZE_MB = 10;
const DEFAULT_JUDGING: Record<Criterion["key"], number> = {
  technical_execution_value: 30,
  problem_solution_fit_value: 25,
  innovation_creativity_value: 25,
  presentation_quality_value: 20,
};

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
    hour12: false,
  });
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function SettingsClient() {
  const router = useRouter();
  const { submissionsOpen, allowResubmissions, toggleSubmissionsOpen, toggleAllowResubmissions } = usePortalSettings();

  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [settings, setSettings] = useState<AdminSettingsRow | null>(null);
  const [judges, setJudges] = useState<AdminJudge[]>([]);
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState("admin");
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [durationNow, setDurationNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setDurationNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const shellMetrics = useMemo(() => buildMetrics(submissions), [submissions]);

  const loadData = useCallback(async () => {
    setError("");

    const [submissionsResult, settingsResult, judgesResult, sessionResult] = await Promise.allSettled([
      fetchAdminSubmissions(),
      fetchAdminSettings(),
      fetchAdminJudges(),
      fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()),
    ]);

    if (submissionsResult.status === "fulfilled") {
      setSubmissions(submissionsResult.value.submissions);
    } else {
      setError((prev) => prev || "Unable to load submissions metrics.");
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value.settings);
    } else {
      setError((prev) => prev || "Unable to load settings.");
    }

    if (judgesResult.status === "fulfilled") {
      setJudges(judgesResult.value.judges);
    } else {
      setError((prev) => prev || "Unable to load judges.");
    }

    if (sessionResult.status === "fulfilled") {
      const username = sessionResult.value?.session?.username;
      if (typeof username === "string" && username) setSessionUser(username);
      const issuedAt = sessionResult.value?.session?.iat;
      if (typeof issuedAt === "number" && Number.isFinite(issuedAt)) {
        setSessionStart(issuedAt * 1000);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const patchSettings = useCallback(async (updates: Partial<AdminSettingsRow>) => {
    try {
      const payload = await updateAdminSettings(updates);
      setSettings(payload.settings);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Unable to save settings.");
    }
  }, []);

  const criteria = useMemo<Criterion[]>(() => [
    { key: "technical_execution_value", label: "TECHNICAL_EXECUTION", maxPts: settings?.technical_execution_value ?? 30 },
    { key: "problem_solution_fit_value", label: "PROBLEM_SOLUTION_FIT", maxPts: settings?.problem_solution_fit_value ?? 25 },
    { key: "innovation_creativity_value", label: "INNOVATION_CREATIVITY", maxPts: settings?.innovation_creativity_value ?? 25 },
    { key: "presentation_quality_value", label: "PRESENTATION_QUALITY", maxPts: settings?.presentation_quality_value ?? 20 },
  ], [settings]);

  const activeTracks = useMemo(
    () => new Set(
      Array.isArray(settings?.active_tracks)
        ? settings.active_tracks.filter((item): item is string => typeof item === "string")
        : [],
    ),
    [settings?.active_tracks],
  );

  const handleToggleTrack = useCallback((track: string) => {
    const next = new Set(activeTracks);
    if (next.has(track)) {
      next.delete(track);
    } else {
      next.add(track);
    }
    void patchSettings({ active_tracks: Array.from(next) });
  }, [activeTracks, patchSettings]);

  const handleDeleteTrack = useCallback((track: string) => {
    if (!activeTracks.has(track)) return;
    void patchSettings({
      active_tracks: Array.from(activeTracks).filter((t) => t !== track),
    });
  }, [activeTracks, patchSettings]);

  const handleCreateJudge = useCallback(async (payload: { username: string; password: string }) => {
    setError("");
    try {
      const response = await createAdminJudge(payload);
      setJudges((prev) => [...prev, response.judge]);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create judge.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const handleUpdateJudge = useCallback(async (id: string, payload: { username?: string; password?: string }) => {
    setError("");
    try {
      const response = await updateAdminJudge(id, payload);
      setJudges((prev) => prev.map((judge) => judge.id === id ? response.judge : judge));
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update judge.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const handleDeleteJudge = useCallback(async (id: string) => {
    setError("");
    try {
      await deleteAdminJudge(id);
      setJudges((prev) => prev.filter((judge) => judge.id !== id));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete judge.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutPortal();
    router.replace("/admin/login");
  }, [router]);

  return (
    <>
      <AdminShellConfig value={{ metrics: shellMetrics }} />

      <header className={styles.pageHeader}>
        <h2>&gt; SETTINGS</h2>
        <p>{error ? `// ${error.toUpperCase()}` : "// CONFIGURE EVENT PARAMETERS, JUDGING, AND ACCOUNTS"}</p>
      </header>

      <div className={styles.settingsGrid}>
        <SubmissionConfigPanel
          submissionsOpen={submissionsOpen}
          allowResubmissions={allowResubmissions}
          onToggleSubmissionsOpen={toggleSubmissionsOpen}
          onToggleResubmissions={toggleAllowResubmissions}
          maxTeamSize={settings?.max_team_size ?? 5}
          maxFileSizeMb={settings?.max_file_size ?? 10}
          deadline={settings?.deadline}
          onSaveConfig={(ts, fs) => patchSettings({ max_team_size: ts, max_file_size: fs })}
          onDeadlineSave={(iso) => void patchSettings({ deadline: iso })}
        />

        <JudgingCriteriaPanel
          criteria={criteria}
          onSave={(values) => patchSettings(values)}
        />

        <TracksPanel
          activeTracks={activeTracks}
          onToggleTrack={handleToggleTrack}
          onDeleteTrack={handleDeleteTrack}
        />

        <AdminSessionPanel
          username={sessionUser}
          duration={formatDuration(durationNow - sessionStart)}
          onLogout={handleLogout}
        />

        <JudgeAccountsPanel
          judges={judges}
          onCreate={handleCreateJudge}
          onUpdate={handleUpdateJudge}
          onDelete={handleDeleteJudge}
        />
      </div>
    </>
  );
}
