"use client";

import { useEffect, useState, useMemo, useCallback, useRef, MouseEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./userDetail.module.css";
import { BASE_URL } from "@/config/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collection {
  collection_id: number;
  title: string;
  description: string | null;
  language: string | null;
  url: string;
  status: "Queued" | "Processing" | "Completed" | "Partial" | "Failed";
  document_count: number;
  created_at: string;
  updated_at: string;
}

interface Job {
  job_id: number;
  collection_id: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  status: "Queued" | "Processing" | "Failed" | "Partial" | "Completed";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewTask {
  task_id: number;
  document_id: number | null;
  job_id: number | null;
  admin_id: number | null;
  annotator_id: number | null;
  user_reason: string;
  annotator_reason: string | null;
  status: "Pending" | "Assigned" | "InReview" | "Completed" | "Rejected";
  created_at: string;
  updated_at: string;
}

interface TierUpgradeRequest {
  request_id: number;
  admin_id: number | null;
  current_tier: "Basic" | "Pro" | "Premium";
  requested_tier: "Basic" | "Pro" | "Premium";
  user_reason: string;
  admin_note: string | null;
  status: "Pending" | "Approved" | "Rejected";
  created_at: string;
  updated_at: string;
}

interface UserDetail {
  user_id: string;
  name: string;
  email: string;
  profile_picture: string | null;
  is_active: boolean;
  tier: "Basic" | "Pro" | "Premium";
  priority: "Low" | "Medium" | "High" | "Critical";
  created_at: string;
  updated_at: string;
  collections: Collection[];
  jobs: Job[];
  review_tasks: ReviewTask[];
  tier_upgrade_requests: TierUpgradeRequest[];
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  key: string;
  direction: SortDirection;
}

interface DateRange {
  from: string;
  to: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIERS      = ["Basic", "Pro", "Premium"]           as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const COLLECTION_STATUSES = ["Queued", "Processing", "Completed", "Partial", "Failed"] as const;
const JOB_STATUSES        = ["Queued", "Processing", "Completed", "Partial", "Failed"] as const;
const REVIEW_STATUSES     = ["Pending", "Assigned", "InReview", "Completed", "Rejected"] as const;
const TIER_REQ_STATUSES   = ["Pending", "Approved", "Rejected"] as const;

const EMPTY_RANGE: DateRange = { from: "", to: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function compareValues(a: any, b: any): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "string" && typeof b === "string") {
    const da = Date.parse(a), db = Date.parse(b);
    if (!isNaN(da) && !isNaN(db)) return da - db;
    return a.localeCompare(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function inDateRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to   && day > range.to  ) return false;
  return true;
}

function isRangeActive(r: DateRange) { return !!(r.from || r.to); }

// ─── Status / tier / priority class maps ─────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  Queued:     styles.statusQueued,
  Processing: styles.statusProcessing,
  Completed:  styles.statusCompleted,
  Partial:    styles.statusPartial,
  Failed:     styles.statusFailed,
  Pending:    styles.statusQueued,
  Assigned:   styles.statusProcessing,
  InReview:   styles.statusProcessing,
  Approved:   styles.statusCompleted,
  Rejected:   styles.statusFailed,
};

const TIER_CLASS: Record<string, string> = {
  Basic:   styles.tierBasic,
  Pro:     styles.tierPro,
  Premium: styles.tierPremium,
};

const PRIORITY_CLASS: Record<string, string> = {
  Low:      styles.priorityLow,
  Medium:   styles.priorityMedium,
  High:     styles.priorityHigh,
  Critical: styles.priorityCritical,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, filtered }: { title: string; count: number; filtered: number }) {
  return (
    <div className={styles.sectionHeader}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <span className={styles.sectionCount}>
        {filtered < count ? `${filtered} / ${count}` : count}
      </span>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className={styles.emptyCell}>No records found.</td>
    </tr>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) return <span className={styles.sortIcon} aria-hidden>⇅</span>;
  return <span className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden>{direction === "asc" ? "↑" : "↓"}</span>;
}

function Th({
  label, sortKey, sort, onSort,
}: {
  label: string; sortKey: string; sort: SortState; onSort: (key: string) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`${styles.sortableTh}${active ? ` ${styles.sortableThActive}` : ""}`}
      onClick={() => onSort(sortKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSort(sortKey)}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className={styles.thInner}>
        {label}
        <SortIcon direction={active ? sort.direction : null} />
      </span>
    </th>
  );
}

function TableToolbar({
  search, onSearch, filters,
}: {
  search: string; onSearch: (v: string) => void; filters: React.ReactNode;
}) {
  return (
    <div className={styles.tableToolbar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => onSearch("")} aria-label="Clear search">×</button>
        )}
      </div>
      <div className={styles.filterRow}>{filters}</div>
    </div>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <select
      className={`${styles.filterSelect}${value ? ` ${styles.filterSelectActive}` : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: any) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = isRangeActive(value);

  const fmtDisplay = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${day} ${months[parseInt(m) - 1]} ${y}`;
  };

  const summaryText = () => {
    if (!active) return label;
    if (value.from && value.to) return `${fmtDisplay(value.from)} – ${fmtDisplay(value.to)}`;
    if (value.from) return `From ${fmtDisplay(value.from)}`;
    return `Until ${fmtDisplay(value.to)}`;
  };

  return (
    <div className={styles.datePickerWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.datePickerBtn}${active ? ` ${styles.datePickerBtnActive}` : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className={styles.datePickerIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <rect x="4" y="9.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="7.5" y="9.5" width="2" height="2" rx="0.4" fill="currentColor"/>
          <rect x="11" y="9.5" width="2" height="2" rx="0.4" fill="currentColor"/>
        </svg>
        <span className={styles.datePickerLabel}>{summaryText()}</span>
        {active && (
          <span
            className={styles.datePickerClear}
            role="button"
            tabIndex={0}
            aria-label="Clear date range"
            onClick={(e) => { e.stopPropagation(); onChange(EMPTY_RANGE); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(EMPTY_RANGE); setOpen(false); } }}
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className={styles.datePickerDropdown}>
          <p className={styles.datePickerDropdownLabel}>{label}</p>
          <div className={styles.datePickerFields}>
            <label className={styles.datePickerFieldLabel}>
              From
              <input
                type="date"
                className={styles.datePickerInput}
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </label>
            <label className={styles.datePickerFieldLabel}>
              To
              <input
                type="date"
                className={styles.datePickerInput}
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.datePickerActions}>
            <button
              className={styles.datePickerReset}
              onClick={() => onChange(EMPTY_RANGE)}
              disabled={!active}
            >
              Reset
            </button>
            <button className={styles.datePickerApply} onClick={() => setOpen(false)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom hook: sort + search ───────────────────────────────────────────────

function useSortSearch<T extends object>() {
  const [search, setSearch] = useState("");
  const [sort,   setSort  ] = useState<SortState>({ key: "updated_at", direction: "desc" });

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc")  return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: "", direction: null };
      return { key, direction: "asc" };
    });
  }, []);

  const sorted = useCallback(
    (filtered: T[]) => {
      if (!sort.key || !sort.direction) return filtered;
      return [...filtered].sort((a, b) => {
        const av = (a as any)[sort.key];
        const bv = (b as any)[sort.key];
        const cmp = compareValues(av, bv);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    },
    [sort]
  );

  return { search, setSearch, sort, toggleSort, sorted };
}

// ─── Mobile card components ───────────────────────────────────────────────────

function CollectionCard({ c, onClick }: { c: Collection; onClick: (e: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className={styles.mobileCard} onClick={onClick}>
      <div className={styles.mobileCardHeader}>
        <span className={styles.mobileCardId}>#{c.collection_id}</span>
        <span className={`${styles.statusBadge} ${STATUS_CLASS[c.status]}`}>{c.status}</span>
      </div>
      <div className={styles.mobileCardTitle}>{c.title}</div>
      {c.description && <div className={styles.mobileCardSub}>{c.description}</div>}
      <div className={styles.mobileCardMeta}>
        {c.language && <span className={styles.mobileMetaChip}>{c.language}</span>}
        <span className={styles.mobileMetaChip}>{c.document_count} docs</span>
        <span className={styles.mobileMetaDate}>Updated {fmt(c.updated_at)}</span>
      </div>
    </div>
  );
}

function JobCard({ j, onClick }: { j: Job; onClick: (e: MouseEvent<HTMLDivElement>) => void }) {
  const pct = j.total_tasks > 0 ? Math.round((j.completed_tasks / j.total_tasks) * 100) : 0;
  return (
    <div className={styles.mobileCard} onClick={onClick}>
      <div className={styles.mobileCardHeader}>
        <span className={styles.mobileCardId}>Job #{j.job_id}</span>
        <span className={`${styles.statusBadge} ${STATUS_CLASS[j.status]}`}>{j.status}</span>
      </div>
      <div className={styles.mobileCardMeta}>
        <span className={styles.mobileMetaChip}>Collection #{j.collection_id}</span>
        {j.failed_tasks > 0 && (
          <span className={`${styles.mobileMetaChip} ${styles.mobileMetaFailed}`}>{j.failed_tasks} failed</span>
        )}
      </div>
      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressLabel}>{j.completed_tasks}/{j.total_tasks}</span>
      </div>
      <div className={styles.mobileCardMeta}>
        <span className={styles.mobileMetaDate}>Updated {fmt(j.updated_at)}</span>
      </div>
    </div>
  );
}

function ReviewTaskCard({ t, onClick }: { t: ReviewTask; onClick: (e: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className={styles.mobileCard} onClick={onClick}>
      <div className={styles.mobileCardHeader}>
        <span className={styles.mobileCardId}>Task #{t.task_id}</span>
        <span className={`${styles.statusBadge} ${STATUS_CLASS[t.status]}`}>{t.status}</span>
      </div>
      <div className={styles.mobileCardReason}>{t.user_reason}</div>
      <div className={styles.mobileCardMeta}>
        {t.document_id && <span className={styles.mobileMetaChip}>Doc #{t.document_id}</span>}
        {t.job_id && <span className={styles.mobileMetaChip}>Job #{t.job_id}</span>}
        <span className={styles.mobileMetaDate}>Updated {fmt(t.updated_at)}</span>
      </div>
    </div>
  );
}

function TierRequestCard({ r, onClick }: { r: TierUpgradeRequest; onClick: (e: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className={styles.mobileCard} onClick={onClick}>
      <div className={styles.mobileCardHeader}>
        <span className={styles.mobileCardId}>Req #{r.request_id}</span>
        <span className={`${styles.statusBadge} ${STATUS_CLASS[r.status]}`}>{r.status}</span>
      </div>
      <div className={styles.mobileCardTierRow}>
        <span className={`${styles.statusBadge} ${TIER_CLASS[r.current_tier]}`}>{r.current_tier}</span>
        <span className={styles.mobileCardArrow}>→</span>
        <span className={`${styles.statusBadge} ${TIER_CLASS[r.requested_tier]}`}>{r.requested_tier}</span>
      </div>
      <div className={styles.mobileCardReason}>{r.user_reason}</div>
      <div className={styles.mobileCardMeta}>
        <span className={styles.mobileMetaDate}>Updated {fmt(r.updated_at)}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();

  const [data,    setData   ] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);

  const [tab, setTab] = useState<"collections" | "jobs" | "review_tasks" | "tier_requests">("collections");

  const [updatingTier,     setUpdatingTier    ] = useState(false);
  const [tierError,        setTierError       ] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [priorityError,    setPriorityError   ] = useState<string | null>(null);

  // ── Per-tab filter state ──
  const [colStatus,  setColStatus ] = useState("");
  const [colLang,    setColLang   ] = useState("");
  const [colCreated, setColCreated] = useState<DateRange>(EMPTY_RANGE);
  const [colUpdated, setColUpdated] = useState<DateRange>(EMPTY_RANGE);

  const [jobStatus,  setJobStatus ] = useState("");
  const [jobFailed,  setJobFailed ] = useState<"" | "yes">("");
  const [jobCreated, setJobCreated] = useState<DateRange>(EMPTY_RANGE);
  const [jobUpdated, setJobUpdated] = useState<DateRange>(EMPTY_RANGE);

  const [rvStatus,   setRvStatus  ] = useState("");
  const [rvCreated,  setRvCreated ] = useState<DateRange>(EMPTY_RANGE);
  const [rvUpdated,  setRvUpdated ] = useState<DateRange>(EMPTY_RANGE);

  const [trFrom,     setTrFrom    ] = useState("");
  const [trTo,       setTrTo      ] = useState("");
  const [trStatus,   setTrStatus  ] = useState("");
  const [trCreated,  setTrCreated ] = useState<DateRange>(EMPTY_RANGE);
  const [trUpdated,  setTrUpdated ] = useState<DateRange>(EMPTY_RANGE);

  // ── Sort/search hooks (one per tab) ──
  const col = useSortSearch<Collection>();
  const job = useSortSearch<Job>();
  const rv  = useSortSearch<ReviewTask>();
  const tr  = useSortSearch<TierUpgradeRequest>();

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement | HTMLDivElement>, targetPath: string) => {
    if ((e as any).ctrlKey || (e as any).metaKey) {
      window.open(targetPath, "_blank");
    } else {
      router.push(targetPath);
    }
  };

  async function patchUserField<K extends "tier" | "priority">(
    field: K,
    newValue: UserDetail[K],
    endpoint: string,
    setUpdating: (v: boolean) => void,
    setErr: (v: string | null) => void,
  ) {
    if (!data) return;
    const previousValue = data[field];
    setData((prev) => prev ? { ...prev, [field]: newValue } : prev);
    setUpdating(true);
    setErr(null);
    try {
      const res = await fetch(
        `${BASE_URL}/admin/users/${data.user_id}/${endpoint}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: newValue }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail ?? "Error " + res.status + ": " + res.statusText);
      }
    } catch (err: any) {
      setData((prev) => prev ? { ...prev, [field]: previousValue } : prev);
      setErr(err.message ?? "Failed to update " + field + ".");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    fetch(`${BASE_URL}/admin/users/${userId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error " + res.status + ": " + res.statusText);
        return res.json() as Promise<UserDetail>;
      })
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to fetch user."))
      .finally(() => setLoading(false));
  }, [userId]);

  const availableLanguages = useMemo(() => {
    if (!data) return [];
    const langs = [...new Set(data.collections.map((c) => c.language).filter(Boolean))] as string[];
    return langs.sort();
  }, [data]);

  // ── Filtered + sorted data ──
  const filteredCollections = useMemo(() => {
    if (!data) return [];
    const rows = data.collections.filter((c) => {
      const q = col.search.toLowerCase();
      const matchSearch = !q || [
        String(c.collection_id), c.title, c.description ?? "", c.language ?? "", c.url, c.status,
      ].some((v) => v.toLowerCase().includes(q));
      return (
        matchSearch &&
        (!colStatus || c.status    === colStatus) &&
        (!colLang   || c.language  === colLang  ) &&
        inDateRange(c.created_at, colCreated) &&
        inDateRange(c.updated_at, colUpdated)
      );
    });
    return col.sorted(rows);
  }, [data, col.search, col.sort, colStatus, colLang, colCreated, colUpdated]);

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    const rows = data.jobs.filter((j) => {
      const q = job.search.toLowerCase();
      const matchSearch = !q || [
        String(j.job_id), String(j.collection_id), j.status,
      ].some((v) => v.toLowerCase().includes(q));
      return (
        matchSearch &&
        (!jobStatus || j.status         === jobStatus) &&
        (!jobFailed || (jobFailed === "yes" && j.failed_tasks > 0)) &&
        inDateRange(j.created_at, jobCreated) &&
        inDateRange(j.updated_at, jobUpdated)
      );
    });
    return job.sorted(rows);
  }, [data, job.search, job.sort, jobStatus, jobFailed, jobCreated, jobUpdated]);

  const filteredReviewTasks = useMemo(() => {
    if (!data) return [];
    const rows = data.review_tasks.filter((t) => {
      const q = rv.search.toLowerCase();
      const matchSearch = !q || [
        String(t.task_id), String(t.document_id ?? ""), String(t.job_id ?? ""),
        t.user_reason, t.annotator_reason ?? "", t.status,
      ].some((v) => v.toLowerCase().includes(q));
      return (
        matchSearch &&
        (!rvStatus || t.status === rvStatus) &&
        inDateRange(t.created_at, rvCreated) &&
        inDateRange(t.updated_at, rvUpdated)
      );
    });
    return rv.sorted(rows);
  }, [data, rv.search, rv.sort, rvStatus, rvCreated, rvUpdated]);

  const filteredTierRequests = useMemo(() => {
    if (!data) return [];
    const rows = data.tier_upgrade_requests.filter((r) => {
      const q = tr.search.toLowerCase();
      const matchSearch = !q || [
        String(r.request_id), r.current_tier, r.requested_tier,
        r.user_reason, r.admin_note ?? "", r.status,
      ].some((v) => v.toLowerCase().includes(q));
      return (
        matchSearch &&
        (!trFrom   || r.current_tier   === trFrom  ) &&
        (!trTo     || r.requested_tier === trTo    ) &&
        (!trStatus || r.status         === trStatus) &&
        inDateRange(r.created_at, trCreated) &&
        inDateRange(r.updated_at, trUpdated)
      );
    });
    return tr.sorted(rows);
  }, [data, tr.search, tr.sort, trFrom, trTo, trStatus, trCreated, trUpdated]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateWrap}>
          <span className={styles.spinner} />
          <p>Loading user...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.stateWrap}>
          <p className={styles.errorText}>{error ?? "User not found."}</p>
          <button className={styles.retryBtn} onClick={() => router.back()}>Back</button>
        </div>
      </div>
    );
  }

  const colHasFilters = colStatus || colLang || isRangeActive(colCreated) || isRangeActive(colUpdated);
  const jobHasFilters = jobStatus || jobFailed || isRangeActive(jobCreated) || isRangeActive(jobUpdated);
  const rvHasFilters  = rvStatus  || isRangeActive(rvCreated) || isRangeActive(rvUpdated);
  const trHasFilters  = trFrom || trTo || trStatus || isRangeActive(trCreated) || isRangeActive(trUpdated);

  return (
    <div className={styles.page}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Users</span>
        </button>
        <h2 className={styles.title}>User Detail</h2>
      </div>

      {/* ── Profile card ── */}
      <div className={styles.profileSection}>
        <div className={styles.profileCard}>

          <div className={styles.avatarBlock}>
            {data.profile_picture ? (
              <img src={data.profile_picture} alt={data.name} className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>{initials(data.name)}</div>
            )}
            <div className={styles.avatarInfo}>
              <p className={styles.profileName}>{data.name}</p>
              <p className={styles.profileEmail}>{data.email}</p>
              <p className={styles.profileId}>{data.user_id}</p>
            </div>
          </div>

          <div className={styles.profileDivider} />

          <div className={styles.profileMeta}>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Status</span>
              <span className={`${styles.badge} ${data.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                {data.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Tier</span>
              <div className={styles.editableFieldWrap}>
                <div className={styles.tierSelectWrap}>
                  <select
                    className={`${styles.tierSelect} ${TIER_CLASS[data.tier]}`}
                    value={data.tier}
                    disabled={updatingTier}
                    onChange={(e) =>
                      patchUserField("tier", e.target.value as UserDetail["tier"], "tier", setUpdatingTier, setTierError)
                    }
                  >
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className={styles.tierArrow}>&#9660;</span>
                </div>
                {updatingTier && <span className={styles.fieldSpinner} />}
                {tierError    && <span className={styles.fieldErrorDot} title={tierError} />}
              </div>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Priority</span>
              <div className={styles.editableFieldWrap}>
                <div className={styles.tierSelectWrap}>
                  <select
                    className={`${styles.tierSelect} ${PRIORITY_CLASS[data.priority]}`}
                    value={data.priority}
                    disabled={updatingPriority}
                    onChange={(e) =>
                      patchUserField("priority", e.target.value as UserDetail["priority"], "priority", setUpdatingPriority, setPriorityError)
                    }
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className={styles.tierArrow}>&#9660;</span>
                </div>
                {updatingPriority && <span className={styles.fieldSpinner} />}
                {priorityError   && <span className={styles.fieldErrorDot} title={priorityError} />}
              </div>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Joined</span>
              <span className={styles.metaValue}>{fmt(data.created_at)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Last updated</span>
              <span className={styles.metaValue}>{fmtDateTime(data.updated_at)}</span>
            </div>

          </div>

          <div className={styles.profileDivider} />

          <div className={styles.statRow}>
            {(
              [
                { key: "collections",   label: "Collections",   count: data.collections.length },
                { key: "jobs",          label: "Jobs",          count: data.jobs.length },
                { key: "review_tasks",  label: "Review tasks",  count: data.review_tasks.length },
                { key: "tier_requests", label: "Tier requests", count: data.tier_upgrade_requests.length },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                className={`${styles.statCard}${tab === key ? ` ${styles.statCardActive}` : ""}`}
                onClick={() => setTab(key)}
              >
                <span className={styles.statNum}>{count}</span>
                <span className={styles.statLabel}>{label}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabBarWrap}>
        <div className={styles.tabBar}>
          {(
            [
              { key: "collections",   label: "Collections",   count: data.collections.length },
              { key: "jobs",          label: "Jobs",          count: data.jobs.length },
              { key: "review_tasks",  label: "Review Tasks",  count: data.review_tasks.length },
              { key: "tier_requests", label: "Tier Requests", count: data.tier_upgrade_requests.length },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              className={`${styles.tabBtn}${tab === key ? ` ${styles.tabBtnActive}` : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab panels ── */}
      <div className={styles.tableWrap}>

        {/* ══ Collections ══ */}
        {tab === "collections" && (
          <>
            <SectionHeader title="Collections" count={data.collections.length} filtered={filteredCollections.length} />

            <TableToolbar
              search={col.search}
              onSearch={col.setSearch}
              filters={
                <>
                  <FilterSelect label="Status"   value={colStatus} options={COLLECTION_STATUSES} onChange={setColStatus} />
                  {availableLanguages.length > 0 && (
                    <FilterSelect label="Language" value={colLang} options={availableLanguages} onChange={setColLang} />
                  )}
                  <DateRangePicker label="Created" value={colCreated} onChange={setColCreated} />
                  <DateRangePicker label="Updated" value={colUpdated} onChange={setColUpdated} />
                  {colHasFilters && (
                    <button className={styles.clearFiltersBtn} onClick={() => {
                      setColStatus(""); setColLang(""); setColCreated(EMPTY_RANGE); setColUpdated(EMPTY_RANGE);
                    }}>
                      Clear all
                    </button>
                  )}
                </>
              }
            />

            {/* Desktop table */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <Th label="ID"       sortKey="collection_id"  sort={col.sort} onSort={col.toggleSort} />
                    <Th label="Title"    sortKey="title"          sort={col.sort} onSort={col.toggleSort} />
                    <Th label="Language" sortKey="language"       sort={col.sort} onSort={col.toggleSort} />
                    <Th label="Docs"     sortKey="document_count" sort={col.sort} onSort={col.toggleSort} />
                    <th>URL</th>
                    <Th label="Status"   sortKey="status"         sort={col.sort} onSort={col.toggleSort} />
                    <Th label="Created"  sortKey="created_at"     sort={col.sort} onSort={col.toggleSort} />
                    <Th label="Updated"  sortKey="updated_at"     sort={col.sort} onSort={col.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.length === 0 ? <EmptyRow cols={8} /> : (
                    filteredCollections.map((c) => (
                      <tr
                        key={c.collection_id}
                        className={styles.clickableRow}
                        onClick={(e) => handleRowClick(e, `/dashboard/collections/${c.collection_id}`)}
                      >
                        <td className={styles.idCell}>{c.collection_id}</td>
                        <td className={styles.nameCell}>
                          <span title={c.description ?? ""}>{c.title}</span>
                          {c.description && <span className={styles.subText}>{c.description}</span>}
                        </td>
                        <td>{c.language ?? "—"}</td>
                        <td className={styles.numCell}>{c.document_count}</td>
                        <td className={styles.urlCell}>
                          <span className={styles.urlText}>{c.url}</span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${STATUS_CLASS[c.status]}`}>{c.status}</span>
                        </td>
                        <td className={styles.dateCell}>{fmt(c.created_at)}</td>
                        <td className={styles.dateCell}>{fmt(c.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className={styles.mobileCardList}>
              {filteredCollections.length === 0 ? (
                <div className={styles.mobileEmpty}>No records found.</div>
              ) : (
                filteredCollections.map((c) => (
                  <CollectionCard
                    key={c.collection_id}
                    c={c}
                    onClick={(e) => handleRowClick(e, `/dashboard/collections/${c.collection_id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ══ Jobs ══ */}
        {tab === "jobs" && (
          <>
            <SectionHeader title="Jobs" count={data.jobs.length} filtered={filteredJobs.length} />

            <TableToolbar
              search={job.search}
              onSearch={job.setSearch}
              filters={
                <>
                  <FilterSelect label="Status" value={jobStatus} options={JOB_STATUSES} onChange={setJobStatus} />
                  <select
                    className={`${styles.filterSelect}${jobFailed ? ` ${styles.filterSelectActive}` : ""}`}
                    value={jobFailed}
                    onChange={(e) => setJobFailed(e.target.value as "" | "yes")}
                  >
                    <option value="">Failed tasks: Any</option>
                    <option value="yes">Has failures</option>
                  </select>
                  <DateRangePicker label="Created" value={jobCreated} onChange={setJobCreated} />
                  <DateRangePicker label="Updated" value={jobUpdated} onChange={setJobUpdated} />
                  {jobHasFilters && (
                    <button className={styles.clearFiltersBtn} onClick={() => {
                      setJobStatus(""); setJobFailed(""); setJobCreated(EMPTY_RANGE); setJobUpdated(EMPTY_RANGE);
                    }}>
                      Clear all
                    </button>
                  )}
                </>
              }
            />

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <Th label="Job ID"     sortKey="job_id"          sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Collection" sortKey="collection_id"   sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Tasks"      sortKey="total_tasks"     sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Completed"  sortKey="completed_tasks" sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Failed"     sortKey="failed_tasks"    sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Status"     sortKey="status"          sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Created"    sortKey="created_at"      sort={job.sort} onSort={job.toggleSort} />
                    <Th label="Updated"    sortKey="updated_at"      sort={job.sort} onSort={job.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 ? <EmptyRow cols={8} /> : (
                    filteredJobs.map((j) => (
                      <tr
                        key={j.job_id}
                        className={styles.clickableRow}
                        onClick={(e) => handleRowClick(e, `/dashboard/jobs/${j.job_id}`)}
                      >
                        <td className={styles.idCell}>{j.job_id}</td>
                        <td className={styles.idCell}>{j.collection_id}</td>
                        <td className={styles.numCell}>{j.total_tasks}</td>
                        <td className={styles.numCell}>{j.completed_tasks}</td>
                        <td className={`${styles.numCell}${j.failed_tasks > 0 ? ` ${styles.errorText}` : ""}`}>
                          {j.failed_tasks}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${STATUS_CLASS[j.status]}`}>{j.status}</span>
                        </td>
                        <td className={styles.dateCell}>{fmt(j.created_at)}</td>
                        <td className={styles.dateCell}>{fmt(j.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileCardList}>
              {filteredJobs.length === 0 ? (
                <div className={styles.mobileEmpty}>No records found.</div>
              ) : (
                filteredJobs.map((j) => (
                  <JobCard
                    key={j.job_id}
                    j={j}
                    onClick={(e) => handleRowClick(e, `/dashboard/jobs/${j.job_id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ══ Review Tasks ══ */}
        {tab === "review_tasks" && (
          <>
            <SectionHeader title="Review Tasks" count={data.review_tasks.length} filtered={filteredReviewTasks.length} />

            <TableToolbar
              search={rv.search}
              onSearch={rv.setSearch}
              filters={
                <>
                  <FilterSelect label="Status" value={rvStatus} options={REVIEW_STATUSES} onChange={setRvStatus} />
                  <DateRangePicker label="Created" value={rvCreated} onChange={setRvCreated} />
                  <DateRangePicker label="Updated" value={rvUpdated} onChange={setRvUpdated} />
                  {rvHasFilters && (
                    <button className={styles.clearFiltersBtn} onClick={() => {
                      setRvStatus(""); setRvCreated(EMPTY_RANGE); setRvUpdated(EMPTY_RANGE);
                    }}>
                      Clear all
                    </button>
                  )}
                </>
              }
            />

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <Th label="Task ID"  sortKey="task_id"     sort={rv.sort} onSort={rv.toggleSort} />
                    <Th label="Doc ID"   sortKey="document_id" sort={rv.sort} onSort={rv.toggleSort} />
                    <Th label="Job ID"   sortKey="job_id"      sort={rv.sort} onSort={rv.toggleSort} />
                    <th>User Reason</th>
                    <Th label="Status"   sortKey="status"      sort={rv.sort} onSort={rv.toggleSort} />
                    <Th label="Created"  sortKey="created_at"  sort={rv.sort} onSort={rv.toggleSort} />
                    <Th label="Updated"  sortKey="updated_at"  sort={rv.sort} onSort={rv.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredReviewTasks.length === 0 ? <EmptyRow cols={7} /> : (
                    filteredReviewTasks.map((t) => (
                      <tr
                        key={t.task_id}
                        className={styles.clickableRow}
                        onClick={(e) => handleRowClick(e, `/dashboard/tasks/${t.task_id}`)}
                      >
                        <td className={styles.idCell}>{t.task_id}</td>
                        <td className={styles.idCell}>{t.document_id ?? "—"}</td>
                        <td className={styles.idCell}>{t.job_id ?? "—"}</td>
                        <td className={styles.nameCell} title={t.user_reason}>
                          <span className={styles.truncateText}>{t.user_reason}</span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${STATUS_CLASS[t.status]}`}>{t.status}</span>
                        </td>
                        <td className={styles.dateCell}>{fmt(t.created_at)}</td>
                        <td className={styles.dateCell}>{fmt(t.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileCardList}>
              {filteredReviewTasks.length === 0 ? (
                <div className={styles.mobileEmpty}>No records found.</div>
              ) : (
                filteredReviewTasks.map((t) => (
                  <ReviewTaskCard
                    key={t.task_id}
                    t={t}
                    onClick={(e) => handleRowClick(e, `/dashboard/tasks/${t.task_id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ══ Tier Requests ══ */}
        {tab === "tier_requests" && (
          <>
            <SectionHeader title="Tier Upgrade Requests" count={data.tier_upgrade_requests.length} filtered={filteredTierRequests.length} />

            <TableToolbar
              search={tr.search}
              onSearch={tr.setSearch}
              filters={
                <>
                  <FilterSelect label="From Tier" value={trFrom} options={TIERS} onChange={setTrFrom} />
                  <FilterSelect label="To Tier"   value={trTo} options={TIERS} onChange={setTrTo} />
                  <FilterSelect label="Status"    value={trStatus} options={TIER_REQ_STATUSES} onChange={setTrStatus} />
                  <DateRangePicker label="Created" value={trCreated} onChange={setTrCreated} />
                  <DateRangePicker label="Updated" value={trUpdated} onChange={setTrUpdated} />
                  {trHasFilters && (
                    <button className={styles.clearFiltersBtn} onClick={() => {
                      setTrFrom(""); setTrTo(""); setTrStatus(""); setTrCreated(EMPTY_RANGE); setTrUpdated(EMPTY_RANGE);
                    }}>
                      Clear all
                    </button>
                  )}
                </>
              }
            />

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <Th label="Req ID"    sortKey="request_id"     sort={tr.sort} onSort={tr.toggleSort} />
                    <Th label="Current"   sortKey="current_tier"   sort={tr.sort} onSort={tr.toggleSort} />
                    <Th label="Requested" sortKey="requested_tier" sort={tr.sort} onSort={tr.toggleSort} />
                    <th>Reason</th>
                    <Th label="Status"    sortKey="status"         sort={tr.sort} onSort={tr.toggleSort} />
                    <Th label="Created"   sortKey="created_at"     sort={tr.sort} onSort={tr.toggleSort} />
                    <Th label="Updated"   sortKey="updated_at"     sort={tr.sort} onSort={tr.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredTierRequests.length === 0 ? <EmptyRow cols={7} /> : (
                    filteredTierRequests.map((r) => (
                      <tr
                        key={r.request_id}
                        className={styles.clickableRow}
                        onClick={(e) => handleRowClick(e, `/dashboard/tier-requests/${r.request_id}`)}
                      >
                        <td className={styles.idCell}>{r.request_id}</td>
                        <td><span className={`${styles.statusBadge} ${TIER_CLASS[r.current_tier]}`}>{r.current_tier}</span></td>
                        <td><span className={`${styles.statusBadge} ${TIER_CLASS[r.requested_tier]}`}>{r.requested_tier}</span></td>
                        <td className={styles.nameCell} title={r.user_reason}>
                          <span className={styles.truncateText}>{r.user_reason}</span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                        </td>
                        <td className={styles.dateCell}>{fmt(r.created_at)}</td>
                        <td className={styles.dateCell}>{fmt(r.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileCardList}>
              {filteredTierRequests.length === 0 ? (
                <div className={styles.mobileEmpty}>No records found.</div>
              ) : (
                filteredTierRequests.map((r) => (
                  <TierRequestCard
                    key={r.request_id}
                    r={r}
                    onClick={(e) => handleRowClick(e, `/dashboard/tier-requests/${r.request_id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}