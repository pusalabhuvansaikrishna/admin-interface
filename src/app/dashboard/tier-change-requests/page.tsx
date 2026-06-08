"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./TierChangeRequests.module.css";
import { BASE_URL } from "@/config/api";


const PAGE_SIZE = 15;

const TIER_OPTIONS   = ["Basic", "Pro", "Premium"];

// ── Types ─────────────────────────────────────────────────────────────────────

type TierRequest = {
  request_id    : number;
  user_id       : string;
  user_name     : string;
  user_email    : string;
  current_tier  : string;
  requested_tier: string;
  user_reason   : string;
  status        : string;
  created_at    : string;
};

type ModalState = {
  action : "approve" | "reject";
  request: TierRequest;
} | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusClass(status: string) {
  switch (status) {
    case "Pending":  return styles.statusPending;
    case "Approved": return styles.statusCompleted;
    case "Rejected": return styles.statusRejected;
    default:         return "";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "Pending":  return "bi-clock";
    case "Approved": return "bi-check-circle";
    case "Rejected": return "bi-x-circle";
    default:         return "";
  }
}

function tierClass(tier: string) {
  switch (tier) {
    case "Basic":   return styles.tierBasic;
    case "Pro":     return styles.tierPro;
    case "Premium": return styles.tierPremium;
    default:        return "";
  }
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3)          pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2)  pages.push("...");
  pages.push(total);
  return pages;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TierChangeRequests() {
  const [records, setRecords]             = useState<TierRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // filters
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("Pending");
  const [currentTier, setCurrentTier]     = useState("");
  const [requestedTier, setRequestedTier] = useState("");

  // pagination
  const [page, setPage] = useState(1);

  // three-dots menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // action modal
  const [modal, setModal]         = useState<ModalState>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Close menu on outside click ─────────────────────────────────────────────

  useEffect(() => {
    if (openMenuId === null) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.menuWrapper}`)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter)  params.set("status",         statusFilter);
      if (currentTier)   params.set("current_tier",   currentTier);
      if (requestedTier) params.set("requested_tier", requestedTier);

      const res = await fetch(
        `${BASE_URL}/admin/tier-change-requests?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setRecords(await res.json());
      setPage(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentTier, requestedTier]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openModal(action: "approve" | "reject", request: TierRequest) {
    setOpenMenuId(null);
    setAdminNote("");
    setSubmitError(null);
    setModal({ action, request });
  }

  function closeModal() {
    if (submitting) return;
    setModal(null);
    setAdminNote("");
    setSubmitError(null);
  }

  async function submitAction() {
    if (!modal || !adminNote.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        `${BASE_URL}/admin/tier-change-requests/${modal.request.request_id}/${modal.action}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_note: adminNote.trim() }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Server error ${res.status}`);
      }
      setModal(null);
      fetchRecords();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Client-side search + pagination ────────────────────────────────────────

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.user_name.toLowerCase().includes(q) ||
      r.user_email.toLowerCase().includes(q) ||
      String(r.request_id).includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isApprove  = modal?.action === "approve";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={styles.page}>

        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1 className={styles.title}>Tier Change Requests</h1>
            {!loading && !error && (
              <span className={styles.totalBadge}>{filtered.length} records</span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Search by name, email or ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          {/* Status toggle buttons */}
          <div className={styles.statusFilterGroup}>
            {[
              { label: "Pending",  icon: "bi-clock",        mod: styles.statusFilterBtnPending  },
              { label: "Approved", icon: "bi-check-circle", mod: styles.statusFilterBtnApproved },
              { label: "Rejected", icon: "bi-x-circle",     mod: styles.statusFilterBtnRejected },
            ].map(({ label, icon, mod }) => (
              <button
                key={label}
                className={[
                  styles.statusFilterBtn,
                  mod,
                  statusFilter === label ? styles.statusFilterBtnActive : "",
                ].join(" ")}
                onClick={() => { setStatusFilter(statusFilter === label ? "" : label); setPage(1); }}
              >
                <i className={`bi ${icon}`} />
                {label}
              </button>
            ))}
          </div>

          <select className={styles.select} value={currentTier}    onChange={(e) => setCurrentTier(e.target.value)}>
            <option value="">Current Tier (All)</option>
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={styles.select} value={requestedTier}  onChange={(e) => setRequestedTier(e.target.value)}>
            <option value="">Requested Tier (All)</option>
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>

          {loading && (
            <div className={styles.stateWrap}><div className={styles.spinner} /></div>
          )}

          {!loading && error && (
            <div className={styles.stateWrap}>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.retryBtn} onClick={fetchRecords}>Retry</button>
            </div>
          )}

          {!loading && !error && paginated.length === 0 && (
            <div className={styles.stateWrap}>
              <i className="bi bi-inbox" style={{ fontSize: "2rem" }} />
              <p className={styles.emptyText}>No requests found.</p>
            </div>
          )}

          {!loading && !error && paginated.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Current Tier</th>
                  <th>Requested Tier</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.request_id}>

                    <td className={styles.idCell}>#{r.request_id}</td>

                    <td className={styles.userCell}>{r.user_name}</td>

                    <td className={styles.dateCell} style={{ color: "#4e6fa3" }}>
                      {r.user_email}
                    </td>

                    <td>
                      <span className={`${styles.statusBadge} ${tierClass(r.current_tier)}`}>
                        {r.current_tier}
                      </span>
                    </td>

                    <td>
                      <span className={`${styles.statusBadge} ${tierClass(r.requested_tier)}`}>
                        <i className="bi bi-arrow-up-circle" />
                        {r.requested_tier}
                      </span>
                    </td>

                    <td className={styles.reasonCell} title={r.user_reason}>
                      {r.user_reason}
                    </td>

                    <td>
                      <span className={`${styles.statusBadge} ${statusClass(r.status)}`}>
                        <i className={`bi ${statusIcon(r.status)}`} />
                        {r.status}
                      </span>
                    </td>

                    <td className={styles.dateCell}>{formatDate(r.created_at)}</td>

                    {/* Three-dots action cell — only for Pending */}
                    <td className={styles.actionCell}>
                      {r.status === "Pending" && (
                        <div className={styles.menuWrapper}>
                          <button
                            className={styles.dotsBtn}
                            onClick={() =>
                              setOpenMenuId(openMenuId === r.request_id ? null : r.request_id)
                            }
                            aria-label="Actions"
                          >
                            <i className="bi bi-three-dots-vertical" />
                          </button>

                          {openMenuId === r.request_id && (
                            <div className={styles.dropdownMenu}>
                              <button
                                className={styles.dropdownItem}
                                onClick={() => openModal("approve", r)}
                              >
                                <i className="bi bi-check-circle" />
                                Approve
                              </button>
                              <button
                                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                                onClick={() => openModal("reject", r)}
                              >
                                <i className="bi bi-x-circle" />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}>
              <i className="bi bi-chevron-left" />
            </button>
            {buildPages(safePage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className={styles.ellipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${safePage === p ? styles.pageBtnActive : ""}`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              )
            )}
            <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}>
              <i className="bi bi-chevron-right" />
            </button>
            <span className={styles.pageInfo}>Page {safePage} of {totalPages}</span>
          </div>
        )}
      </div>

      {/* ── Action Modal ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <div
            className={`${styles.modal} ${isApprove ? styles.modalApprove : styles.modalReject}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.modalHeader}>
              <div className={`${styles.modalIconWrap} ${isApprove ? styles.modalIconApprove : styles.modalIconReject}`}>
                <i className={`bi ${isApprove ? "bi-check-circle" : "bi-x-circle"}`} />
              </div>
              <div>
                <h2 className={styles.modalTitle}>
                  {isApprove ? "Approve Request" : "Reject Request"}
                </h2>

                {/* ── Tier flow badges ── */}
                <p className={styles.modalSubtitle}>
                  {modal.request.user_name}
                  <span className={styles.modalTierFlow}>
                    <span className={styles.modalTierBadge}>
                      {modal.request.current_tier}
                    </span>
                    <span className={styles.modalTierArrow}>→</span>
                    <span className={`${styles.modalTierBadge} ${isApprove ? styles.modalTierBadgeApprove : styles.modalTierBadgeReject}`}>
                      {modal.request.requested_tier}
                    </span>
                  </span>
                </p>

              </div>
            </div>

            {/* User reason preview */}
            <div className={styles.modalPreview}>
              <span className={styles.modalPreviewLabel}>User's reason</span>
              <p className={styles.modalPreviewText}>{modal.request.user_reason}</p>
            </div>

            {/* Admin note */}
            <div className={styles.modalBody}>
              <label className={styles.modalLabel} htmlFor="adminNote">
                Admin note <span className={styles.modalRequired}>*</span>
              </label>
              <textarea
                id="adminNote"
                className={styles.modalTextarea}
                placeholder={
                  isApprove
                    ? "Briefly explain why this request is being approved…"
                    : "Briefly explain why this request is being rejected…"
                }
                rows={4}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={submitting}
              />
              {submitError && (
                <p className={styles.modalError}>{submitError}</p>
              )}
            </div>

            {/* Footer */}
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button
                className={`${styles.modalConfirmBtn} ${isApprove ? styles.modalConfirmApprove : styles.modalConfirmReject}`}
                onClick={submitAction}
                disabled={submitting || !adminNote.trim()}
              >
                {submitting ? (
                  <span className={styles.modalSpinner} />
                ) : (
                  <i className={`bi ${isApprove ? "bi-check-lg" : "bi-x-lg"}`} />
                )}
                {submitting ? "Processing…" : isApprove ? "Confirm Approve" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}