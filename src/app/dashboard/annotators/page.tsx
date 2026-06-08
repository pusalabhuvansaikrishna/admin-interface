"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./annotator.module.css";
import { BASE_URL } from "@/config/api";
import ChangePasswordModal from "./ChangePasswordModal";
import AddLanguagesModal from "./AddLanguagesModal";
import ChangeEmailModal from "./ChangeEmailModal";

interface AnnotatorSummary {
  annotator_id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
  num_tasks: number;
  languages: string[];
}

interface PaginatedAnnotators {
  total: number;
  limit: number;
  offset: number;
  data: AnnotatorSummary[];
}

interface CreateAnnotatorForm {
  name: string;
  username: string;
  email: string;
  password: string;
  languages: string[];
}

const PAGE_SIZE = 20;
const EMPTY_FORM: CreateAnnotatorForm = {
  name: "", username: "", email: "", password: "", languages: [],
};

export default function AnnotatorPage() {
  const router = useRouter();

  const [data, setData]       = useState<PaginatedAnnotators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [search, setSearch]     = useState("");
  const [isActive, setIsActive] = useState<string>("");
  const [page, setPage]         = useState(1);

  const [modalOpen, setModalOpen]       = useState(false);
  const [form, setForm]                 = useState<CreateAnnotatorForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);
  const [creating, setCreating]         = useState(false);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);

  const [languages, setLanguages]               = useState<string[]>([]);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [langSearch, setLangSearch]             = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const highlightedRef = useRef<HTMLLIElement | null>(null);

  const [openMenuId, setOpenMenuId]                     = useState<number | null>(null);
  const [selectedAnnotator, setSelectedAnnotator]       = useState<AnnotatorSummary | null>(null);
  const [changePwdModalOpen, setChangePwdModalOpen]     = useState(false);
  const [addLangModalOpen, setAddLangModalOpen]         = useState(false);
  const [changeEmailModalOpen, setChangeEmailModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Track which annotator IDs are currently being toggled
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen]       = useState(false);
  const [annotatorToDelete, setAnnotatorToDelete]   = useState<AnnotatorSummary | null>(null);
  const [deleting, setDeleting]                     = useState(false);
  const [deleteError, setDeleteError]               = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetch("/languages.csv")
      .then((res) => res.text())
      .then((text) => {
        const langs = text.split("\n").map((l) => l.trim()).filter(Boolean);
        setLanguages(langs);
      })
      .catch(() => console.error("Failed to load languages.csv"));
  }, []);

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const fetchAnnotators = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams();
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search)   params.set("search",    search);
    if (isActive) params.set("is_active", isActive);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch annotators.");
    } finally {
      setLoading(false);
    }
  }, [page, search, isActive]);

  useEffect(() => { setPage(1); }, [search, isActive]);
  useEffect(() => { fetchAnnotators(); }, [fetchAnnotators]);

  const handleRowClick = (e: React.MouseEvent, annotatorId: number) => {
    const targetUrl = `/dashboard/annotators/${annotatorId}`;

    // Check if Ctrl (Windows/Linux) or Cmd (Mac) key is pressed
    if (e.ctrlKey || e.metaKey) {
      window.open(targetUrl, "_blank");
    } else {
      router.push(targetUrl);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, annotator: AnnotatorSummary) => {
    e.stopPropagation(); // prevent row navigation

    setTogglingIds((prev) => new Set(prev).add(annotator.annotator_id));

    try {
      const res = await fetch(
        `${BASE_URL}/admin/annotators/${annotator.annotator_id}/toggle-status`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const updated = await res.json();

      // Optimistically update just this row — no full refetch needed
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((a) =>
            a.annotator_id === annotator.annotator_id
              ? { ...a, is_active: updated.is_active }
              : a,
          ),
        };
      });
    } catch (err: any) {
      console.error("Toggle failed:", err.message);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(annotator.annotator_id);
        return next;
      });
    }
  };

  const openDeleteModal = (e: React.MouseEvent, annotator: AnnotatorSummary) => {
    e.stopPropagation();
    setAnnotatorToDelete(annotator);
    setDeleteError(null);
    setOpenMenuId(null);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!annotatorToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${BASE_URL}/admin/annotators/${annotatorToDelete.annotator_id}/delete`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.detail ?? `Error ${res.status}`);
        return;
      }
      // Remove row from local state — no full refetch needed
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total: prev.total - 1,
          data: prev.data.filter((a) => a.annotator_id !== annotatorToDelete.annotator_id),
        };
      });
      setDeleteModalOpen(false);
      setAnnotatorToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message ?? "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSuccessMsg(null);
    setShowPassword(false);
    setLangDropdownOpen(false);
    setLangSearch("");
    setHighlightedIndex(0);
    setModalOpen(true);
  };

  const closeModal = () => { if (creating) return; setModalOpen(false); };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError(null);
  };

  const toggleLanguage = (lang: string) => {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
    setFormError(null);
  };

  const selectLanguageFromDropdown = (lang: string) => {
    toggleLanguage(lang);
    setLangSearch("");
    setHighlightedIndex(0);
  };

  const removeLanguage = (lang: string) => {
    setForm((prev) => ({ ...prev, languages: prev.languages.filter((l) => l !== lang) }));
  };

  const filteredLanguages = languages.filter((l) =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  );

  const handleLangSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredLanguages.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredLanguages[highlightedIndex]) selectLanguageFromDropdown(filteredLanguages[highlightedIndex]);
    } else if (e.key === "Escape") {
      setLangDropdownOpen(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim())                                                             { setFormError("Name is required."); return; }
    if (form.username.trim().length < 3)                                               { setFormError("Username must be at least 3 characters."); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setFormError("A valid email address is required."); return; }
    if (form.password.length < 8)                                                      { setFormError("Password must be at least 8 characters."); return; }
    if (form.languages.length === 0)                                                   { setFormError("Please select at least one language."); return; }

    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      form.name.trim(),
          username:  form.username.trim(),
          email:     form.email.trim(),
          password:  form.password,
          languages: form.languages,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json.detail ?? `Error ${res.status}`); return; }
      setSuccessMsg(`Account created for @${json.username} successfully.`);
      await fetchAnnotators();
      setTimeout(() => { setModalOpen(false); setSuccessMsg(null); }, 1500);
    } catch (err: any) {
      setFormError(err.message ?? "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleMenuAction = (
    e: React.MouseEvent,
    action: "password" | "languages" | "email",
    annotator: AnnotatorSummary,
  ) => {
    e.stopPropagation();
    setSelectedAnnotator(annotator);
    setOpenMenuId(null);
    if (action === "password")  setChangePwdModalOpen(true);
    if (action === "languages") setAddLangModalOpen(true);
    if (action === "email")     setChangeEmailModalOpen(true);
  };

  const handleDotsClick = (e: React.MouseEvent, annotatorId: number) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === annotatorId ? null : annotatorId);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className={styles.page}>

      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h2 className={styles.title}>Annotators</h2>
          {data && <span className={styles.totalBadge}>{data.total} total</span>}
        </div>
        <button className={styles.newBtn} onClick={openModal}>
          <i className="bi bi-plus-lg" />
          {" "}New Annotator
        </button>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.select} value={isActive} onChange={(e) => setIsActive(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.stateWrap}>
            <span className={styles.spinner} />
            <p>Loading annotators...</p>
          </div>
        ) : error ? (
          <div className={styles.stateWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={fetchAnnotators}>Retry</button>
          </div>
        ) : data?.data.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.emptyText}>No annotators found.</p>
          </div>
        ) : (
          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Languages</th>
                  <th>Status</th>
                  <th>Tasks</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((annotator) => {
                  const isToggling = togglingIds.has(annotator.annotator_id);
                  return (
                    <tr
                      key={annotator.annotator_id}
                      className={styles.clickableRow}
                      onClick={(e) => handleRowClick(e, annotator.annotator_id)}
                    >
                      <td className={styles.idCell}>{annotator.annotator_id}</td>
                      <td className={styles.nameCell}>
                        <div className={styles.nameWithAvatar}>
                          <div className={styles.miniAvatar}>
                            {annotator.name.charAt(0).toUpperCase()}
                          </div>
                          {annotator.name}
                        </div>
                      </td>
                      <td className={styles.usernameCell}>@{annotator.username}</td>
                      <td className={styles.emailCell}>{annotator.email}</td>
                      <td className={styles.langCell}>
                        {annotator.languages.length === 0 ? (
                          <span className={styles.noLang}>—</span>
                        ) : (
                          <div className={styles.langTableTags}>
                            {annotator.languages.slice(0, 3).map((lang) => (
                              <span key={lang} className={styles.langTableTag}>{lang}</span>
                            ))}
                            {annotator.languages.length > 3 && (
                              <span className={styles.langTableTagMore}>
                                +{annotator.languages.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ── Status toggle cell ── */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`${styles.toggleBtn} ${annotator.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive}`}
                          onClick={(e) => handleToggleStatus(e, annotator)}
                          disabled={isToggling}
                          title={annotator.is_active ? "Click to deactivate" : "Click to activate"}
                        >
                          {isToggling ? (
                            <span className={styles.toggleSpinner} />
                          ) : (
                            <span className={styles.toggleTrack}>
                              <span className={styles.toggleThumb} />
                            </span>
                          )}
                          <span className={styles.toggleLabel}>
                            {isToggling
                              ? "Updating…"
                              : annotator.is_active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className={styles.numCell}>{annotator.num_tasks}</td>
                      <td className={styles.dateCell}>
                        {new Date(annotator.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.menuWrap} ref={openMenuId === annotator.annotator_id ? menuRef : null}>
                          <button
                            className={styles.dotsBtn}
                            onClick={(e) => handleDotsClick(e, annotator.annotator_id)}
                          >
                            <i className="bi bi-three-dots-vertical" />
                          </button>
                          {openMenuId === annotator.annotator_id && (
                            <div className={styles.dropMenu}>
                              <button className={styles.dropItem} onClick={(e) => handleMenuAction(e, "password", annotator)}>
                                <i className="bi bi-key" />{" "}Change Password
                              </button>
                              <button className={styles.dropItem} onClick={(e) => handleMenuAction(e, "languages", annotator)}>
                                <i className="bi bi-translate" />{" "}Add Languages
                              </button>
                              <button className={styles.dropItem} onClick={(e) => handleMenuAction(e, "email", annotator)}>
                                <i className="bi bi-envelope" />{" "}Change Email
                              </button>
                              <div className={styles.dropDivider} />
                              <button className={`${styles.dropItem} ${styles.dropItemDanger}`} onClick={(e) => openDeleteModal(e, annotator)}>
                                <i className="bi bi-trash3" />{" "}Delete Annotator
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* ── Create Annotator Modal ── */}
      {modalOpen && (
        <div className={styles.backdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>New Annotator</h3>
              <button className={styles.closeBtn} onClick={closeModal} disabled={creating}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className={styles.modalBody}>
              {successMsg ? (
                <div className={styles.successWrap}>
                  <i className="bi bi-check-circle-fill" style={{ fontSize: "2rem", color: "#1a7a4a" }} />
                  <p className={styles.successText}>{successMsg}</p>
                </div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Full Name</label>
                    <input className={styles.input} type="text" name="name" placeholder="e.g. Jane Smith" value={form.name} onChange={handleFormChange} disabled={creating} autoComplete="off" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Username</label>
                    <div className={styles.inputPrefix}>
                      <span className={styles.prefix}>@</span>
                      <input className={`${styles.input} ${styles.inputWithPrefix}`} type="text" name="username" placeholder="e.g. janesmith" value={form.username} onChange={handleFormChange} disabled={creating} autoComplete="off" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <input className={styles.input} type="email" name="email" placeholder="e.g. jane@example.com" value={form.email} onChange={handleFormChange} disabled={creating} autoComplete="off" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Password</label>
                    <div className={styles.inputSuffix}>
                      <input className={`${styles.input} ${styles.inputWithSuffix}`} type={showPassword ? "text" : "password"} name="password" placeholder="Min. 8 characters" value={form.password} onChange={handleFormChange} disabled={creating} autoComplete="new-password" />
                      <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                        <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Languages</label>
                    {form.languages.length > 0 && (
                      <div className={styles.langTags}>
                        {form.languages.map((lang) => (
                          <span key={lang} className={styles.langTag}>
                            {lang}
                            <button type="button" className={styles.langTagRemove} onClick={() => removeLanguage(lang)} disabled={creating} tabIndex={-1}>
                              <i className="bi bi-x" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.langDropdownWrap}>
                      <button type="button" className={`${styles.input} ${styles.langTrigger}`} onClick={() => { if (creating) return; setLangDropdownOpen((v) => !v); setHighlightedIndex(0); }} disabled={creating}>
                        <span className={styles.langTriggerText}>{form.languages.length === 0 ? "Select languages…" : `${form.languages.length} selected`}</span>
                        <i className={`bi ${langDropdownOpen ? "bi-chevron-up" : "bi-chevron-down"} ${styles.langChevron}`} />
                      </button>
                      {langDropdownOpen && (
                        <div className={styles.langDropdown}>
                          <div className={styles.langSearchWrap}>
                            <i className="bi bi-search" />
                            <input className={styles.langSearchInput} type="text" placeholder="Search language…" value={langSearch} onChange={(e) => { setLangSearch(e.target.value); setHighlightedIndex(0); }} onKeyDown={handleLangSearchKeyDown} autoFocus />
                            {langSearch && (
                              <button type="button" className={styles.langSearchClear} onClick={() => { setLangSearch(""); setHighlightedIndex(0); }} tabIndex={-1}>
                                <i className="bi bi-x" />
                              </button>
                            )}
                          </div>
                          <ul className={styles.langList}>
                            {filteredLanguages.length === 0 ? (
                              <li className={styles.langNoResult}>No languages found</li>
                            ) : (
                              filteredLanguages.map((lang, idx) => {
                                const selected      = form.languages.includes(lang);
                                const isHighlighted = idx === highlightedIndex;
                                return (
                                  <li key={lang} ref={isHighlighted ? highlightedRef : null} className={[styles.langItem, selected ? styles.langItemSelected : "", isHighlighted ? styles.langItemHighlighted : ""].join(" ")} onClick={() => selectLanguageFromDropdown(lang)}>
                                    <span className={styles.langItemLabel}>{lang}</span>
                                    {selected && <i className={`bi bi-check2 ${styles.langItemCheck}`} />}
                                  </li>
                                );
                              })
                            )}
                          </ul>
                          <div className={styles.langDropdownFooter}>
                            <span className={styles.langFooterHint}>{form.languages.length} selected · ↑↓ navigate · Enter to pick</span>
                            <button type="button" className={styles.langDoneBtn} onClick={() => { setLangDropdownOpen(false); setLangSearch(""); setHighlightedIndex(0); }}>Done</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {formError && (
                    <p className={styles.formError}>
                      <i className="bi bi-exclamation-circle" />{" "}{formError}
                    </p>
                  )}
                </>
              )}
            </div>
            {!successMsg && (
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={closeModal} disabled={creating}>Cancel</button>
                <button className={styles.createBtn} onClick={handleCreate} disabled={creating}>
                  {creating ? <><span className={styles.btnSpinner} />{" "}Creating...</> : "Create Account"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalOpen && annotatorToDelete && (
        <div className={styles.backdrop} onClick={() => { if (!deleting) { setDeleteModalOpen(false); setDeleteError(null); } }}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Annotator</h3>
              <button className={styles.closeBtn} onClick={() => { setDeleteModalOpen(false); setDeleteError(null); }} disabled={deleting}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.deleteConfirmWrap}>
                <div className={styles.deleteIconWrap}>
                  <i className="bi bi-trash3" />
                </div>
                <p className={styles.deleteConfirmText}>
                  Are you sure you want to delete{" "}
                  <strong>{annotatorToDelete.name}</strong>{" "}
                  <span className={styles.deleteUsername}>(@{annotatorToDelete.username})</span>?
                </p>
                <p className={styles.deleteConfirmSub}>
                  This action is permanent and cannot be undone. Annotators with active tasks cannot be deleted.
                </p>
              </div>
              {deleteError && (
                <p className={styles.formError}>
                  <i className="bi bi-exclamation-circle" />{" "}{deleteError}
                </p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => { setDeleteModalOpen(false); setDeleteError(null); }} disabled={deleting}>
                Cancel
              </button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? <><span className={styles.btnSpinner} />{" "}Deleting...</>
                  : <><i className="bi bi-trash3" />{" "}Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Modals ── */}
      {selectedAnnotator && (
        <>
          <ChangePasswordModal
            open={changePwdModalOpen}
            annotatorId={selectedAnnotator.annotator_id}
            annotatorName={selectedAnnotator.name}
            onClose={() => setChangePwdModalOpen(false)}
          />
          <AddLanguagesModal
            open={addLangModalOpen}
            annotatorId={selectedAnnotator.annotator_id}
            annotatorName={selectedAnnotator.name}
            existingLanguages={selectedAnnotator.languages}
            allLanguages={languages}
            onClose={() => setAddLangModalOpen(false)}
            onSuccess={fetchAnnotators}
          />
          <ChangeEmailModal
            open={changeEmailModalOpen}
            annotatorId={selectedAnnotator.annotator_id}
            annotatorName={selectedAnnotator.name}
            currentEmail={selectedAnnotator.email}
            onClose={() => setChangeEmailModalOpen(false)}
            onSuccess={fetchAnnotators}
          />
        </>
      )}
    </div>
  );
}