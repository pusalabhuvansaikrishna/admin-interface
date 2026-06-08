"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { BASE_URL } from "@/config/api";
import styles from "./annotatorDetail.module.css";

/* ── Types ────────────────────────────────────────────────────────────────── */
interface DocumentInfo {
  document_id: number;
  file_name: string;
  file_type: string;
  status: string;
}

interface RequestorInfo {
  user_id: number;
  name: string;
  email: string;
  tier: string;
}

interface JobInfo {
  job_id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

interface AdminInfo {
  admin_id: number;
  name: string;
  username: string;
}

interface Task {
  task_id: number;
  status: string;
  user_reason: string | null;
  annotator_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  document: DocumentInfo | null;
  requestor: RequestorInfo | null;
  job: JobInfo | null;
  admin: AdminInfo | null;
}

interface AnnotatorDetail {
  annotator_id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  languages: string[];
  tasks: Task[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending:    { bg: "#fff8e1", color: "#b8860b", border: "#ffe082" },
  assigned:   { bg: "#e3f0ff", color: "#1565c0", border: "#90caf9" },
  in_progress:{ bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
  completed:  { bg: "#d4f5e5", color: "#1a7a4a", border: "#a8e6c8" },
  failed:     { bg: "#fdecea", color: "#c62828", border: "#f5a8a0" },
  cancelled:  { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
};

function statusStyle(s: string) {
  return STATUS_COLORS[s] ?? { bg: "#f0f3fb", color: "#6b7a99", border: "#dde3f0" };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeDiff(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function avatarInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ── Normalize status string ──────────────────────────────────────────────── */
function normalizeStatus(s: string | null | undefined): string {
  return s?.toLowerCase().trim() ?? "";
}

/* ── Task Status Badge ────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Job Progress Bar ─────────────────────────────────────────────────────── */
function JobProgress({ job }: { job: JobInfo }) {
  const pct = job.total_tasks > 0 ? Math.round((job.completed_tasks / job.total_tasks) * 100) : 0;
  return (
    <div className={styles.jobProgress}>
      <div className={styles.jobProgressBar}>
        <div className={styles.jobProgressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.jobProgressLabel}>{pct}% ({job.completed_tasks}/{job.total_tasks})</span>
    </div>
  );
}

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue} style={accent ? { color: accent } : undefined}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function AnnotatorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const annotatorId = params?.annotatorId as string;

  const [data, setData]       = useState<AnnotatorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // task filters
  const [statusFilter, setStatusFilter] = useState("");
  const [taskSearch, setTaskSearch]     = useState("");
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators/${annotatorId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      const raw: AnnotatorDetail = await res.json();

      // ── Normalize all status strings to lowercase + trimmed ──────────────
      // This ensures stat cards and filters work regardless of API casing
      // (e.g. "Completed", "COMPLETED", "completed " all become "completed")
      const normalized: AnnotatorDetail = {
        ...raw,
        tasks: raw.tasks.map((t) => ({
          ...t,
          status: normalizeStatus(t.status),
          document: t.document
            ? { ...t.document, status: normalizeStatus(t.document.status) }
            : null,
          job: t.job
            ? { ...t.job, status: normalizeStatus(t.job.status) }
            : null,
        })),
      };

      setData(normalized);
    } catch (e: any) {
      setError(e.message ?? "Failed to load annotator.");
    } finally {
      setLoading(false);
    }
  }, [annotatorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived stats ── */
  const taskStats = data ? {
    total:       data.tasks.length,
    completed:   data.tasks.filter((t) => t.status === "completed").length,
    in_progress: data.tasks.filter((t) => t.status === "in_progress").length,
    failed:      data.tasks.filter((t) => t.status === "failed").length,
    pending:     data.tasks.filter((t) => t.status === "pending").length,
    assigned:    data.tasks.filter((t) => t.status === "assigned").length,
    cancelled:   data.tasks.filter((t) => t.status === "cancelled").length,
  } : null;

  const filteredTasks = (data?.tasks ?? []).filter((t) => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchSearch = !taskSearch ||
      t.document?.file_name.toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.requestor?.name.toLowerCase().includes(taskSearch.toLowerCase()) ||
      String(t.task_id).includes(taskSearch);
    return matchStatus && matchSearch;
  });

  /* ── Loading / Error ── */
  if (loading) return (
    <div className={styles.centerState}>
      <span className={styles.spinner} />
      <p>Loading annotator…</p>
    </div>
  );

  if (error) return (
    <div className={styles.centerState}>
      <p className={styles.errorText}>{error}</p>
      <button className={styles.retryBtn} onClick={fetchData}>Retry</button>
    </div>
  );

  if (!data) return null;

  return (
    <div className={styles.page}>

      {/* ── Back + Header ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <i className="bi bi-arrow-left" /> Back
        </button>
      </div>

      {/* ── Profile Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.avatar}>{avatarInitials(data.name)}</div>
          <div className={styles.heroInfo}>
            <div className={styles.heroNameRow}>
              <h1 className={styles.heroName}>{data.name}</h1>
              <span className={`${styles.badge} ${data.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                {data.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className={styles.heroUsername}>@{data.username}</p>
            <p className={styles.heroEmail}><i className="bi bi-envelope" /> {data.email}</p>
            <p className={styles.heroJoined}><i className="bi bi-calendar3" /> Joined {fmtDate(data.created_at)}</p>
          </div>
        </div>

        {/* ── Stat cards ── */}
        {taskStats && (
          <div className={styles.statRow}>
            <StatCard label="Total Tasks"   value={taskStats.total} />
            <StatCard label="Completed"     value={taskStats.completed}   accent="#1a7a4a" />
            <StatCard label="In Progress"   value={taskStats.in_progress} accent="#1565c0" />
            <StatCard label="Failed"        value={taskStats.failed}      accent="#c62828" />
            <StatCard label="Languages"     value={data.languages.length} />
          </div>
        )}
      </div>

      {/* ── Two-column body ── */}
      <div className={styles.body}>

        {/* ── Left panel: info ── */}
        <aside className={styles.aside}>

          {/* Languages */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <i className="bi bi-translate" />
              <span>Languages</span>
              <span className={styles.cardBadge}>{data.languages.length}</span>
            </div>
            <div className={styles.langWrap}>
              {data.languages.length === 0
                ? <span className={styles.emptyHint}>No languages assigned.</span>
                : data.languages.map((l) => (
                    <span key={l} className={styles.langTag}>{l}</span>
                  ))}
            </div>
          </div>

          {/* Task Breakdown */}
          {taskStats && taskStats.total > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <i className="bi bi-bar-chart" />
                <span>Task Breakdown</span>
              </div>
              <div className={styles.breakdown}>
                {(
                  [
                    ["completed",   taskStats.completed],
                    ["in_progress", taskStats.in_progress],
                    ["assigned",    taskStats.assigned],
                    ["pending",     taskStats.pending],
                    ["failed",      taskStats.failed],
                    ["cancelled",   taskStats.cancelled],
                  ] as [string, number][]
                )
                  .filter(([, val]) => val > 0)
                  .map(([key, val]) => {
                    const pct = Math.round((val / taskStats.total) * 100);
                    const s = statusStyle(key);
                    return (
                      <div key={key} className={styles.breakdownRow}>
                        <span className={styles.breakdownLabel} style={{ color: s.color }}>
                          {key.replace(/_/g, " ")}
                        </span>
                        <div className={styles.breakdownBar}>
                          <div style={{ width: `${pct}%`, background: s.color, height: "100%", borderRadius: 4 }} />
                        </div>
                        <span className={styles.breakdownVal}>{val}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </aside>

        {/* ── Right panel: tasks ── */}
        <main className={styles.main}>
          <div className={styles.tasksHeader}>
            <h2 className={styles.tasksTitle}>
              Tasks
              <span className={styles.tasksTotalBadge}>{data.tasks.length}</span>
            </h2>
            <div className={styles.taskFilters}>
              <div className={styles.searchWrap}>
                <i className="bi bi-search" />
                <input
                  className={styles.searchInput}
                  placeholder="Search by file, requestor, ID…"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                />
                {taskSearch && (
                  <button className={styles.searchClear} onClick={() => setTaskSearch("")}>
                    <i className="bi bi-x" />
                  </button>
                )}
              </div>
              <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className={styles.emptyTasks}>
              <i className="bi bi-inbox" style={{ fontSize: "2rem", color: "#cdd5e8" }} />
              <p>No tasks found.</p>
            </div>
          ) : (
            <div className={styles.taskList}>
              {filteredTasks.map((task) => {
                const isExpanded = expandedTask === task.task_id;
                return (
                  <div
                    key={task.task_id}
                    className={`${styles.taskCard} ${isExpanded ? styles.taskCardExpanded : ""}`}
                  >
                    {/* ── Task Card Header ── */}
                    <div
                      className={styles.taskCardHead}
                      onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                    >
                      <div className={styles.taskCardLeft}>
                        <span className={styles.taskId}>#{task.task_id}</span>
                        <div className={styles.taskCardMeta}>
                          <span className={styles.taskFileName}>
                            <i className="bi bi-file-earmark-text" />
                            {task.document?.file_name ?? "—"}
                          </span>
                          {task.requestor && (
                            <span className={styles.taskRequestor}>
                              <i className="bi bi-person" /> {task.requestor.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.taskCardRight}>
                        <StatusBadge status={task.status} />
                        {timeDiff(task.started_at, task.completed_at) && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            background: "#f0f3fb",
                            color: "#4a5578",
                            border: "1px solid #dde3f0",
                          }}>
                            <i className="bi bi-clock" style={{ fontSize: "0.65rem" }} />
                            {timeDiff(task.started_at, task.completed_at)}
                          </span>
                        )}
                        <span className={styles.taskDate}>{fmtDate(task.created_at)}</span>
                        <i className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"} ${styles.taskChevron}`} />
                      </div>
                    </div>

                    {/* ── Expanded Detail ── */}
                    {isExpanded && (
                      <div className={styles.taskDetail}>
                        <div className={styles.taskDetailGrid}>

                          {/* Document */}
                          {task.document && (
                            <div className={styles.detailSection}>
                              <p className={styles.detailSectionTitle}><i className="bi bi-file-earmark" /> Document</p>
                              <dl className={styles.dl}>
                                <dt>File Name</dt><dd className={styles.ddBreak}>{task.document.file_name}</dd>
                                <dt>Type</dt>     <dd>{task.document.file_type}</dd>
                                <dt>Status</dt>   <dd><StatusBadge status={task.document.status} /></dd>
                              </dl>
                            </div>
                          )}

                          {/* Requestor */}
                          {task.requestor && (
                            <div className={styles.detailSection}>
                              <p className={styles.detailSectionTitle}><i className="bi bi-person" /> Requestor</p>
                              <dl className={styles.dl}>
                                <dt>Name</dt> <dd>{task.requestor.name}</dd>
                                <dt>Email</dt><dd className={styles.ddBreak}>{task.requestor.email}</dd>
                                <dt>Tier</dt> <dd>{task.requestor.tier}</dd>
                              </dl>
                            </div>
                          )}

                          {/* Job */}
                          {task.job && (
                            <div className={styles.detailSection}>
                              <p className={styles.detailSectionTitle}><i className="bi bi-briefcase" /> Job</p>
                              <dl className={styles.dl}>
                                <dt>Job ID</dt><dd>#{task.job.job_id}</dd>
                                <dt>Status</dt><dd><StatusBadge status={task.job.status} /></dd>
                                <dt>Progress</dt>
                                <dd><JobProgress job={task.job} /></dd>
                                <dt>Failed</dt><dd style={{ color: task.job.failed_tasks > 0 ? "#c62828" : undefined }}>{task.job.failed_tasks}</dd>
                              </dl>
                            </div>
                          )}

                          {/* Admin */}
                          {task.admin && (
                            <div className={styles.detailSection}>
                              <p className={styles.detailSectionTitle}><i className="bi bi-shield-check" /> Assigned By</p>
                              <dl className={styles.dl}>
                                <dt>Name</dt>    <dd>{task.admin.name}</dd>
                                <dt>Username</dt><dd>@{task.admin.username}</dd>
                              </dl>
                            </div>
                          )}

                          {/* Timeline */}
                          <div className={styles.detailSection}>
                            <p className={styles.detailSectionTitle}><i className="bi bi-clock-history" /> Timeline</p>
                            <div className={styles.timeline}>
                              {/* Created — top left */}
                              <div className={styles.tlCreated}>
                                <span className={styles.tlLabel}>Created</span>
                                <span className={styles.tlTime}>{fmtDateTime(task.created_at)}</span>
                              </div>

                              {/* Horizontal bar */}
                              <div>
                                {/* Row 1: dot ─── badge ─── dot */}
                                <div className={styles.tlHorizRow}>
                                  <div className={task.started_at ? styles.tlDotSolid : styles.tlDotEmpty} />
                                  <div className={styles.tlHorizLine}>
                                    <div className={styles.tlDottedLine} />
                                    <span className={styles.tlDiffBadge}>
                                      {timeDiff(task.started_at, task.completed_at) || "—"}
                                    </span>
                                    <div className={styles.tlDottedLine} />
                                  </div>
                                  <div className={task.completed_at ? styles.tlDotSolid : styles.tlDotEmpty} />
                                </div>
                                {/* Row 2: labels + times below each dot */}
                                <div className={styles.tlLabelsRow}>
                                  <div className={styles.tlEndpoint}>
                                    <span className={styles.tlLabel} style={{ color: task.started_at ? undefined : "#b0b8cc" }}>Started</span>
                                    <span className={task.started_at ? styles.tlTime : styles.tlPending}>
                                      {task.started_at ? fmtDateTime(task.started_at) : "—"}
                                    </span>
                                  </div>
                                  <div className={`${styles.tlEndpoint} ${styles.tlEndpointRight}`}>
                                    <span className={styles.tlLabel} style={{ color: task.completed_at ? undefined : "#b0b8cc" }}>Completed</span>
                                    <span className={task.completed_at ? styles.tlTime : styles.tlPending}>
                                      {task.completed_at ? fmtDateTime(task.completed_at) : "—"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Reasons */}
                          {(task.user_reason || task.annotator_reason) && (
                            <div className={`${styles.detailSection} ${styles.detailSectionFull}`}>
                              <p className={styles.detailSectionTitle}><i className="bi bi-chat-left-text" /> Reasons</p>
                              {task.user_reason && (
                                <div className={styles.reasonBlock}>
                                  <span className={styles.reasonLabel}>User</span>
                                  <p className={styles.reasonText}>{task.user_reason}</p>
                                </div>
                              )}
                              {task.annotator_reason && (
                                <div className={styles.reasonBlock}>
                                  <span className={styles.reasonLabel}>Annotator</span>
                                  <p className={styles.reasonText}>{task.annotator_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}