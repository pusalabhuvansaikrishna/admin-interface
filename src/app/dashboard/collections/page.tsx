"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./collections.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollectionSummary {
  collection_id: number;
  title: string;
  user_name: string;
  url: string;
  language?: string;
  status: "Queued" | "Processing" | "Completed" | "Partial" | "Failed";
  created_at: string;
  num_files: number;
}

interface PaginatedCollections {
  total: number;
  limit: number;
  offset: number;
  data: CollectionSummary[];
}

interface CollectionStats {
  total: number;
  status_counts: {
    Queued:     number;
    Processing: number;
    Completed:  number;
    Partial:    number;
    Failed:     number;
  };
  language_counts: Record<string, number>;
}

type SortKey = keyof CollectionSummary;
type SortDir = "asc" | "desc";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_CLASS: Record<string, string> = {
  Queued:     "statusQueued",
  Processing: "statusProcessing",
  Completed:  "statusCompleted",
  Partial:    "statusPartial",
  Failed:     "statusFailed",
};

const STATUS_ICON: Record<string, string> = {
  Queued:     "bi-clock",
  Processing: "bi-arrow-repeat",
  Completed:  "bi-check-circle-fill",
  Partial:    "bi-exclamation-circle",
  Failed:     "bi-x-circle-fill",
};

const STATUS_INSIGHT_ICON: Record<string, string> = {
  Queued:     "bi-clock-fill",
  Processing: "bi-arrow-repeat",
  Completed:  "bi-check-circle-fill",
  Partial:    "bi-exclamation-circle-fill",
  Failed:     "bi-x-circle-fill",
};

const ALL_STATUSES = ["Queued", "Processing", "Completed", "Partial", "Failed"] as const;
type StatusType = typeof ALL_STATUSES[number];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const router = useRouter();

  const [data, setData]                 = useState<PaginatedCollections | null>(null);
  const [stats, setStats]               = useState<CollectionStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Filters
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("");
  const [language, setLanguage]   = useState("");   // ← new dedicated language filter
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);

  // ── Fetch table data ────────────────────────────────────────────────────────

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search)   params.set("search",    search);
    if (status)   params.set("status",    status);
    if (language) params.set("language",  language);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo)   params.set("date_to",   dateTo);

    try {
      const res = await fetch(
        `${BASE_URL}/admin/collections?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const json: PaginatedCollections = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch collections.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, language, dateFrom, dateTo]);

  // ── Fetch stats ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);

    const params = new URLSearchParams();
    if (search)   params.set("search",    search);
    if (status)   params.set("status",    status);
    if (language) params.set("language",  language);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo)   params.set("date_to",   dateTo);

    try {
      const res = await fetch(
        `${BASE_URL}/admin/collections/stats?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Stats error ${res.status}`);
      const json: CollectionStats = await res.json();
      setStats(json);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [search, status, language, dateFrom, dateTo]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => { setPage(1); }, [search, status, language, dateFrom, dateTo]);
  useEffect(() => { fetchCollections(); }, [fetchCollections]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Client-side sort ────────────────────────────────────────────────────────

  const sortedRows = useMemo(() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <i className="bi bi-chevron-expand" style={{ opacity: 0.35 }} />;
    return sortDir === "asc"
      ? <i className="bi bi-chevron-up" />
      : <i className="bi bi-chevron-down" />;
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages       = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const hasActiveFilters = search || status || language || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setLanguage("");
    setDateFrom("");
    setDateTo("");
  };

  // Handles checking for Ctrl / Cmd keys on click
  const handleRowClick = (e: React.MouseEvent, id: number) => {
    const url = `/dashboard/collections/${id}`;

    // If Ctrl (Windows/Linux) or Cmd (Mac) is held down
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.title}>Collections</h2>
          {data && (
            <span className={styles.totalBadge}>{data.total} total</span>
          )}
        </div>
      </div>

      {/* ── Insights Bar ────────────────────────────────────────────────── */}
      {!statsLoading && stats && (
        <div className={styles.insightsBar}>

          {/* Status chips */}
          <div className={styles.insightGroup}>
            <span className={styles.insightGroupLabel}>Status</span>
            <div className={styles.insightChips}>
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  className={`${styles.insightChip} ${styles[STATUS_CLASS[s]]}${status === s ? ` ${styles.insightChipActive}` : ""}`}
                  onClick={() => setStatus((prev) => (prev === s ? "" : s))}
                  title={`Filter by ${s}`}
                >
                  <i className={`bi ${STATUS_INSIGHT_ICON[s]}${s === "Processing" ? ` ${styles.spinIcon}` : ""}`} />
                  <strong>{stats.status_counts[s]}</strong>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.insightDivider} />

          {/* Language chips — clicking sets the dedicated language filter */}
          <div className={styles.insightGroup}>
            <span className={styles.insightGroupLabel}>Languages</span>
            <div className={styles.insightChips}>
              {Object.entries(stats.language_counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([lang, count]) => (
                  <button
                    key={lang}
                    className={`${styles.langChip}${language === lang ? ` ${styles.langChipActive}` : ""}`}
                    onClick={() => setLanguage((prev) => (prev === lang ? "" : lang))}
                    title={`Filter by ${lang}`}
                  >
                    <span className={styles.langDot} />
                    <strong>{count}</strong>
                    <span>{lang}</span>
                  </button>
                ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by title or user name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />


        <div className={styles.dateRange}>
          <i className={`bi bi-calendar3 ${styles.calIcon}`} />
          <input
            className={styles.dateInput}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
          <span className={styles.dateSep}>–</span>
          <input
            className={styles.dateInput}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
        </div>

        {/* Active language filter pill — shown in the filter bar when a language chip is selected */}
        {language && (
          <div className={styles.activeLangPill}>
            <span className={styles.langDot} />
            {language}
            <button
              className={styles.activeLangClear}
              onClick={() => setLanguage("")}
              title="Clear language filter"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        )}

        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={clearFilters} title="Clear all filters">
            <i className="bi bi-x-circle" /> Clear
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading collections...</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchCollections}>Retry</button>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No collections found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {(
                  [
                    { key: "collection_id", label: "#"        },
                    { key: "title",         label: "Title"    },
                    { key: "language",      label: "Language" },
                    { key: "user_name",     label: "User"     },
                    { key: "url",           label: "URL"      },
                    { key: "status",        label: "Status"   },
                    { key: "num_files",     label: "Files"    },
                    { key: "created_at",    label: "Created"  },
                  ] as { key: SortKey; label: string }[]
                ).map(({ key, label }) => (
                  <th
                    key={key}
                    className={styles.sortableTh}
                    onClick={() => handleSort(key)}
                  >
                    <span className={styles.thInner}>
                      {label}
                      <span className={styles.sortIcon}>{sortIcon(key)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((col) => (
                <tr
                  key={col.collection_id}
                  className={styles.clickableRow}
                  onClick={(e) => handleRowClick(e, col.collection_id)}
                >
                  <td className={styles.idCell}>{col.collection_id}</td>
                  <td className={styles.titleCell}>{col.title}</td>
                  <td className={styles.langCell}>{col.language ?? "—"}</td>
                  <td className={styles.userCell}>{col.user_name}</td>
                  <td className={styles.urlCell}>{col.url}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[col.status]]}`}>
                      <i className={`bi ${STATUS_ICON[col.status]} ${col.status === "Processing" ? styles.spinIcon : ""}`} />
                      {col.status}
                    </span>
                  </td>
                  <td className={styles.numCell}>{col.num_files}</td>
                  <td className={styles.dateCell}>
                    {new Date(col.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
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