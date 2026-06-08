"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./collectionDetail.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocumentDetail {
  document_id: number;
  job_id: number | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  ocr_url: string | null;
  ocr_version: string | null;
  status: "Queued" | "Processing" | "Completed" | "Failed";
  version_count: number;
  created_at: string;
}

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
  created_at: string;
  updated_at: string;
}

interface DownloadDetail {
  download_id: number;
  status: "Pending" | "Processing" | "Completed" | "Failed";
  blob_url: string | null;
  file_size: number | null;
  error_message: string | null;
  downloaded_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface CollectionDetail {
  collection_id: number;
  title: string;
  description: string | null;
  language: string | null;
  url: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_tier: string;
  user_priority: string;
  documents: DocumentDetail[];
  jobs: JobDetail[];
  review_tasks: ReviewTaskDetail[];
  downloads: DownloadDetail[];
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

type Tab = "documents" | "jobs" | "review_tasks" | "downloads";

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

const getPreviewUrl = (filePath: string, fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const encoded = encodeURIComponent(filePath);
  if (ext === "pdf")
    return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext))
    return `https://view.officeapps.live.com/op/view.aspx?src=${encoded}`;
  return filePath;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[status] ?? "statusQueued"]}`}>
      <i className={`bi ${STATUS_ICON[status] ?? "bi-circle"}`} />
      {status}
    </span>
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

    if (statusFilter) {
      result = result.filter((row) => row.status === statusFilter);
    }

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
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  statusOptions: string[];
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
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
        <select className={styles.tabSelect} value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <div className={styles.dateRangeWrap}>
        <span className={styles.dateRangeLabel}>From</span>
        <input className={styles.dateInput} type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} />
        <span className={styles.dateRangeLabel}>To</span>
        <input className={styles.dateInput} type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} />
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

export default function CollectionDetailPage() {
  const { CollectionId } = useParams();
  const router = useRouter();

  const [data, setData]           = useState<CollectionDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  useEffect(() => {
    if (!CollectionId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_URL}/admin/collections/${CollectionId}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e.message ?? "Failed to load collection.");
      } finally {
        setLoading(false);
      }
    })();
  }, [CollectionId]);

  const docsSF  = useSortFilter<DocumentDetail>(data?.documents      ?? []);
  const jobsSF  = useSortFilter<JobDetail>(data?.jobs                ?? []);
  const tasksSF = useSortFilter<ReviewTaskDetail>(data?.review_tasks ?? []);
  const dlsSF   = useSortFilter<DownloadDetail>(data?.downloads      ?? []);

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  if (loading) return (
    <div className={styles.stateWrap}>
      <span className={styles.spinner} />
      <p>Loading collection...</p>
    </div>
  );

  if (error || !data) return (
    <div className={styles.stateWrap}>
      <p className={styles.errorText}>{error ?? "Collection not found."}</p>
      <button className={styles.backBtn} onClick={() => router.back()}>← Go Back</button>
    </div>
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "documents",    label: "Documents",    count: data.documents.length },
    { key: "jobs",         label: "Jobs",         count: data.jobs.length },
    { key: "review_tasks", label: "Review Tasks", count: data.review_tasks.length },
    { key: "downloads",    label: "Downloads",    count: data.downloads.length },
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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <i className="bi bi-arrow-left" /> Back
        </button>
        <div className={styles.headerMain}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>{data.title}</h2>
            <span className={styles.idBadge}>#{data.collection_id}</span>
            <StatusBadge status={data.status} />
          </div>
        </div>
        {data.description && <p className={styles.description}>{data.description}</p>}
      </div>

      {/* ── Meta Cards ──────────────────────────────────────────────────────── */}
      <div className={styles.metaGrid}>

        <div className={styles.metaCard} onClick={(e) => handleNavigation(e, `/dashboard/users/${data.user_id}`)} style={{ cursor: "pointer" }}>
          <span className={styles.metaLabel}>Owner</span>
          <span className={styles.metaValue}>{data.user_name}</span>
          <span className={styles.metaSub}>{data.user_email}</span>
        </div>

        <div className={styles.metaCard}>
          <span className={styles.metaLabel}>Tier / Priority</span>
          <span className={styles.metaValue}>{data.user_tier}</span>
          <span className={styles.metaSub}>Priority: {data.user_priority}</span>
        </div>

        <div className={styles.metaCard}>
          <span className={styles.metaLabel}>Language</span>
          <span className={styles.metaValue}>{data.language ?? "—"}</span>
        </div>

        <div className={styles.metaCard}>
          <span className={styles.metaLabel}>Source URL</span>
          <span className={styles.metaSub} style={{ wordBreak: "break-all" }}>{data.url}</span>
        </div>

        <div className={styles.metaCard}>
          <span className={styles.metaLabel}>Created</span>
          <span className={styles.metaValue}>{fmt(data.created_at)}</span>
          <span className={styles.metaSub}>Updated: {fmt(data.updated_at)}</span>
        </div>

      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
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

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className={styles.tabContent}>

        {/* Documents */}
        {activeTab === "documents" && (
          <>
            <TabToolbar {...toolbarProps(docsSF, ["Queued", "Processing", "Completed", "Failed"])} />
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh label="#"         {...sh(docsSF, "document_id")}   />
                  <SortTh label="File Name" {...sh(docsSF, "file_name")}     />
                  <SortTh label="Type"      {...sh(docsSF, "file_type")}     />
                  <SortTh label="Size"      {...sh(docsSF, "file_size")}     />
                  <SortTh label="Status"    {...sh(docsSF, "status")}        />
                  <SortTh label="OCR Ver."  {...sh(docsSF, "ocr_version")}   />
                  <SortTh label="OCR"       {...sh(docsSF, "ocr_url")}       />
                  <SortTh label="Versions"  {...sh(docsSF, "version_count")} />
                  <SortTh label="Created"   {...sh(docsSF, "created_at")}    />
                </tr>
              </thead>
              <tbody>
                {docsSF.processed.length === 0
                  ? <tr><td colSpan={9} className={styles.emptyCell}>No documents.</td></tr>
                  : docsSF.processed.map((doc) => (
                    <tr key={doc.document_id} onClick={(e) => handleNavigation(e, `/dashboard/collections/${CollectionId}/document/${doc.document_id}`)} style={{ cursor: "pointer" }}>
                      <td className={styles.idCell} style={{ cursor: "inherit" }}>{doc.document_id}</td>
                      <td className={styles.fileCell} style={{ cursor: "inherit" }}>
                        <a href={getPreviewUrl(doc.file_path, doc.file_name)} target="_blank" rel="noreferrer" className={styles.fileLink} onClick={(e) => e.stopPropagation()}>
                          <i className="bi bi-file-earmark" /> {doc.file_name}
                        </a>
                      </td>
                      <td style={{ cursor: "inherit" }}>{doc.file_type ?? "—"}</td>
                      <td style={{ cursor: "inherit" }}>{fmtSize(doc.file_size)}</td>
                      <td style={{ cursor: "inherit" }}><StatusBadge status={doc.status} /></td>
                      <td style={{ cursor: "inherit" }}>{doc.ocr_version ?? "—"}</td>
                      <td style={{ cursor: "inherit" }}>
                        {doc.ocr_url
                          ? <a href={getPreviewUrl(doc.ocr_url, doc.file_name)} target="_blank" rel="noreferrer" className={styles.urlLink} onClick={(e) => e.stopPropagation()}>
                              <i className="bi bi-file-earmark-text" /> View
                            </a>
                          : <span style={{ color: "#9aa3bb" }}>—</span>}
                      </td>
                      <td className={styles.numCell} style={{ cursor: "inherit" }}>{doc.version_count}</td>
                      <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmt(doc.created_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </>
        )}

        {/* Jobs */}
        {activeTab === "jobs" && (
          <>
            <TabToolbar {...toolbarProps(jobsSF, ["Queued", "Processing", "Completed", "Failed", "Partial"])} />
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh label="#"         {...sh(jobsSF, "job_id")}          />
                  <SortTh label="Status"    {...sh(jobsSF, "status")}          />
                  <SortTh label="Total"     {...sh(jobsSF, "total_tasks")}     />
                  <SortTh label="Completed" {...sh(jobsSF, "completed_tasks")} />
                  <SortTh label="Failed"    {...sh(jobsSF, "failed_tasks")}    />
                  <SortTh label="Created"   {...sh(jobsSF, "created_at")}      />
                  <SortTh label="Started"   {...sh(jobsSF, "started_at")}      />
                  <SortTh label="Finished"  {...sh(jobsSF, "completed_at")}    />
                </tr>
              </thead>
              <tbody>
                {jobsSF.processed.length === 0
                  ? <tr><td colSpan={8} className={styles.emptyCell}>No jobs.</td></tr>
                  : jobsSF.processed.map((job) => (
                    <tr key={job.job_id} onClick={(e) => handleNavigation(e, `/dashboard/jobs/${job.job_id}`)} style={{ cursor: "pointer" }}>
                      <td className={styles.idCell} style={{ cursor: "inherit" }}>{job.job_id}</td>
                      <td style={{ cursor: "inherit" }}><StatusBadge status={job.status} /></td>
                      <td className={styles.numCell} style={{ cursor: "inherit" }}>{job.total_tasks}</td>
                      <td className={styles.numCell} style={{ color: "#1a7a4a", cursor: "inherit" }}>{job.completed_tasks}</td>
                      <td className={styles.numCell} style={{ color: job.failed_tasks > 0 ? "#c0392b" : undefined, cursor: "inherit" }}>{job.failed_tasks}</td>
                      <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmtDateTime(job.created_at)}</td>
                      <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmtDateTime(job.started_at)}</td>
                      <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmtDateTime(job.completed_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </>
        )}

        {/* Review Tasks */}
        {activeTab === "review_tasks" && (
          <>
            <TabToolbar {...toolbarProps(tasksSF, ["Pending", "Assigned", "InReview", "Completed", "Rejected"])} />
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh label="#"           {...sh(tasksSF, "task_id")}        />
                  <SortTh label="Status"      {...sh(tasksSF, "status")}         />
                  <SortTh label="Admin"       {...sh(tasksSF, "admin_name")}     />
                  <SortTh label="Annotator"   {...sh(tasksSF, "annotator_name")} />
                  <SortTh label="User Reason" {...sh(tasksSF, "user_reason")}    />
                  <SortTh label="Created"     {...sh(tasksSF, "created_at")}     />
                </tr>
              </thead>
              <tbody>
                {tasksSF.processed.length === 0
                  ? <tr><td colSpan={6} className={styles.emptyCell}>No review tasks.</td></tr>
                  : tasksSF.processed.map((task) => (
                    <tr key={task.task_id} onClick={(e) => handleNavigation(e, `/dashboard/tasks/${task.task_id}`)} style={{ cursor: "pointer" }}>
                      <td className={styles.idCell} style={{ cursor: "inherit" }}>{task.task_id}</td>
                      <td style={{ cursor: "inherit" }}><StatusBadge status={task.status} /></td>
                      <td style={{ cursor: "inherit" }}>{task.admin_name ?? "—"}</td>
                      <td style={{ cursor: "inherit" }}>{task.annotator_name ?? "—"}</td>
                      <td className={styles.reasonCell} style={{ cursor: "inherit" }}>{task.user_reason}</td>
                      <td className={styles.dateCell} style={{ cursor: "inherit" }}>{fmt(task.created_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </>
        )}

        {/* Downloads */}
        {activeTab === "downloads" && (
          <>
            <TabToolbar {...toolbarProps(dlsSF, ["Pending", "Processing", "Completed", "Failed"])} />
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh label="#"             {...sh(dlsSF, "download_id")}   />
                  <SortTh label="Downloaded By" {...sh(dlsSF, "downloaded_by")} />
                  <SortTh label="Status"        {...sh(dlsSF, "status")}        />
                  <SortTh label="Size"          {...sh(dlsSF, "file_size")}     />
                  <SortTh label="Started"       {...sh(dlsSF, "started_at")}    />
                  <SortTh label="Completed"     {...sh(dlsSF, "completed_at")}  />
                </tr>
              </thead>
              <tbody>
                {dlsSF.processed.length === 0
                  ? <tr><td colSpan={6} className={styles.emptyCell}>No downloads.</td></tr>
                  : dlsSF.processed.map((dl) => (
                    <tr key={dl.download_id}>
                      <td className={styles.idCell}>{dl.download_id}</td>
                      <td>{dl.downloaded_by}</td>
                      <td><StatusBadge status={dl.status} /></td>
                      <td>{fmtSize(dl.file_size)}</td>
                      <td className={styles.dateCell}>{fmtDateTime(dl.started_at)}</td>
                      <td className={styles.dateCell}>{fmtDateTime(dl.completed_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </>
        )}

      </div>
    </div>
  );
}