"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./documentDetail.module.css";
import { BASE_URL } from "@/config/api";
import { EditDocumentModal, OcrData } from "./EditDocumentModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface JobDetail {
  job_id: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  status: "Queued" | "Processing" | "Completed" | "Failed" | "Partial";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewTaskDetail {
  task_id: number;
  document_id: number | null;
  job_id: number | null;
  user_reason: string;
  annotator_reason: string | null;
  status: "Pending" | "Assigned" | "InReview" | "Completed" | "Rejected";
  admin_name: string | null;
  annotator_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentDetail {
  document_id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  ocr_url: string | null;
  ocr_version: string | null;
  status: "Queued" | "Processing" | "Completed" | "Failed";
  version_count: number;
  created_at: string;

  collection_id: number;
  collection_title: string;
  collection_language: string | null;
  collection_status: string;

  user_id: string;
  user_name: string;
  user_email: string;
  user_tier: string;
  user_priority: string;

  job: JobDetail | null;
  review_tasks: ReviewTaskDetail[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  Queued:     "statusQueued",
  Processing: "statusProcessing",
  Completed:  "statusCompleted",
  Failed:     "statusFailed",
  Partial:    "statusPartial",
  Pending:    "statusQueued",
  Assigned:   "statusProcessing",
  InReview:   "statusProcessing",
  Rejected:   "statusFailed",
};

const STATUS_ICON: Record<string, string> = {
  Queued:     "bi-clock",
  Processing: "bi-arrow-repeat",
  Completed:  "bi-check-circle-fill",
  Failed:     "bi-x-circle-fill",
  Partial:    "bi-dash-circle-fill",
  Pending:    "bi-clock",
  Assigned:   "bi-person-check",
  InReview:   "bi-eye",
  Rejected:   "bi-x-circle-fill",
};

type Tab = "job" | "review_tasks";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}, ${time}`;
};

const fmtSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[status] ?? "statusQueued"]}`}>
      <i className={`bi ${STATUS_ICON[status] ?? "bi-circle"}`} />
      {status}
    </span>
  );
}

// ── File Preview ───────────────────────────────────────────────────────────────

function FilePreview({ filePath, fileName }: { filePath: string; fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage  = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
  const isPdf    = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);

  if (isImage) {
    return (
      <img
        src={filePath}
        alt={fileName}
        className={styles.previewFrame}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          background: "#f8f9fa"
        }}
      />
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(filePath)}&embedded=true`}
        className={styles.previewFrame}
        title={fileName}
      />
    );
  }

  if (isOffice) {
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(filePath)}`}
        className={styles.previewFrame}
        title={fileName}
      />
    );
  }

  return (
    <div className={styles.previewUnsupported}>
      <i className="bi bi-file-earmark" style={{ fontSize: "2.5rem", color: "#c8d4f0" }} />
      <p>No preview available for <strong>.{ext}</strong> files.</p>
    </div>
  );
}

// ── Sort / Filter hook ─────────────────────────────────────────────────────────

type SortDir = "asc" | "desc" | null;

function useSortFilter<T extends Record<string, any>>(items: T[]) {
  const [search, setSearch]             = useState("");
  const [sortKey, setSortKey]           = useState<string | null>(null);
  const [sortDir, setSortDir]           = useState<SortDir>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  };

  const clearDates = () => { setDateFrom(""); setDateTo(""); };

  const processed = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (statusFilter) result = result.filter((row) => row.status === statusFilter);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((row) => row.created_at && new Date(row.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((row) => row.created_at && new Date(row.created_at) <= to);
    }
    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [items, search, statusFilter, dateFrom, dateTo, sortKey, sortDir]);

  return {
    processed,
    search, setSearch,
    sortKey, sortDir, toggleSort,
    statusFilter, setStatusFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    clearDates,
  };
}

// ── SortTh ─────────────────────────────────────────────────────────────────────

function SortTh({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: string; sortKey: string | null; sortDir: SortDir; onSort: (k: string) => void;
}) {
  const active = sortKey === colKey;
  return (
    <th onClick={() => onSort(colKey)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{" "}
      <span style={{ opacity: active ? 1 : 0.3, fontSize: "0.65rem" }}>
        {active && sortDir === "desc" ? "▼" : "▲"}
      </span>
    </th>
  );
}

// ── TabToolbar ─────────────────────────────────────────────────────────────────

function TabToolbar({
  search, onSearch,
  statusFilter, onStatusFilter, statusOptions,
  dateFrom, onDateFrom,
  dateTo, onDateTo,
  onClearDates,
}: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatusFilter: (v: string) => void; statusOptions: string[];
  dateFrom: string; onDateFrom: (v: string) => void;
  dateTo: string; onDateTo: (v: string) => void;
  onClearDates: () => void;
}) {
  const hasDateFilter = dateFrom || dateTo;
  return (
    <div className={styles.tabToolbar}>
      <input
        className={styles.tabSearch}
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      {statusOptions.length > 0 && (
        <select
          className={styles.tabSelect}
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <div className={styles.dateRangeWrap}>
        <span className={styles.dateRangeLabel}>From</span>
        <input
          className={styles.dateInput}
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
        />
        <span className={styles.dateRangeLabel}>To</span>
        <input
          className={styles.dateInput}
          type="date"
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
        />
        {hasDateFilter && (
          <button className={styles.clearDateBtn} onClick={onClearDates}>
            <i className="bi bi-x" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { documentId } = useParams();
  const router = useRouter();

  const [data, setData]           = useState<DocumentDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("review_tasks");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_URL}/admin/documents/${documentId}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e.message ?? "Failed to load document.");
      } finally {
        setLoading(false);
      }
    })();
  }, [documentId]);

  const tasksSF = useSortFilter<ReviewTaskDetail>(data?.review_tasks ?? []);

  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  const handleModalSave = (updatedData: { file_path: string; ocr_data: OcrData }) => {
    if (!data) return;
    setData({
      ...data,
      file_path: updatedData.file_path,
    });
  };

  if (loading) return (
    <div className={styles.stateWrap}>
      <span className={styles.spinner} />
      <p>Loading document...</p>
    </div>
  );

  if (error || !data) return (
    <div className={styles.stateWrap}>
      <p className={styles.errorText}>{error ?? "Document not found."}</p>
      <button className={styles.backBtn} onClick={() => router.back()}>← Go Back</button>
    </div>
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "review_tasks", label: "Review Tasks", count: data.review_tasks.length },
    { key: "job",          label: "Job",           count: data.job ? 1 : 0 },
  ];

  const sh = (sf: ReturnType<typeof useSortFilter>, k: string) => ({
    colKey: k, sortKey: sf.sortKey, sortDir: sf.sortDir, onSort: sf.toggleSort,
  });

  const toolbarProps = (sf: ReturnType<typeof useSortFilter>, statusOptions: string[]) => ({
    search: sf.search, onSearch: sf.setSearch,
    statusFilter: sf.statusFilter, onStatusFilter: sf.setStatusFilter,
    statusOptions,
    dateFrom: sf.dateFrom, onDateFrom: sf.setDateFrom,
    dateTo: sf.dateTo, onDateTo: sf.setDateTo,
    onClearDates: sf.clearDates,
  });

  return (
    <div className={styles.page}>
      <div className={styles.mainLayout}>

        {/* ── Left Column ─────────────────────────────────────────────────── */}
        <div className={styles.leftCol}>

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className={styles.header}>
            <button className={styles.backBtn} onClick={() => router.back()}>
              <i className="bi bi-arrow-left" /> Back
            </button>
            <div className={styles.headerMain}>
              <div className={styles.headerLeft}>
                <i className="bi bi-file-earmark-text" style={{ fontSize: "1.1rem", color: "#4e8ef7" }} />
                <h2 className={styles.title}>{data.file_name}</h2>
                <span className={styles.idBadge}>#{data.document_id}</span>
                <StatusBadge status={data.status} />
              </div>
              <div className={styles.headerActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => setIsModalOpen(true)}
                >
                  <i className="bi bi-pencil" /> Edit
                </button>
                {data.ocr_url && (
                  <a
                    href={data.ocr_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                  >
                    <i className="bi bi-file-earmark-text" /> View OCR
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Meta Grid ─────────────────────────────────────────────────── */}
          <div className={styles.metaGrid}>

            {/* File Info */}
            <div className={styles.metaSection}>
              <div className={styles.metaSectionTitle}>
                <i className="bi bi-file-earmark" /> File Info
              </div>
              <div className={styles.metaCards}>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>File Type</span>
                  <span className={styles.metaValue}>{data.file_type?.toUpperCase() ?? "—"}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>File Size</span>
                  <span className={styles.metaValue}>{fmtSize(data.file_size)}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Versions</span>
                  <span className={styles.metaValue}>{data.version_count}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>OCR Version</span>
                  <span className={styles.metaValue}>{data.ocr_version ?? "—"}</span>
                </div>
                {/* ✅ Fixed: was className={styles.metaLabel"} — missing opening brace */}
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Created</span>
                  <span className={styles.metaValue}>{fmt(data.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Collection */}
            <div className={styles.metaSection}>
              <div className={styles.metaSectionTitle}>
                <i className="bi bi-collection" /> Collection
              </div>
              <div className={styles.metaCards}>
                <div
                  className={`${styles.metaCard} ${styles.metaCardClickable}`}
                  onClick={(e) => handleNavigation(e, `/dashboard/collections/${data.collection_id}`)}
                >
                  <span className={styles.metaLabel}>Title</span>
                  <span className={`${styles.metaValue} ${styles.metaLink}`}>{data.collection_title}</span>
                  <span className={styles.metaSub}>#{data.collection_id}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Language</span>
                  <span className={styles.metaValue}>{data.collection_language ?? "—"}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Collection Status</span>
                  <StatusBadge status={data.collection_status} />
                </div>
              </div>
            </div>

            {/* Owner */}
            <div className={styles.metaSection}>
              <div className={styles.metaSectionTitle}>
                <i className="bi bi-person" /> Owner
              </div>
              <div className={styles.metaCards}>
                <div
                  className={`${styles.metaCard} ${styles.metaCardClickable}`}
                  onClick={(e) => handleNavigation(e, `/dashboard/users/${data.user_id}`)}
                >
                  <span className={styles.metaLabel}>Name</span>
                  <span className={`${styles.metaValue} ${styles.metaLink}`}>{data.user_name}</span>
                  <span className={styles.metaSub}>{data.user_email}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Tier</span>
                  <span className={styles.metaValue}>{data.user_tier}</span>
                </div>
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Priority</span>
                  <span className={styles.metaValue}>{data.user_priority}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                <span className={styles.tabCount}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* ── Tab Content ───────────────────────────────────────────────── */}
          <div className={styles.tabContent}>

            {/* Review Tasks */}
            {activeTab === "review_tasks" && (
              <>
                <TabToolbar {...toolbarProps(tasksSF, ["Pending", "Assigned", "InReview", "Completed", "Rejected"])} />
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortTh label="#"              {...sh(tasksSF, "task_id")}          />
                      <SortTh label="Status"         {...sh(tasksSF, "status")}           />
                      <SortTh label="Admin"          {...sh(tasksSF, "admin_name")}       />
                      <SortTh label="Annotator"      {...sh(tasksSF, "annotator_name")}   />
                      <SortTh label="User Reason"    {...sh(tasksSF, "user_reason")}      />
                      <SortTh label="Annotator Note" {...sh(tasksSF, "annotator_reason")} />
                      <SortTh label="Started"        {...sh(tasksSF, "started_at")}       />
                      <SortTh label="Completed"      {...sh(tasksSF, "completed_at")}     />
                      <SortTh label="Created"        {...sh(tasksSF, "created_at")}       />
                    </tr>
                  </thead>
                  <tbody>
                    {tasksSF.processed.length === 0
                      ? <tr><td colSpan={9} className={styles.emptyCell}>No review tasks.</td></tr>
                      : tasksSF.processed.map((task) => (
                        <tr
                          key={task.task_id}
                          onClick={(e) => handleNavigation(e, `/dashboard/tasks/${task.task_id}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <td className={styles.idCell}   style={{ cursor: "inherit" }}>{task.task_id}</td>
                          <td style={{ cursor: "inherit" }}><StatusBadge status={task.status} /></td>
                          <td style={{ cursor: "inherit" }}>{task.admin_name ?? "—"}</td>
                          <td style={{ cursor: "inherit" }}>{task.annotator_name ?? "—"}</td>
                          <td className={styles.reasonCell} style={{ cursor: "inherit" }}>{task.user_reason}</td>
                          <td className={styles.reasonCell} style={{ cursor: "inherit" }}>{task.annotator_reason ?? "—"}</td>
                          <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmtDateTime(task.started_at)}</td>
                          <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmtDateTime(task.completed_at)}</td>
                          <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmt(task.created_at)}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </>
            )}

            {/* Job */}
            {activeTab === "job" && (
              data.job ? (
                <div
                  className={styles.jobCard}
                  onClick={(e) => handleNavigation(e, `/dashboard/jobs/${data.job!.job_id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.jobCardHeader}>
                    <div className={styles.jobCardLeft}>
                      <span className={styles.jobIdBadge}>Job #{data.job.job_id}</span>
                      <StatusBadge status={data.job.status} />
                    </div>
                    <span className={styles.jobCardHint}>
                      <i className="bi bi-arrow-right" /> View Job Details
                    </span>
                  </div>

                  <div className={styles.jobStats}>
                    <div className={styles.jobStat}>
                      <span className={styles.jobStatValue}>{data.job.total_tasks}</span>
                      <span className={styles.jobStatLabel}>Total Tasks</span>
                    </div>
                    <div className={`${styles.jobStat} ${styles.jobStatSuccess}`}>
                      <span className={styles.jobStatValue}>{data.job.completed_tasks}</span>
                      <span className={styles.jobStatLabel}>Completed</span>
                    </div>
                    <div className={`${styles.jobStat} ${data.job.failed_tasks > 0 ? styles.jobStatDanger : ""}`}>
                      <span className={styles.jobStatValue}>{data.job.failed_tasks}</span>
                      <span className={styles.jobStatLabel}>Failed</span>
                    </div>
                  </div>

                  {data.job.total_tasks > 0 && (
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${Math.round((data.job.completed_tasks / data.job.total_tasks) * 100)}%` }}
                        />
                        {data.job.failed_tasks > 0 && (
                          <div
                            className={styles.progressFillFailed}
                            style={{ width: `${Math.round((data.job.failed_tasks / data.job.total_tasks) * 100)}%` }}
                          />
                        )}
                      </div>
                      <span className={styles.progressLabel}>
                        {Math.round((data.job.completed_tasks / data.job.total_tasks) * 100)}% complete
                      </span>
                    </div>
                  )}

                  <div className={styles.jobDates}>
                    <div className={styles.jobDateItem}>
                      <span className={styles.jobDateLabel}>Created</span>
                      <span className={styles.jobDateValue}>{fmtDateTime(data.job.created_at)}</span>
                    </div>
                    <div className={styles.jobDateItem}>
                      <span className={styles.jobDateLabel}>Started</span>
                      <span className={styles.jobDateValue}>{fmtDateTime(data.job.started_at)}</span>
                    </div>
                    <div className={styles.jobDateItem}>
                      <span className={styles.jobDateLabel}>Finished</span>
                      <span className={styles.jobDateValue}>{fmtDateTime(data.job.completed_at)}</span>
                    </div>
                    <div className={styles.jobDateItem}>
                      <span className={styles.jobDateLabel}>Updated</span>
                      <span className={styles.jobDateValue}>{fmtDateTime(data.job.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <i className="bi bi-briefcase" style={{ fontSize: "2rem", color: "#c8d4f0" }} />
                  <p>No job associated with this document.</p>
                </div>
              )
            )}

          </div>
        </div>
        {/* ── End Left Column ─────────────────────────────────────────────── */}

        {/* ── Right Column: File Preview ───────────────────────────────────── */}
        <div className={styles.previewCol}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>
              <i className="bi bi-eye" /> File Preview
            </span>
            <span className={styles.previewFileName}>{data.file_name}</span>
          </div>
          <div className={styles.previewBody}>
            <FilePreview filePath={data.file_path} fileName={data.file_name} />
          </div>
        </div>
        {/* ── End Right Column ────────────────────────────────────────────── */}

      </div>

      {/* ── Modal Integration ──────────────────────────────────────────── */}
      <EditDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={data.document_id}
        filePath={data.file_path}
        ocrUrl={data.ocr_url}
        language={data.collection_language}
        onSave={handleModalSave}
      />
    </div>
  );
}