"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./taskDetail.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserBrief {
  user_id: string;
  name: string;
  email: string;
  tier: string;
}

interface DocumentBrief {
  document_id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  ocr_url: string | null;
  ocr_version: string | null;
  status: string;
  version_count: number;
}

interface CollectionBrief {
  collection_id: number;
  title: string;
  language: string | null;
}

interface JobBrief {
  job_id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

interface AdminBrief {
  admin_id: number;
  name: string;
  email: string;
}

interface AnnotatorBrief {
  annotator_id: number;
  name: string;
  email: string;
}

interface TaskDetail {
  task_id: number;
  status: string;
  user_reason: string;
  annotator_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  requested_by: UserBrief;
  document: DocumentBrief;
  collection: CollectionBrief;
  job: JobBrief | null;
  admin: AdminBrief | null;
  annotator: AnnotatorBrief | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { cls: string; icon: string }> = {
  Pending:   { cls: "statusPending",   icon: "bi-hourglass-split"   },
  Assigned:  { cls: "statusAssigned",  icon: "bi-person-check"      },
  InReview:  { cls: "statusInReview",  icon: "bi-eye"               },
  Completed: { cls: "statusCompleted", icon: "bi-check-circle-fill" },
  Rejected:  { cls: "statusRejected",  icon: "bi-x-circle-fill"     },
};

const DOC_STATUS_META: Record<string, { cls: string }> = {
  Queued:     { cls: "statusPending"   },
  Processing: { cls: "statusAssigned"  },
  Completed:  { cls: "statusCompleted" },
  Failed:     { cls: "statusRejected"  },
};

const JOB_STATUS_META: Record<string, { cls: string }> = {
  Queued:     { cls: "statusPending"   },
  Processing: { cls: "statusInReview"  },
  Completed:  { cls: "statusCompleted" },
  Partial:    { cls: "statusAssigned"  },
  Failed:     { cls: "statusRejected"  },
};

const TIER_META: Record<string, { cls: string }> = {
  Basic:   { cls: "tierBasic"   },
  Pro:     { cls: "tierPro"     },
  Premium: { cls: "tierPremium" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeDiff(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();

  const [task, setTask]       = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_URL}/admin/tasks/${taskId}`, { credentials: "include" });
        if (res.status === 404) throw new Error("Task not found.");
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        setTask(await res.json());
      } catch (err: any) {
        setError(err.message ?? "Failed to load task.");
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateWrap}>
          <span className={styles.spinner} />
          <p>Loading task details…</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className={styles.page}>
        <div className={styles.stateWrap}>
          <i className="bi bi-exclamation-circle" style={{ fontSize: "2rem", color: "#c0392b" }} />
          <p className={styles.errorText}>{error ?? "Something went wrong."}</p>
          <button className={styles.backBtn} onClick={() => router.back()}>
            <i className="bi bi-arrow-left" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const sm = STATUS_META[task.status] ?? { cls: "statusPending", icon: "bi-circle" };
  const dm = DOC_STATUS_META[task.document.status] ?? { cls: "statusPending" };
  const jm = task.job ? (JOB_STATUS_META[task.job.status] ?? { cls: "statusPending" }) : null;
  const tm = TIER_META[task.requested_by.tier] ?? { cls: "tierBasic" };

  const jobProgress = task.job
    ? Math.round((task.job.completed_tasks / Math.max(task.job.total_tasks, 1)) * 100)
    : 0;

  const duration     = timeDiff(task.started_at, task.completed_at);
  const startedFmt   = fmt(task.started_at);
  const completedFmt = fmt(task.completed_at);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <i className="bi bi-arrow-left" /> Tasks
        </button>
        <div className={styles.headerMeta}>
          <h1 className={styles.title}>
            Task <span className={styles.titleId}>#{task.task_id}</span>
          </h1>
          <span className={`${styles.statusBadge} ${styles[sm.cls]}`}>
            <i className={`bi ${sm.icon}`} />
            {task.status === "InReview" ? "In Review" : task.status}
          </span>
        </div>
        <div className={styles.headerDates}>
          <span><i className="bi bi-calendar-plus" /> Created {fmt(task.created_at) ?? "—"}</span>
          <span><i className="bi bi-pencil-square" /> Updated {fmt(task.updated_at) ?? "—"}</span>
        </div>
      </div>

      {/* ── Reason banner ───────────────────────────────────────────────── */}
      <div className={styles.reasonBanner}>
        <div className={styles.reasonBlock}>
          <span className={styles.reasonLabel}><i className="bi bi-chat-left-text" /> User Reason</span>
          <p className={styles.reasonText}>{task.user_reason}</p>
        </div>
        {task.annotator_reason && (
          <>
            <div className={styles.reasonDivider} />
            <div className={styles.reasonBlock}>
              <span className={styles.reasonLabel}><i className="bi bi-pencil" /> Annotator Notes</span>
              <p className={styles.reasonText}>{task.annotator_reason}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Section 1: two side-by-side cards ───────────────────────────── */}
      <div className={styles.section1}>

        {/* Box 1 — User Info */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <i className="bi bi-person" />
            <span>User Info</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.personRow}>
              <div className={styles.avatar}>
                {task.requested_by.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.personInfo}>
                <p
                  className={styles.personName}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => handleNavigation(e, `/dashboard/users/${task.requested_by.user_id}`)}
                >
                  {task.requested_by.name}
                </p>
                <p className={styles.personSub}>{task.requested_by.email}</p>
              </div>
              <span className={`${styles.tierBadge} ${styles[tm.cls]}`}>
                {task.requested_by.tier}
              </span>
            </div>
            <div className={styles.kvList}>
              <div className={styles.kv}>
                <span className={styles.kvKey}>User ID</span>
                <span className={`${styles.kvVal} ${styles.mono}`}>{task.requested_by.user_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2 — Document Info */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <i className="bi bi-file-earmark-text" />
            <span>Document Info</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.docNameRow}>
              <i className={`bi bi-filetype-${task.document.file_type ?? "blank"}`} />
              <a href={task.document.file_path} target="_blank" rel="noreferrer" className={styles.docName} style={{ textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{task.document.file_name}</a>
              <span className={`${styles.statusPill} ${styles[dm.cls]}`}>
                {task.document.status}
              </span>
            </div>
            <div className={styles.kvList}>
              <div className={styles.kv}>
                <span className={styles.kvKey}>Type</span>
                <span className={styles.kvVal}>{task.document.file_type?.toUpperCase() ?? "—"}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>Size</span>
                <span className={styles.kvVal}>{fmtSize(task.document.file_size)}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>Versions</span>
                <span className={styles.kvVal}>{task.document.version_count}</span>
              </div>
              {task.document.ocr_url && (
                <div className={styles.kv}>
                  <span className={styles.kvKey}>OCR Output</span>
                  <a
                    href={task.document.ocr_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.linkBtn}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <i className="bi bi-box-arrow-up-right" /> View
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Section 2: full-width workflow card ─────────────────────────── */}
      <div className={styles.section2}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <i className="bi bi-diagram-3" />
            <span>Workflow Details</span>
          </div>
          <div className={styles.workflowBody}>

            {/* Row 1: Collection + Job */}
            <div className={styles.workflowRow}>

              {/* Collection */}
              <div className={styles.workflowBlock}>
                <p className={styles.workflowBlockTitle}>
                  <i className="bi bi-collection" /> Collection
                </p>
                <p
                  className={styles.collectionName}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => handleNavigation(e, `/dashboard/collections/${task.collection.collection_id}`)}
                >
                  {task.collection.title}
                </p>
                <div className={styles.kvList}>
                  <div className={styles.kv}>
                    <span className={styles.kvKey}>Collection ID</span>
                    <span className={`${styles.kvVal} ${styles.mono}`}>#{task.collection.collection_id}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.kvKey}>Language</span>
                    <span className={styles.kvVal}>{task.collection.language ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className={styles.workflowVDivider} />

              {/* Job */}
              <div className={styles.workflowBlock}>
                <p className={styles.workflowBlockTitle}>
                  <i className="bi bi-cpu" /> Job
                </p>
                {task.job ? (
                  <>
                    <div className={styles.kvList}>
                      <div className={styles.kv}>
                        <span className={styles.kvKey}>Job ID</span>
                        <span className={`${styles.kvVal} ${styles.mono}`}>#{task.job.job_id}</span>
                      </div>
                      <div className={styles.kv}>
                        <span className={styles.kvKey}>Status</span>
                        <span className={`${styles.statusPill} ${styles[jm!.cls]}`}>{task.job.status}</span>
                      </div>
                      <div className={styles.kv}>
                        <span className={styles.kvKey}>Tasks</span>
                        <span className={styles.kvVal}>
                          {task.job.completed_tasks}/{task.job.total_tasks}
                          {task.job.failed_tasks > 0 && (
                            <span className={styles.failedBadge}> · {task.job.failed_tasks} failed</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${jobProgress}%` }} />
                      </div>
                      <span className={styles.progressLabel}>{jobProgress}%</span>
                    </div>
                  </>
                ) : (
                  <p className={styles.nullState}><i className="bi bi-dash-circle" /> Not linked</p>
                )}
              </div>

            </div>

            <div className={styles.workflowHDivider} />

            {/* Row 2: Admin + Annotator */}
            <div className={styles.workflowRow}>

              {/* Admin */}
              <div className={styles.workflowBlock}>
                <p className={styles.workflowBlockTitle}>
                  <i className="bi bi-shield-check" /> Admin
                </p>
                {task.admin ? (
                  <div className={styles.personRow}>
                    <div className={`${styles.avatar} ${styles.avatarAdmin}`}>
                      {task.admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.personInfo}>
                      <p
                        className={styles.personName}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => handleNavigation(e, `/dashboard/admins/${task.admin?.admin_id}`)}
                      >
                        {task.admin.name}
                      </p>
                      <p className={styles.personSub}>{task.admin.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className={styles.nullState}><i className="bi bi-dash-circle" /> Not assigned</p>
                )}
              </div>

              <div className={styles.workflowVDivider} />

              {/* Annotator */}
              <div className={styles.workflowBlock}>
                <p className={styles.workflowBlockTitle}>
                  <i className="bi bi-pencil" /> Annotator
                </p>
                {task.annotator ? (
                  <div className={styles.personRow}>
                    <div className={`${styles.avatar} ${styles.avatarAnnotator}`}>
                      {task.annotator.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.personInfo}>
                      <p
                        className={styles.personName}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => handleNavigation(e, `/dashboard/annotators/${task.annotator?.annotator_id}`)}
                      >
                        {task.annotator.name}
                      </p>
                      <p className={styles.personSub}>{task.annotator.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className={styles.nullState}><i className="bi bi-dash-circle" /> Not assigned</p>
                )}
              </div>

            </div>

            <div className={styles.workflowHDivider} />

            {/* Row 3: Timeline */}
            <div className={styles.timeline}>
              <div className={styles.timelineNode}>
                <div className={`${styles.timelineDot} ${startedFmt ? styles.timelineDotActive : styles.timelineDotInactive}`} />
                <span className={styles.timelineLabel}>Started</span>
                <span className={styles.timelineValue}>{startedFmt ?? "Not yet"}</span>
              </div>

              <div className={styles.timelineTrack}>
                <div className={styles.timelineLine} />
                {duration && (
                  <span className={styles.timelineDuration}>
                    <i className="bi bi-clock" /> {duration}
                  </span>
                )}
              </div>

              <div className={styles.timelineNode}>
                <div className={`${styles.timelineDot} ${completedFmt ? styles.timelineDotDone : styles.timelineDotInactive}`} />
                <span className={styles.timelineLabel}>Completed</span>
                <span className={styles.timelineValue}>{completedFmt ?? "Not yet"}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}