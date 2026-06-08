// app/dashboard/admins/page.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "./admins.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSummary {
  admin_id: number;
  name: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface PaginatedAdmins {
  total: number;
  limit: number;
  offset: number;
  data: AdminSummary[];
}

interface CreateAdminForm {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const EMPTY_FORM: CreateAdminForm = {
  name: "", username: "", password: "", confirmPassword: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const router = useRouter();

  const [data, setData]       = useState<PaginatedAdmins | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState("");
  const [isActive, setIsActive] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);

  // Modal
  const [modalOpen, setModalOpen]                     = useState(false);
  const [form, setForm]                               = useState<CreateAdminForm>(EMPTY_FORM);
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError]                     = useState<string | null>(null);
  const [creating, setCreating]                       = useState(false);
  const [successMsg, setSuccessMsg]                   = useState<string | null>(null);

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search)   params.set("search",    search);
    if (isActive) params.set("is_active", isActive);

    try {
      const res = await fetch(
        `${BASE_URL}/admin/admins?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch admins.");
    } finally {
      setLoading(false);
    }
  }, [page, search, isActive]);

  useEffect(() => { setPage(1); }, [search, isActive]);
  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSuccessMsg(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating) return;
    setModalOpen(false);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError(null);
  };

  // ── Create admin ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required."); return;
    }
    if (form.username.trim().length < 3) {
      setFormError("Username must be at least 3 characters."); return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters."); return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError("Passwords do not match."); return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch(`${BASE_URL}/admin/admins/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     form.name.trim(),
          username: form.username.trim(),
          password: form.password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.detail ?? `Error ${res.status}`);
        return;
      }

      setSuccessMsg(`Admin account created for @${json.username} successfully.`);
      await fetchAdmins();

      setTimeout(() => {
        setModalOpen(false);
        setSuccessMsg(null);
      }, 1500);

    } catch (err: any) {
      setFormError(err.message ?? "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.title}>Admins</h2>
          {data && (
            <span className={styles.totalBadge}>{data.total} total</span>
          )}
        </div>
        <button className={styles.newBtn} onClick={openModal}>
          <i className="bi bi-plus-lg" />
          New Admin
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or username..."
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
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading admins...</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchAdmins}>Retry</button>
          </div>
        ) : data?.data.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No admins found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Username</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((admin) => (
                <tr
                  key={admin.admin_id}
                  className={styles.clickableRow}
                  onClick={(e) => handleNavigation(e, `/dashboard/admins/${admin.admin_id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td className={styles.idCell}>{admin.admin_id}</td>
                  <td className={styles.nameCell}>
                    <div className={styles.nameWrap}>
                      <div className={styles.avatar}>
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      {admin.name}
                    </div>
                  </td>
                  <td className={styles.usernameCell}>@{admin.username}</td>
                  <td>
                    <span className={`${styles.badge} ${admin.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                      {admin.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {new Date(admin.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className={styles.chevronCell}>
                    <i className="bi bi-chevron-right" />
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

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>New Admin</h3>
              <button className={styles.closeBtn} onClick={closeModal} disabled={creating}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Body */}
            <div className={styles.modalBody}>
              {successMsg ? (
                <div className={styles.successWrap}>
                  <i className="bi bi-check-circle-fill" style={{ fontSize: "2rem", color: "#1a7a4a" }} />
                  <p className={styles.successText}>{successMsg}</p>
                </div>
              ) : (
                <>
                  {/* Name */}
                  <div className={styles.field}>
                    <label className={styles.label}>Full Name</label>
                    <input
                      className={styles.input}
                      type="text"
                      name="name"
                      placeholder="e.g. John Doe"
                      value={form.name}
                      onChange={handleFormChange}
                      disabled={creating}
                      autoComplete="off"
                    />
                  </div>

                  {/* Username */}
                  <div className={styles.field}>
                    <label className={styles.label}>Username</label>
                    <div className={styles.inputPrefix}>
                      <span className={styles.prefix}>@</span>
                      <input
                        className={`${styles.input} ${styles.inputWithPrefix}`}
                        type="text"
                        name="username"
                        placeholder="e.g. johndoe"
                        value={form.username}
                        onChange={handleFormChange}
                        disabled={creating}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className={styles.field}>
                    <label className={styles.label}>Password</label>
                    <div className={styles.inputSuffix}>
                      <input
                        className={`${styles.input} ${styles.inputWithSuffix}`}
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={handleFormChange}
                        disabled={creating}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className={styles.field}>
                    <label className={styles.label}>Confirm Password</label>
                    <div className={styles.inputSuffix}>
                      <input
                        className={`${styles.input} ${styles.inputWithSuffix}`}
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={handleFormChange}
                        disabled={creating}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {formError && (
                    <p className={styles.formError}>
                      <i className="bi bi-exclamation-circle" /> {formError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!successMsg && (
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={closeModal} disabled={creating}>
                  Cancel
                </button>
                <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <><span className={styles.btnSpinner} /> Creating...</>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}