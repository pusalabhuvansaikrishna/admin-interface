"use client";

import { useEffect, useState, useCallback, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./users.module.css";
import { BASE_URL } from "@/config/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserSummary {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  tier: "Basic" | "Pro" | "Premium";
  priority: "Low" | "Medium" | "High" | "Critical";
  created_at: string;
  num_collections: number;
  total_files: number;
}

interface PaginatedUsers {
  total: number;
  limit: number;
  offset: number;
  data: UserSummary[];
}

interface TierCounts     { Basic: number; Pro: number; Premium: number; }
interface PriorityCounts { Low: number; Medium: number; High: number; Critical: number; }

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE  = 20;
const TIERS      = ["Basic", "Pro", "Premium"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const TIER_COLORS: Record<string, string> = {
  Basic:   styles.tierBasic,
  Pro:     styles.tierPro,
  Premium: styles.tierPremium,
};

const PRIORITY_COLORS: Record<string, string> = {
  Low:      styles.priorityLow,
  Medium:   styles.priorityMedium,
  High:     styles.priorityHigh,
  Critical: styles.priorityCritical,
};

const TIER_CARD_META: Record<"Basic" | "Pro" | "Premium", { label: string; cardClass: string }> = {
  Basic:   { label: "Basic",   cardClass: styles.tierCardBasic   },
  Pro:     { label: "Pro",     cardClass: styles.tierCardPro     },
  Premium: { label: "Premium", cardClass: styles.tierCardPremium },
};

const PRIORITY_CARD_META: Record<"Low" | "Medium" | "High" | "Critical", { label: string; cardClass: string }> = {
  Low:      { label: "Low",      cardClass: styles.priorityCardLow      },
  Medium:   { label: "Medium",   cardClass: styles.priorityCardMedium   },
  High:     { label: "High",     cardClass: styles.priorityCardHigh     },
  Critical: { label: "Critical", cardClass: styles.priorityCardCritical },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const router = useRouter();

  const [data, setData]       = useState<PaginatedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Tier counts
  const [tierCounts, setTierCounts]               = useState<TierCounts>({ Basic: 0, Pro: 0, Premium: 0 });
  const [tierCountsLoading, setTierCountsLoading] = useState(true);

  // Priority counts
  const [priorityCounts, setPriorityCounts]               = useState<PriorityCounts>({ Low: 0, Medium: 0, High: 0, Critical: 0 });
  const [priorityCountsLoading, setPriorityCountsLoading] = useState(true);

  // Filters
  const [search, setSearch]                 = useState("");
  const [isActive, setIsActive]             = useState<string>("");
  const [tier, setTier]                     = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Per-row tier update state
  const [updatingTier, setUpdatingTier] = useState<Record<string, boolean>>({});
  const [tierError, setTierError]       = useState<Record<string, string>>({});

  // Per-row priority update state
  const [updatingPriority, setUpdatingPriority] = useState<Record<string, boolean>>({});
  const [priorityError, setPriorityError]       = useState<Record<string, string>>({});

  // ─── Fetch tier counts ───────────────────────────────────────────────────

  const fetchTierCounts = useCallback(async () => {
    setTierCountsLoading(true);
    try {
      const [basicRes, proRes, premiumRes] = await Promise.all(
        (["Basic", "Pro", "Premium"] as const).map((t) =>
          fetch(`${BASE_URL}/admin/users?limit=1&offset=0&tier=${t}`, { credentials: "include" })
            .then((r) => r.json() as Promise<PaginatedUsers>)
        )
      );
      setTierCounts({ Basic: basicRes.total, Pro: proRes.total, Premium: premiumRes.total });
    } catch { /* silently fail */ } finally {
      setTierCountsLoading(false);
    }
  }, []);

  // ─── Fetch priority counts ───────────────────────────────────────────────

  const fetchPriorityCounts = useCallback(async () => {
    setPriorityCountsLoading(true);
    try {
      const [lowRes, medRes, highRes, critRes] = await Promise.all(
        (["Low", "Medium", "High", "Critical"] as const).map((p) =>
          fetch(`${BASE_URL}/admin/users?limit=1&offset=0&priority=${p}`, { credentials: "include" })
            .then((r) => r.json() as Promise<PaginatedUsers>)
        )
      );
      setPriorityCounts({ Low: lowRes.total, Medium: medRes.total, High: highRes.total, Critical: critRes.total });
    } catch { /* silently fail */ } finally {
      setPriorityCountsLoading(false);
    }
  }, []);

  // ─── Fetch paginated users ───────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search)         params.set("search",         search);
    if (isActive)       params.set("is_active",      isActive);
    if (tier)           params.set("tier",           tier);
    if (priorityFilter) params.set("priority",       priorityFilter);
    if (dateFrom)       params.set("created_after",  new Date(dateFrom).toISOString());
    if (dateTo)         params.set("created_before", new Date(dateTo).toISOString());

    try {
      const res = await fetch(`${BASE_URL}/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  }, [page, search, isActive, tier, priorityFilter, dateFrom, dateTo]);

  // ─── Tier update ─────────────────────────────────────────────────────────

  const handleTierChange = async (userId: string, newTier: string) => {
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.map((u) => u.user_id === userId ? { ...u, tier: newTier as UserSummary["tier"] } : u) }
        : prev
    );
    setUpdatingTier((prev) => ({ ...prev, [userId]: true }));
    setTierError((prev)    => ({ ...prev, [userId]: ""  }));

    try {
      const res = await fetch(`${BASE_URL}/admin/users/${userId}/tier`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail ?? `Error ${res.status}: ${res.statusText}`);
      }
      fetchTierCounts();
    } catch (err: any) {
      fetchUsers();
      setTierError((prev) => ({ ...prev, [userId]: err.message ?? "Failed to update tier." }));
    } finally {
      setUpdatingTier((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // ─── Priority update ─────────────────────────────────────────────────────

  const handlePriorityChange = async (userId: string, newPriority: string) => {
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.map((u) => u.user_id === userId ? { ...u, priority: newPriority as UserSummary["priority"] } : u) }
        : prev
    );
    setUpdatingPriority((prev) => ({ ...prev, [userId]: true }));
    setPriorityError((prev)    => ({ ...prev, [userId]: ""  }));

    try {
      const res = await fetch(`${BASE_URL}/admin/users/${userId}/priority`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail ?? `Error ${res.status}: ${res.statusText}`);
      }
      fetchPriorityCounts();
    } catch (err: any) {
      fetchUsers();
      setPriorityError((prev) => ({ ...prev, [userId]: err.message ?? "Failed to update priority." }));
    } finally {
      setUpdatingPriority((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // ─── Row navigation ──────────────────────────────────────────────────────

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>, userId: string) => {
    const targetPath = `/dashboard/users/${userId}`;
    if (e.ctrlKey || e.metaKey) window.open(targetPath, "_blank");
    else router.push(targetPath);
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => { fetchTierCounts();     }, [fetchTierCounts]);
  useEffect(() => { fetchPriorityCounts(); }, [fetchPriorityCounts]);
  useEffect(() => { setPage(1); }, [search, isActive, tier, priorityFilter, dateFrom, dateTo]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.topBar}>
        <h2 className={styles.title}>Users</h2>
        {data && <span className={styles.totalBadge}>{data.total.toLocaleString()} total</span>}
      </div>

      {/* ── Tier Summary Cards ── */}
      <div className={styles.tierCards}>
        {(["Basic", "Pro", "Premium"] as const).map((t) => {
          const meta = TIER_CARD_META[t];
          return (
            <div
              key={t}
              className={`${styles.tierCard} ${meta.cardClass} ${tier === t ? styles.tierCardActive : ""}`}
              onClick={() => setTier((prev) => (prev === t ? "" : t))}
              title={`Filter by ${t}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setTier((prev) => (prev === t ? "" : t))}
            >
              <div className={styles.tierCardBody}>
                <span className={styles.tierCardLabel}>{meta.label}</span>
                <span className={styles.tierCardCount}>
                  {tierCountsLoading ? "—" : tierCounts[t].toLocaleString()}
                </span>
              </div>
              <span className={styles.tierCardSub}>users</span>
            </div>
          );
        })}
      </div>

      {/* ── Priority Summary Cards ── */}
      <div className={styles.tierCards}>
        {(["Low", "Medium", "High", "Critical"] as const).map((p) => {
          const meta = PRIORITY_CARD_META[p];
          return (
            <div
              key={p}
              className={`${styles.tierCard} ${meta.cardClass} ${priorityFilter === p ? styles.tierCardActive : ""}`}
              onClick={() => setPriorityFilter((prev) => (prev === p ? "" : p))}
              title={`Filter by ${p} priority`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setPriorityFilter((prev) => (prev === p ? "" : p))}
            >
              <div className={styles.tierCardBody}>
                <span className={styles.tierCardLabel}>{meta.label}</span>
                <span className={styles.tierCardCount}>
                  {priorityCountsLoading ? "—" : priorityCounts[p].toLocaleString()}
                </span>
              </div>
              <span className={styles.tierCardSub}>users</span>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className={styles.select}
          value={isActive}
          onChange={(e) => setIsActive(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <input
          className={styles.searchInput}
          type="date"
          title="Joined after"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          className={styles.searchInput}
          type="date"
          title="Joined before"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading users…</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchUsers}>Retry</button>
          </div>
        ) : data?.data.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No users found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Tier</th>
                <th>Priority</th>
                <th>Collections</th>
                <th>Files</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((user) => (
                <tr
                  key={user.user_id}
                  className={styles.clickableRow}
                  onClick={(e) => handleRowClick(e, user.user_id)}
                >
                  <td className={styles.idCell}>{user.user_id}</td>
                  <td className={styles.nameCell}>{user.name}</td>
                  <td className={styles.emailCell}>{user.email}</td>
                  <td>
                    <span className={`${styles.badge} ${user.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Tier dropdown */}
                  <td>
                    <div className={styles.tierCell}>
                      <div className={styles.tierSelectWrap}>
                        <select
                          className={`${styles.tierSelect} ${TIER_COLORS[user.tier]}`}
                          value={user.tier}
                          disabled={updatingTier[user.user_id]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); handleTierChange(user.user_id, e.target.value); }}
                        >
                          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className={styles.tierArrow}>&#9660;</span>
                      </div>
                      {updatingTier[user.user_id]  && <span className={styles.tierSpinner} />}
                      {tierError[user.user_id]     && <span className={styles.tierErrorDot} title={tierError[user.user_id]} />}
                    </div>
                  </td>

                  {/* Priority dropdown */}
                  <td>
                    <div className={styles.tierCell}>
                      <div className={styles.tierSelectWrap}>
                        <select
                          className={`${styles.tierSelect} ${PRIORITY_COLORS[user.priority]}`}
                          value={user.priority}
                          disabled={updatingPriority[user.user_id]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); handlePriorityChange(user.user_id, e.target.value); }}
                        >
                          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <span className={styles.tierArrow}>&#9660;</span>
                      </div>
                      {updatingPriority[user.user_id] && <span className={styles.tierSpinner} />}
                      {priorityError[user.user_id]    && <span className={styles.priorityErrorDot} title={priorityError[user.user_id]} />}
                    </div>
                  </td>

                  <td className={styles.numCell}>{user.num_collections}</td>
                  <td className={styles.numCell}>{user.total_files}</td>
                  <td className={styles.dateCell}>
                    {new Date(user.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && !error && data && totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page === 1}          onClick={() => setPage(1)}>«</button>
          <button className={styles.pageBtn} disabled={page === 1}          onClick={() => setPage((p) => p - 1)}>‹</button>

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