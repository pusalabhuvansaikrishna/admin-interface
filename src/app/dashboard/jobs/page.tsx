// app/dashboard/jobs/page.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./jobs.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobSummary {
  job_id: number;
  username: string;
  collection_name: string;
  status: "Queued" | "Processing" | "Failed" | "Partial" | "Completed";
  total_tasks: number;
  completed_tasks: number;
}

interface PaginatedJobs {
  total: number;
  limit: number;
  offset: number;
  data: JobSummary[];
}

type StatusCounts = Record<string, number>;

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, { cls: string; icon: string }> = {
  Queued:     { cls: "statusQueued",     icon: "bi-clock"             },
  Processing: { cls: "statusProcessing", icon: "bi-arrow-repeat"      },
  Failed:     { cls: "statusFailed",     icon: "bi-x-circle-fill"     },
  Partial:    { cls: "statusPartial",    icon: "bi-exclamation-circle" },
  Completed:  { cls: "statusCompleted",  icon: "bi-check-circle-fill" },
};

const STATUS_ORDER = ["Queued", "Processing", "Failed", "Partial", "Completed"] as const;

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ completed, total, status }: {
  completed: number;
  total: number;
  status: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressFill} ${styles[`progress_${status}`]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={styles.progressLabel}>{completed}/{total}</span>
    </div>
  );
}

// ── Status Pills ──────────────────────────────────────────────────────────────

function StatusPills({ counts, active, onSelect }: {
  counts: StatusCounts | null;
  active: string;
  onSelect: (s: string) => void;
}) {
  return (
    <div className={styles.pillsRow}>
      {STATUS_ORDER.map((s) => {
        const { cls, icon } = STATUS_STYLES[s];
        const isActive = active === s;
        const count = counts?.[s] ?? 0;

        return (
          <button
            key={s}
            className={`${styles.pill} ${styles[cls]} ${isActive ? styles.pillActive : ""}`}
            onClick={() => onSelect(isActive ? "" : s)}
          >
            <i className={`bi ${icon} ${s === "Processing" ? styles.spinIcon : ""}`} />
            <span className={styles.pillLabel}>{s}</span>
            <span className={styles.pillCount}>
              {counts === null ? "—" : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const router = useRouter();

  const [data, setData]       = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Status counts for pills
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  // ── Fetch status counts (once on mount) ─────────────────────────────────────

  useEffect(() => {
    fetch(`${BASE_URL}/admin/jobs/status-counts`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStatusCounts)
      .catch(() => setStatusCounts({}));
  }, []);

  // ── Fetch jobs ──────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search) params.set("search", search);
    if (status) params.set("status", status);

    try {
      const res = await fetch(
        `${BASE_URL}/admin/jobs?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch jobs.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { setPage(1); }, [search, status]);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.title}>Jobs</h2>
          {data && (
            <span className={styles.totalBadge}>{data.total} total</span>
          )}
        </div>
      </div>

      {/* ── Status Pills ────────────────────────────────────────────────── */}
      <StatusPills
        counts={statusCounts}
        active={status}
        onSelect={setStatus}
      />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by username or collection..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Queued">Queued</option>
          <option value="Processing">Processing</option>
          <option value="Failed">Failed</option>
          <option value="Partial">Partial</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading jobs...</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchJobs}>Retry</button>
          </div>
        ) : data?.data.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No jobs found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Username</th>
                <th>Collection</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((job) => {
                const s = STATUS_STYLES[job.status];
                return (
                  <tr
                    key={job.job_id}
                    className={styles.clickableRow}
                    onClick={(e) => handleNavigation(e, `/dashboard/jobs/${job.job_id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className={styles.idCell}>#{job.job_id}</td>
                    <td className={styles.usernameCell}>@{job.username}</td>
                    <td className={styles.collectionCell}>{job.collection_name}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[s.cls]}`}>
                        <i className={`bi ${s.icon} ${job.status === "Processing" ? styles.spinIcon : ""}`} />
                        {job.status}
                      </span>
                    </td>
                    <td className={styles.progressCell}>
                      <ProgressBar
                        completed={job.completed_tasks}
                        total={job.total_tasks}
                        status={job.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && !error && data && totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                  onClick={() => setPage(p as number)}
                >{p}</button>
              )
            )}

          <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
        </div>
      )}

    </div>
  );
}