"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./jobDetail.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobUserInfo {
  user_id: string;
  username: string;
  email: string;
  tier: string;
}

interface JobCollectionInfo {
  collection_id: number;
  name: string;
  language: string | null;
  status: string;
}

interface JobDocumentInfo {
  document_id: number;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  version_count: number;
  ocr_version: string | null;
  created_at: string;
}

interface JobReviewTaskInfo {
  task_id: number;
  document_id: number | null;
  review_status: string;
  user_reason: string;
  annotator_reason: string | null;
  admin_name: string | null;
  admin_id?: number | null;
  annotator_name: string | null;
  annotator_id?: number | null;
  review_created_at: string;
  review_updated_at: string;
}

interface JobDetailResponse {
  job_id: number;
  status: "Queued" | "Processing" | "Failed" | "Partial" | "Completed";
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  user: JobUserInfo;
  collection: JobCollectionInfo;
  documents: JobDocumentInfo[];
  review_task: JobReviewTaskInfo | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { cls: string; icon: string }> = {
  Queued:     { cls: "statusQueued",     icon: "bi-clock"              },
  Processing: { cls: "statusProcessing", icon: "bi-arrow-repeat"       },
  Failed:     { cls: "statusFailed",     icon: "bi-x-circle-fill"      },
  Partial:    { cls: "statusPartial",    icon: "bi-exclamation-circle"  },
  Completed:  { cls: "statusCompleted",  icon: "bi-check-circle-fill"  },
};

const REVIEW_STATUS_STYLES: Record<string, { cls: string; icon: string }> = {
  Pending:   { cls: "statusQueued",     icon: "bi-clock"             },
  Assigned:  { cls: "statusProcessing", icon: "bi-person-check"      },
  InReview:  { cls: "statusProcessing", icon: "bi-arrow-repeat"      },
  Completed: { cls: "statusCompleted",  icon: "bi-check-circle-fill" },
  Rejected:  { cls: "statusFailed",     icon: "bi-x-circle-fill"     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

function diffMinutes(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (diff < 1)   return "< 1 min";
  if (diff === 1) return "1 min";
  return `${diff} mins`;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024)            return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, map }: { status: string; map: typeof STATUS_STYLES }) {
  const s = map[status] ?? { cls: "statusQueued", icon: "bi-circle" };
  return (
    <span className={`${styles.statusBadge} ${styles[s.cls]}`}>
      <i className={`bi ${s.icon} ${status === "Processing" || status === "InReview" ? styles.spinIcon : ""}`} />
      {status}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router    = useRouter();

  const [job, setJob]         = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchJob = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/jobs/${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setJob(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch job.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJob(); }, [jobId]);

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.stateWrap}>
        <span className={styles.spinner} />
        <p>Loading job details...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className={styles.page}>
      <div className={styles.stateWrap}>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.retryBtn} onClick={fetchJob}>Retry</button>
      </div>
    </div>
  );

  if (!job) return null;

  const diff = diffMinutes(job.started_at, job.completed_at);
  const pct = job.total_tasks > 0 ? Math.round((job.completed_tasks / job.total_tasks) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* ── Top Bar ───────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            <i className="bi bi-arrow-left" />
          </button>
          <h2 className={styles.title}>Job Details</h2>
          <span className={styles.idBadge}>#{job.job_id}</span>
          <StatusBadge status={job.status} map={STATUS_STYLES} />
        </div>
        <span className={styles.metaText}>Created {fmt(job.created_at)}</span>
      </div>

      <div className={styles.body}>

        {/* ── Top Cards ─────────────────────────────────────────────── */}
        <div className={styles.topCards}>

          {/* User */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <i className="bi bi-person-fill" />
              User
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Name</span>
                <span
                  className={styles.infoValue}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => handleNavigation(e, `/dashboard/users/${job.user.user_id}`)}
                >
                  {job.user.username}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{job.user.email}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Tier</span>
                <span className={`${styles.tierBadge} ${styles[`tier${job.user.tier}`]}`}>
                  {job.user.tier}
                </span>
              </div>
            </div>
          </div>

          {/* Collection */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <i className="bi bi-collection-fill" />
              Collection
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Name</span>
                <span
                  className={styles.infoValue}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => handleNavigation(e, `/dashboard/collections/${job.collection.collection_id}`)}
                >
                  {job.collection.name}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Language</span>
                <span className={styles.infoValue}>{job.collection.language ?? "—"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Status</span>
                <StatusBadge status={job.collection.status} map={STATUS_STYLES} />
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <i className="bi bi-bar-chart-fill" />
              Progress
            </div>
            <div className={styles.cardBody}>
              <div className={styles.progressWrap}>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${styles[`progress_${job.status}`]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={styles.progressLabel}>
                  {job.completed_tasks}/{job.total_tasks}
                  {job.failed_tasks > 0 && <span className={styles.failedLabel}> · {job.failed_tasks} failed</span>}
                </span>
              </div>
              <div className={styles.statsRow}>
                <div className={styles.statBox}>
                  <span className={styles.statNum}>{job.total_tasks}</span>
                  <span className={styles.statLbl}>Total</span>
                </div>
                <div className={styles.statBox}>
                  <span className={`${styles.statNum} ${styles.statGreen}`}>{job.completed_tasks}</span>
                  <span className={styles.statLbl}>Completed</span>
                </div>
                <div className={styles.statBox}>
                  <span className={`${styles.statNum} ${styles.statRed}`}>{job.failed_tasks}</span>
                  <span className={styles.statLbl}>Failed</span>
                </div>
              </div>

              {/* Timeline Inline Deployment */}
              <div className={styles.timeline}>
                <div className={styles.timelineNode}>
                  <div className={`${styles.timelineDot} ${styles.timelineDotStart}`} />
                  <div className={styles.timelineNodeContent}>
                    <span className={styles.timelineLabel}>Started</span>
                    <span className={styles.timelineValue}>{fmt(job.started_at)}</span>
                  </div>
                </div>
                <div className={styles.timelineMiddle}>
                  <div className={styles.timelineLine} />
                  <div className={styles.timelineDuration}>
                    <i className="bi bi-stopwatch" />
                    {diff}
                  </div>
                  <div className={styles.timelineLine} />
                </div>
                <div className={styles.timelineNode}>
                  <div className={`${styles.timelineDot} ${styles.timelineDotEnd}`} />
                  <div className={styles.timelineNodeContent}>
                    <span className={styles.timelineLabel}>Completed</span>
                    <span className={styles.timelineValue}>{fmt(job.completed_at)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ── Review Task ───────────────────────────────────────────── */}
        {job.review_task && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <i className="bi bi-clipboard2-check-fill" />
              Review Task
              <span className={styles.cardHeaderBadge}>#{job.review_task.task_id}</span>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Status</span>
                <StatusBadge status={job.review_task.review_status} map={REVIEW_STATUS_STYLES} />
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Target Doc</span>
                <span className={styles.infoValue}>
                  {job.review_task.document_id ? `#${job.review_task.document_id}` : "—"}
                </span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Admin</span>
                <span
                  className={styles.infoValue}
                  style={job.review_task.admin_id ? { cursor: "pointer" } : undefined}
                  onClick={(e) => job.review_task?.admin_id && handleNavigation(e, `/dashboard/admins/${job.review_task.admin_id}`)}
                >
                  {job.review_task.admin_name ?? "—"}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Annotator</span>
                <span
                  className={styles.infoValue}
                  style={job.review_task.annotator_id ? { cursor: "pointer" } : undefined}
                  onClick={(e) => job.review_task?.annotator_id && handleNavigation(e, `/dashboard/annotators/${job.review_task.annotator_id}`)}
                >
                  {job.review_task.annotator_name ?? "—"}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Created</span>
                <span className={styles.infoValue}>{fmt(job.review_task.review_created_at)}</span>
              </div>
              <div className={`${styles.infoRow} ${styles.fullWidth}`}>
                <span className={styles.infoLabel}>User Reason</span>
                <span className={styles.reasonText}>{job.review_task.user_reason}</span>
              </div>
              {job.review_task.annotator_reason && (
                <div className={`${styles.infoRow} ${styles.fullWidth}`}>
                  <span className={styles.infoLabel}>Annotator Note</span>
                  <span className={styles.reasonText}>{job.review_task.annotator_reason}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Documents Table ───────────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <i className="bi bi-file-earmark-fill" />
            Documents
            <span className={styles.cardHeaderBadge}>{job.documents.length}</span>
          </div>
          {job.documents.length === 0 ? (
            <p className={styles.emptyText}>No documents found for this job.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Versions</th>
                    <th>OCR Version</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {job.documents.map((doc) => {
                    const isTargetOfReview = job.review_task?.document_id === doc.document_id;

                    return (
                      <tr key={doc.document_id} style={isTargetOfReview ? { backgroundColor: "rgba(255, 193, 7, 0.08)" } : undefined}>
                        <td className={styles.idCell}>
                          #{doc.document_id}
                          {isTargetOfReview && (
                            <span style={{ fontSize: "0.7rem", backgroundColor: "#ffc107", color: "#000", padding: "1px 4px", borderRadius: "3px", marginLeft: "5px", fontWeight: "bold" }}>
                              Under Review
                            </span>
                          )}
                        </td>
                        <td className={styles.fileNameCell}>{doc.file_name}</td>
                        <td className={styles.typeCell}>{doc.file_type ?? "—"}</td>
                        <td>{fmtSize(doc.file_size)}</td>
                        <td><StatusBadge status={doc.status} map={STATUS_STYLES} /></td>
                        <td className={styles.centerCell}>{doc.version_count}</td>
                        <td className={styles.monoCell}>{doc.ocr_version ?? "—"}</td>
                        <td className={styles.dateCell}>{fmt(doc.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}