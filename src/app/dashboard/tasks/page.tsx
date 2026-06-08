"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./tasks.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskSummary {
  task_id: number;
  document_id: number | null;
  requested_by: string;
  user_reason: string;
  status: "Pending" | "Assigned" | "InReview" | "Completed" | "Rejected";
  created_at: string;
  annotator_name: string | null;
  annotator_id: number | null;
  language: string | null;
}

interface PaginatedTasks {
  total: number;
  limit: number;
  offset: number;
  data: TaskSummary[];
}

interface ActiveAnnotator {
  annotator_id: number;
  name: string;
}

type StatusKey = "Pending" | "Assigned" | "InReview" | "Completed" | "Rejected" | "Unknown";
type StatusCounts = Record<StatusKey, number>;
type SortKey = keyof TaskSummary;
type SortDir = "asc" | "desc";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_PILLS: { key: StatusKey; label: string; icon: string }[] = [
  { key: "Pending",   label: "Pending",   icon: "bi-hourglass-split"   },
  { key: "Assigned",  label: "Assigned",  icon: "bi-person-check"      },
  { key: "InReview",  label: "In Review", icon: "bi-eye"               },
  { key: "Completed", label: "Completed", icon: "bi-check-circle-fill" },
  { key: "Rejected",  label: "Rejected",  icon: "bi-x-circle-fill"     },
  { key: "Unknown",   label: "Unknown",   icon: "bi-question-circle"   },
];

const STATUS_STYLES: Record<string, { cls: string; icon: string }> = {
  Pending:   { cls: "statusPending",   icon: "bi-hourglass-split"   },
  Assigned:  { cls: "statusAssigned",  icon: "bi-person-check"      },
  InReview:  { cls: "statusInReview",  icon: "bi-eye"               },
  Completed: { cls: "statusCompleted", icon: "bi-check-circle-fill" },
  Rejected:  { cls: "statusRejected",  icon: "bi-x-circle-fill"     },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();

  const [data, setData]           = useState<PaginatedTasks | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Set<number>>(new Set());

  const [annotatorsByLang, setAnnotatorsByLang] = useState<Map<string, ActiveAnnotator[]>>(new Map());
  const fetchedLangs = useRef<Set<string>>(new Set());

  // Filters — status defaults to "Pending"
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState<StatusKey>("Pending");
  const [language, setLanguage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [page, setPage]         = useState(1);

  // Status counts
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    Pending: 0, Assigned: 0, InReview: 0, Completed: 0, Rejected: 0, Unknown: 0,
  });

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Languages dropdown
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  const isUnknown = status === "Unknown";

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  // ── Fetch status counts ─────────────────────────────────────────────────────

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/admin/tasks/status-counts`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json: StatusCounts = await res.json();
      setStatusCounts(json);
    } catch {}
  }, []);

  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);

  // ── Fetch available languages (once on mount) ───────────────────────────────

  useEffect(() => {
    fetch(`${BASE_URL}/admin/tasks/languages`, { credentials: "include" })
      .then((r) => r.json())
      .then((langs: string[]) => setAvailableLanguages(langs))
      .catch(() => {});
  }, []);

  // ── Fetch annotators (per language, cached) ─────────────────────────────────

  useEffect(() => {
    if (!data?.data.length) return;

    if (isUnknown) return;

    const uniqueLangs = [
      ...new Set(data.data.map((t) => t.language).filter(Boolean) as string[]),
    ];
    const toFetch = uniqueLangs.filter((l) => !fetchedLangs.current.has(l));
    if (!toFetch.length) return;

    toFetch.forEach(async (lang) => {
      fetchedLangs.current.add(lang);
      try {
        const res = await fetch(
          `${BASE_URL}/admin/annotators/active?language=${encodeURIComponent(lang)}`,
          { credentials: "include" }
        );
        if (!res.ok) { fetchedLangs.current.delete(lang); return; }
        const json: ActiveAnnotator[] = await res.json();
        setAnnotatorsByLang((prev) => new Map(prev).set(lang, json));
      } catch {
        fetchedLangs.current.delete(lang);
      }
    });
  }, [data, isUnknown]);

  // ── Fetch tasks ─────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search)   params.set("search",    search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo)   params.set("date_to",   dateTo);

    let endpoint: string;
    if (isUnknown) {
      endpoint = `${BASE_URL}/admin/tasks/unknown?${params.toString()}`;
    } else {
      params.set("status", status);
      if (language) params.set("language", language);
      endpoint = `${BASE_URL}/admin/tasks?${params.toString()}`;
    }

    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, language, dateFrom, dateTo, isUnknown]);

  useEffect(() => { setPage(1); }, [search, status, language, dateFrom, dateTo]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key)
      return <i className="bi bi-chevron-expand" style={{ opacity: 0.35 }} />;
    return sortDir === "asc"
      ? <i className="bi bi-chevron-up" />
      : <i className="bi bi-chevron-down" />;
  };

  // ── Assign / Re-assign ──────────────────────────────────────────────────────

  const handleAssign = async (
    e: React.MouseEvent,
    task_id: number,
    annotator_id: number,
    lang: string | null
  ) => {
    e.stopPropagation();
    setAssigning((prev) => new Set(prev).add(task_id));

    try {
      const res = await fetch(`${BASE_URL}/admin/tasks/assign/${task_id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotator_id }),
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.detail ?? `Failed to assign task #${task_id}`);
        return;
      }

      const annotatorList = lang ? (annotatorsByLang.get(lang) ?? []) : [];
      const annotator = annotatorList.find((a) => a.annotator_id === annotator_id);

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((t) =>
            t.task_id === task_id
              ? { ...t, status: "Assigned", annotator_name: annotator?.name ?? "Unknown", annotator_id }
              : t
          ),
        };
      });

      fetchStatusCounts();
    } catch (err: any) {
      alert(err.message ?? "Something went wrong.");
    } finally {
      setAssigning((prev) => {
        const next = new Set(prev);
        next.delete(task_id);
        return next;
      });
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages       = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const hasActiveFilters = search || (!isUnknown && language) || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch("");
    setLanguage("");
    setDateFrom("");
    setDateTo("");
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: { key: SortKey; label: string }[] = [
    { key: "task_id",        label: "Task ID"      },
    { key: "document_id",    label: "Doc ID"       },
    { key: "language",       label: "Language"     },
    { key: "requested_by",   label: "Requested By" },
    { key: "user_reason",    label: "Reason"       },
    { key: "status",         label: "Status"       },
    { key: "annotator_name", label: "Assigned To"  },
    { key: "created_at",     label: "Created"      },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.title}>Tasks</h2>
          {data && (
            <span className={styles.totalBadge}>{data.total} total</span>
          )}
        </div>
      </div>

      {/* ── Status Pills ────────────────────────────────────────────────── */}
      <div className={styles.pillBar}>
        {STATUS_PILLS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`${styles.pill} ${styles[`pill${key}`]} ${status === key ? styles.pillActive : ""}`}
            onClick={() => setStatus(key)}
          >
            <i className={`bi ${icon}`} />
            {label}
            <span className={styles.pillCount}>{statusCounts[key]}</span>
          </button>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className={styles.filters}>

        {/* Search */}
        <div className={styles.searchWrap}>
          <i className={`bi bi-search ${styles.searchIcon}`} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by user, reason or doc ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch("")} title="Clear search">
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        {/* Language filter — hidden for Unknown tab */}
        {!isUnknown && (
          <select
            className={styles.select}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="">All Languages</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        )}

        {/* Date range filter */}
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

        {/* Clear filters */}
        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>
            <i className="bi bi-x-circle" /> Clear
          </button>
        )}

        {/* Result count */}
        {data && (
          <span className={styles.resultCount}>
            Showing {sortedRows.length} of {data.total}
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading tasks...</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchTasks}>Retry</button>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No tasks found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map(({ key, label }) => (
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
              {sortedRows.map((task) => {
                const s           = STATUS_STYLES[task.status] ?? STATUS_STYLES["Pending"];
                const isAssigning = assigning.has(task.task_id);
                const taskAnnotators = task.language ? (annotatorsByLang.get(task.language) ?? []) : [];
                const resolvedAnnotatorId =
                  task.annotator_id
                  ?? taskAnnotators.find((a) => a.name === task.annotator_name)?.annotator_id
                  ?? "";

                return (
                  <tr
                    key={task.task_id}
                    className={styles.clickableRow}
                    onClick={(e) => handleNavigation(e, `/dashboard/tasks/${task.task_id}`)}
                  >
                    <td className={styles.idCell}>#{task.task_id}</td>

                    <td className={styles.docIdCell}>
                      {task.document_id != null ? `#${task.document_id}` : (
                        <span className={styles.nullCell}>—</span>
                      )}
                    </td>

                    <td className={styles.langCell}>
                      {task.language ? (
                        <span className={styles.langBadge}>{task.language}</span>
                      ) : (
                        <span className={styles.nullCell}>—</span>
                      )}
                    </td>

                    <td className={styles.userCell}>{task.requested_by}</td>
                    <td className={styles.reasonCell}>
                      <span title={task.user_reason}>{task.user_reason}</span>
                    </td>

                    <td>
                      <span className={`${styles.statusBadge} ${styles[s.cls]}`}>
                        <i className={`bi ${s.icon}`} />
                        {task.status === "InReview" ? "In Review" : task.status}
                      </span>
                    </td>

                    {/* Assigned To — plain text for Unknown, dropdown for others */}
                    <td
                      className={styles.assignCell}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isUnknown ? (
                        task.annotator_name ? (
                          <span className={styles.annotatorName}>
                            <i className="bi bi-person-fill" style={{ marginRight: 6 }} />
                            {task.annotator_name}
                          </span>
                        ) : (
                          <span className={styles.nullCell}>—</span>
                        )
                      ) : isAssigning ? (
                        <span className={styles.assignSpinner} />
                      ) : (
                        <select
                          className={`${styles.assignDropdown} ${resolvedAnnotatorId ? styles.assignDropdownAssigned : ""}`}
                          value={resolvedAnnotatorId}
                          disabled={taskAnnotators.length === 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) handleAssign(e as any, task.task_id, Number(val), task.language);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!resolvedAnnotatorId && (
                            <option value="" disabled>
                              {task.language
                                ? taskAnnotators.length === 0 ? "Loading…" : "— Assign —"
                                : "No language"
                              }
                            </option>
                          )}
                          {taskAnnotators.map((a) => (
                            <option key={a.annotator_id} value={a.annotator_id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className={styles.dateCell}>
                      {new Date(task.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
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