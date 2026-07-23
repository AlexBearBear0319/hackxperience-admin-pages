"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomSelect from "../components/CustomSelect";
import { AdminShellConfig, type AdminMetric } from "../components/AdminShell";
import SubmissionViewOverlay, { type EditDraft } from "../components/SubmissionViewOverlay";
import type { AdminSubmission, SubmissionScore, SubmissionStatus } from "@/lib/types";
import { deleteAdminSubmission, fetchAdminSubmissions, updateAdminSubmission } from "@/lib/client/admin-api";
import styles from "./Submissions.module.css";

export type SubmissionFilter = "all" | "pending" | "approved" | "rejected";

const ITEMS_PER_PAGE = 10;

const HEADER_MAP: Record<SubmissionFilter, { title: string; subtitle: string }> = {
  all: { title: "ALL_SUBMISSIONS", subtitle: "// MONITOR ALL HACKATHON SUBMISSIONS" },
  pending: { title: "PENDING_REVIEW", subtitle: "// AWAITING ADMIN REVIEW" },
  approved: { title: "APPROVED_SUBMISSIONS", subtitle: "// CLEARED FOR SCORING AND SHOWCASE" },
  rejected: { title: "REJECTED_SUBMISSIONS", subtitle: "// RETURNED TO TEAMS" },
};

const EMPTY_MAP: Record<SubmissionFilter, string> = {
  all: "[ NO SUBMISSIONS FOUND ]",
  pending: "[ NO PENDING SUBMISSIONS ]",
  approved: "[ NO APPROVED SUBMISSIONS ]",
  rejected: "[ NO REJECTED SUBMISSIONS ]",
};

function buildMetrics(all: AdminSubmission[]): AdminMetric[] {
  const pending = all.filter((s) => s.status === "pending").length;
  const approved = all.filter((s) => s.status === "approved").length;
  const rejected = all.filter((s) => s.status === "rejected").length;

  return [
    { key: "total", label: "TOTAL_SUBMISSIONS", value: String(all.length), helper: "received", tone: "neutral" },
    { key: "pending", label: "PENDING", value: String(pending), helper: "awaiting review", tone: "amber" },
    { key: "approved", label: "APPROVED", value: String(approved), helper: "cleared for showcase", tone: "emerald" },
    { key: "rejected", label: "REJECTED", value: String(rejected), helper: "returned to team", tone: "red" },
    { key: "deadline", label: "DEADLINE_COUNTDOWN", value: "00.00.00", suffix: "s", helper: "until close", tone: "neutral" },
  ];
}

function Thumbnail({ url, alt }: { url?: string | null; alt?: string }) {
  if (url) {
    return (
      <span className={styles.thumbnail}>
        <img
          src={url}
          alt={alt ?? "Project thumbnail"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </span>
    );
  }
  return (
    <span className={styles.thumbnail} aria-hidden="true">
      <span className={styles.thumbnailLineA} />
      <span className={styles.thumbnailLineB} />
    </span>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const cls =
    status === "approved"
      ? styles.badgeApproved
      : status === "pending"
        ? styles.badgePending
        : styles.badgeRejected;
  return <span className={cls}>{status.toUpperCase()}</span>;
}

function ActionCell({
  submission,
  onDeleteClick,
  onViewClick,
  onApproveClick,
  onRejectClick,
}: {
  submission: AdminSubmission;
  onDeleteClick: (s: AdminSubmission) => void;
  onViewClick: (s: AdminSubmission) => void;
  onApproveClick: (id: string) => void;
  onRejectClick: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!isOpen) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 2, right: window.innerWidth - rect.right });
    }
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      const outsideMenu = !menuRef.current || !menuRef.current.contains(target);
      const outsideTrigger = !triggerRef.current || !triggerRef.current.contains(target);
      if (outsideMenu && outsideTrigger) setIsOpen(false);
    }
    function onScroll() { setIsOpen(false); }
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [isOpen]);

  function doAction(fn: () => void) {
    setIsOpen(false);
    fn();
  }

  const canApprove = submission.status === "pending";
  const canReject = submission.status === "pending" || submission.status === "approved";

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.viewAction} onClick={() => onViewClick(submission)}>
        VIEW
      </button>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.viewAction} ${styles.kebabTrigger}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        [ ⋮ ]
      </button>
      {isOpen && createPortal(
        <ul
          ref={menuRef}
          className={`${styles.kebabMenu} font-mono text-[#1d1c17]`}
          style={{
            top: menuPos.top,
            right: menuPos.right,
            ["--font-admin-mono" as any]: "var(--font-geist-mono)",
          }}
          role="menu"
        >
          {canApprove && (
            <li role="none">
              <button
                type="button"
                className={`${styles.kebabItem} font-mono`}
                role="menuitem"
                onClick={() => doAction(() => onApproveClick(submission.id))}
              >
                [&#x2713;]&nbsp;APPROVE
              </button>
            </li>
          )}
          {canReject && (
            <li role="none">
              <button
                type="button"
                className={`${styles.kebabItem} font-mono`}
                role="menuitem"
                onClick={() => doAction(() => onRejectClick(submission.id))}
              >
                [&#x2717;]&nbsp;REJECT
              </button>
            </li>
          )}
          <li role="none">
            <button
              type="button"
              className={`${styles.kebabItem} ${styles.kebabItemDanger} font-mono`}
              role="menuitem"
              onClick={() => doAction(() => onDeleteClick(submission))}
            >
              [&#x232B;]&nbsp;DELETE
            </button>
          </li>
        </ul>,
        document.body,
      )}
    </div>
  );
}

function BulkDeleteModal({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalAccent} />
        <p className={styles.modalTitle}>[⌫] DELETE_SELECTED</p>
        <p className={styles.modalWarning}>{`>> [ WARNING ] THIS ACTION CANNOT BE UNDONE`}</p>
        <p className={styles.modalBody}>
          {`>> ARE YOU SURE YOU WANT TO PERMANENTLY DELETE `}
          <strong>{count}</strong>
          {` PROJECT${count !== 1 ? "S" : ""}?`}
        </p>
        <div className={styles.modalButtons}>
          <button type="button" className={styles.modalYes} onClick={onConfirm}>
            [ CONFIRM_DELETE ]
          </button>
          <button type="button" className={styles.modalNo} onClick={onCancel}>
            [ CANCEL ]
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeleteModal({
  submission,
  onConfirm,
  onCancel,
}: {
  submission: AdminSubmission;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalAccent} />
        <p className={styles.modalTitle}>DELETE_PROJECT</p>
        <p className={styles.modalWarning}>{"// THIS ACTION CANNOT BE UNDONE"}</p>
        <p className={styles.modalBody}>
          Are you sure you want to delete &quot;{submission.projectName}&quot; by {submission.teamName}?
        </p>
        <div className={styles.modalButtons}>
          <button type="button" className={styles.modalYes} onClick={onConfirm}>
            YES
          </button>
          <button type="button" className={styles.modalNo} onClick={onCancel}>
            NO
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

type ScoreTarget = { projectName: string; scores: SubmissionScore[] };

function ScoreModal({ target, onClose }: { target: ScoreTarget; onClose: () => void }) {
  function avg(vals: (number | null | undefined)[]): number | null {
    const valid = vals.filter((v): v is number => typeof v === "number");
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  }

  const scored = target.scores.filter((s) => s.score !== null);
  const hasScores = scored.length > 0;
  const commentsWithJudge = target.scores.filter((s) => s.comments?.trim());
  const overallAvg = avg(scored.map((s) => s.score));
  const techAvg    = avg(scored.map((s) => s.technicalExecution));
  const probAvg    = avg(scored.map((s) => s.problemSolutionFit));
  const innoAvg    = avg(scored.map((s) => s.innovationCreativity));
  const presAvg    = avg(scored.map((s) => s.presentationQuality));
  const entrAvg   = avg(scored.map((s) => s.entrepreneurship));

  const criteria = [
    { label: "TECH_EXECUTION",    value: techAvg },
    { label: "PROB_SOLUTION_FIT", value: probAvg },
    { label: "INNOVATION",        value: innoAvg },
    { label: "PRESENTATION",      value: presAvg },
    { label: "ENTREPRENEURSHIP",  value: entrAvg },
  ];

  return (
    <div className={styles.scoreOverlay} onClick={onClose}>
      <div className={styles.scoreModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.scoreModalHeader}>
          <span className={styles.scoreModalHeaderLabel}>&gt; PROJECT_SCORECARD</span>
          <button type="button" className={styles.scoreModalClose} onClick={onClose}>[ X ]</button>
        </div>
        <div className={styles.scoreModalBody}>
          <h2 className={styles.scoreProjectTitle}>{target.projectName}</h2>
          {!hasScores ? (
            <p className={styles.scoreNoData}>[ NO_SCORES_FOUND ]</p>
          ) : (
            <>
              <div className={styles.scoreOverallBlock}>
                <div className={styles.scoreOverallNumber}>{overallAvg?.toFixed(2) ?? "--"}</div>
                <div className={styles.scoreOverallSub}>OVERALL_AVERAGE_SCORE</div>
                <div className={styles.scoreJudgeCount}>// {scored.length} JUDGE{scored.length === 1 ? "" : "S"}_SCORED</div>
              </div>
              <div className={styles.scoreDivider} />
              <div className={styles.scoreCriteriaSection}>
                {criteria.map(({ label, value }) => (
                  <div className={styles.scoreCriteriaRow} key={label}>
                    <span className={styles.scoreCriteriaLabel}>&gt; {label}</span>
                    <span className={styles.scoreCriteriaDots} aria-hidden="true" />
                    <span className={styles.scoreCriteriaValue}>{value?.toFixed(2) ?? "--"}</span>
                  </div>
                ))}
              </div>

              <div className={styles.scoreCommentsDivider} />
              <p className={styles.scoreCommentsHeader}>&gt; JUDGE_COMMENTS</p>
              {commentsWithJudge.length === 0 ? (
                <span className={styles.scoreCommentsEmpty}>[ NO FEEDBACK PROVIDED ]</span>
              ) : (
                <div className={styles.scoreCommentsList}>
                  {commentsWithJudge.map((s) => (
                    <div key={s.judgeId} className={styles.scoreCommentItem}>
                      <p className={styles.scoreCommentJudge}>{`// ${s.judgeId}`}</p>
                      <p className={styles.scoreCommentText}>{s.comments}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SubmissionsClient({ filter }: { filter: SubmissionFilter }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">(
    filter === "all" ? "all" : filter,
  );
  const [pendingDelete, setPendingDelete] = useState<AdminSubmission | null>(null);
  const [scoreTarget, setScoreTarget] = useState<ScoreTarget | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [data, setData] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const viewingSubmission = useMemo(
    () => data.find((s) => s.id === viewingId) ?? null,
    [data, viewingId],
  );

  const shellMetrics = useMemo(() => buildMetrics(data), [data]);
  const trackOptions = useMemo(() => Array.from(new Set(data.map((submission) => submission.track))), [data]);
  const { title, subtitle } = HEADER_MAP[filter];

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAdminSubmissions();
      setData(payload.submissions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const visible = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const effectiveStatus = filter === "all" ? statusFilter : filter;

    return data.filter((s) => {
      const matchStatus = effectiveStatus === "all" || s.status === effectiveStatus;
      const matchTrack = trackFilter === "all" || s.track === trackFilter;
      const matchSearch =
        q.length === 0 ||
        [s.projectName, s.teamName, s.track].join(" ").toLowerCase().includes(q);
      return matchStatus && matchTrack && matchSearch;
    });
  }, [data, filter, statusFilter, trackFilter, searchTerm]);

  // Reset to page 1 whenever the filtered set changes.
  useEffect(() => { setCurrentPage(1); }, [searchTerm, trackFilter, statusFilter, filter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const pagedVisible = visible.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const allPageSelected =
    pagedVisible.length > 0 && pagedVisible.every((s) => selectedIds.has(s.id));
  const somePageSelected =
    !allPageSelected && pagedVisible.some((s) => selectedIds.has(s.id));

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    try {
      await deleteAdminSubmission(pendingDelete.id);
      setData((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete submission.");
    }
  }

  async function handleApprove(id: string) {
    try {
      await updateAdminSubmission(id, { status: "approved" });
      setData((prev) => prev.map((s) => (s.id === id ? { ...s, status: "approved" as const } : s)));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve submission.");
    }
  }

  async function handleReject(id: string) {
    try {
      await updateAdminSubmission(id, { status: "rejected" });
      setData((prev) => prev.map((s) => (s.id === id ? { ...s, status: "rejected" as const } : s)));
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Unable to reject submission.");
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = pagedVisible.map((s) => s.id);
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteAdminSubmission(id)));
      const deleted = ids.filter((_, i) => results[i].status === "fulfilled");
      setData((prev) => prev.filter((s) => !deleted.includes(s.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) setError(`${failed} item(s) could not be deleted.`);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleSave(id: string, draft: EditDraft) {
    try {
      await updateAdminSubmission(id, {
        projectName: draft.projectName,
        track: draft.track,
        status: draft.status,
        githubUrl: draft.githubUrl,
        liveUrl: draft.liveUrl,
        pitchDeckUrl: draft.pitchDeckUrl,
        videoDemoUrl: draft.videoDemoUrl,
        description: draft.description,
        shortPitch: draft.shortPitch,
      });
      setData((prev) => prev.map((s) => s.id !== id ? s : {
        ...s,
        projectName:  draft.projectName,
        track:        draft.track,
        status:       draft.status,
        githubUrl:    draft.githubUrl    || undefined,
        liveUrl:      draft.liveUrl      || null,
        pitchDeckUrl: draft.pitchDeckUrl || undefined,
        videoDemoUrl: draft.videoDemoUrl || null,
        description:  draft.description  || undefined,
        shortPitch:   draft.shortPitch   || undefined,
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save submission.");
    }
  }

  return (
    <>
      <AdminShellConfig value={{ metrics: shellMetrics }} />

      <header className={styles.sectionHeader}>
        <h2>&gt; {title}</h2>
        <p>{error ? `// ${error.toUpperCase()}` : (loading ? "// LOADING LIVE SUBMISSIONS" : subtitle)}</p>
      </header>

      <section className={styles.controls}>
        <label className={styles.searchField}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search project, team or track..."
            aria-label="Search submissions"
          />
        </label>

        <CustomSelect
          className={styles.selectField}
          variant="controls"
          value={trackFilter}
          onChange={setTrackFilter}
          options={[
            { value: "all", label: "ALL TRACKS" },
            ...trackOptions.map((t) => ({ value: t, label: t.toUpperCase() })),
          ]}
          aria-label="Track filter"
        />

        <CustomSelect
          className={styles.selectField}
          variant="controls"
          value={filter === "all" ? statusFilter : filter}
          onChange={filter === "all"
            ? (v) => setStatusFilter(v as SubmissionStatus | "all")
            : () => {}}
          options={filter === "all" ? [
            { value: "all", label: "ALL STATUSES" },
            { value: "pending", label: "PENDING" },
            { value: "approved", label: "APPROVED" },
            { value: "rejected", label: "REJECTED" },
          ] : [{ value: filter, label: filter.toUpperCase() }]}
          disabled={filter !== "all"}
          aria-label="Status filter"
        />
      </section>

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <button
            type="button"
            className={styles.bulkDeleteBtn}
            onClick={() => setBulkConfirmOpen(true)}
            disabled={bulkDeleting}
          >
            {bulkDeleting
              ? "// DELETING..."
              : `[⌫] DELETE SELECTED (${selectedIds.size})`}
          </button>
          <span className={styles.bulkCount}>
            {selectedIds.size} ROW{selectedIds.size !== 1 ? "S" : ""} SELECTED
          </span>
        </div>
      )}

      <section className={styles.tablePanel}>
        <div className={styles.tableGrid}>
          <div className={`${styles.tableHead} ${styles.checkCell}`}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = somePageSelected;
              }}
              onChange={toggleSelectAll}
              aria-label="Select all on page"
              disabled={pagedVisible.length === 0}
            />
          </div>
          <div className={styles.tableHead}>THUMBNAIL</div>
          <div className={styles.tableHead}>PROJECT</div>
          <div className={styles.tableHead}>TEAM</div>
          <div className={styles.tableHead}>TRACK</div>
          <div className={styles.tableHead}>STATUS</div>
          <div className={styles.tableHead}>SUBMITTED</div>
          <div className={styles.tableHead}>SCORE</div>
          <div className={styles.tableHead}>ACTIONS</div>

          {visible.length === 0 ? (
            <div className={styles.emptyRow}>{EMPTY_MAP[filter]}</div>
          ) : (
            pagedVisible.map((s) => (
              <div className={styles.tableRow} key={s.id}>
                <div className={`${styles.tableCell} ${styles.checkCell}`}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleRow(s.id)}
                    aria-label={`Select ${s.projectName}`}
                  />
                </div>
                <div className={styles.tableCell} data-label="THUMBNAIL">
                  <Thumbnail url={s.thumbnailUrl} alt={`${s.projectName} thumbnail`} />
                </div>
                <div className={styles.tableCell} data-label="PROJECT">{s.projectName}</div>
                <div className={styles.tableCell} data-label="TEAM">{s.teamName}</div>
                <div className={styles.tableCell} data-label="TRACK">{s.track}</div>
                <div className={styles.tableCell} data-label="STATUS">
                  <StatusBadge status={s.status} />
                </div>
                <div className={styles.tableCell} data-label="SUBMITTED">{s.submittedAt}</div>
                <div className={styles.tableCell} data-label="SCORE">
                  <button
                    type="button"
                    className={styles.viewAction}
                    onClick={() => setScoreTarget({ projectName: s.projectName, scores: s.scores ?? [] })}
                  >
                    VIEW
                  </button>
                </div>
                <div className={styles.tableCell} data-label="ACTIONS">
                  <ActionCell
                    submission={s}
                    onDeleteClick={setPendingDelete}
                    onViewClick={(sub) => setViewingId(sub.id)}
                    onApproveClick={handleApprove}
                    onRejectClick={handleReject}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              {`// ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, visible.length)} OF ${visible.length}`}
            </span>
            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {"< BACK"}
              </button>
              <span className={styles.paginationPage}>
                {`PAGE ${currentPage} OF ${totalPages}`}
              </span>
              <button
                type="button"
                className={styles.paginationBtn}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {"NEXT >"}
              </button>
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {bulkConfirmOpen && (
          <BulkDeleteModal
            count={selectedIds.size}
            onConfirm={() => {
              setBulkConfirmOpen(false);
              void handleBulkDelete();
            }}
            onCancel={() => setBulkConfirmOpen(false)}
          />
        )}
        {pendingDelete && (
          <DeleteModal
            submission={pendingDelete}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
      {scoreTarget && (
        <ScoreModal
          target={scoreTarget}
          onClose={() => setScoreTarget(null)}
        />
      )}

      <SubmissionViewOverlay
        submission={viewingSubmission}
        onClose={() => setViewingId(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={(id) => {
          setViewingId(null);
          setPendingDelete(data.find((s) => s.id === id) ?? null);
        }}
        onSave={handleSave}
      />
    </>
  );
}
