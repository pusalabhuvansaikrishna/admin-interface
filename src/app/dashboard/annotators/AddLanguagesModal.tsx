"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./annotator.module.css";
import { BASE_URL } from "@/config/api";

interface Props {
  open: boolean;
  annotatorId: number;
  annotatorName: string;
  existingLanguages: string[];
  allLanguages: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddLanguagesModal({
  open, annotatorId, annotatorName, existingLanguages, allLanguages, onClose, onSuccess,
}: Props) {
  const [currentLanguages, setCurrentLanguages] = useState<string[]>([]);
  const [selected, setSelected]                 = useState<string[]>([]);
  const [langSearch, setLangSearch]             = useState("");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [submitting, setSubmitting]             = useState(false);
  const [removingLang, setRemovingLang]         = useState<string | null>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [success, setSuccess]                   = useState(false);
  const highlightedRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    highlightedRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  // Sync currentLanguages from prop when modal opens
  useEffect(() => {
    if (open) {
      setCurrentLanguages(existingLanguages);
      setSelected([]);
      setLangSearch("");
      setLangDropdownOpen(false);
      setHighlightedIndex(0);
      setError(null);
      setSuccess(false);
    }
  }, [open, existingLanguages]);

  if (!open) return null;

  const handleClose = () => { if (submitting || removingLang) return; onClose(); };

  // Languages not yet assigned — recomputed from live currentLanguages
  const availableLanguages = allLanguages.filter((l) => !currentLanguages.includes(l));
  const filteredLanguages  = availableLanguages.filter((l) =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  );

  const toggleLanguage = (lang: string) => {
    setSelected((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
    setError(null);
  };

  const selectFromDropdown = (lang: string) => {
    toggleLanguage(lang);
    setLangSearch("");
    setHighlightedIndex(0);
  };

  const removeSelected = (lang: string) => setSelected((prev) => prev.filter((l) => l !== lang));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown")      { e.preventDefault(); setHighlightedIndex((i) => Math.min(i + 1, filteredLanguages.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setHighlightedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (filteredLanguages[highlightedIndex]) selectFromDropdown(filteredLanguages[highlightedIndex]); }
    else if (e.key === "Escape")    setLangDropdownOpen(false);
  };

  // Remove an existing language from the annotator
  const handleRemoveExisting = async (lang: string) => {
    setRemovingLang(lang);
    setError(null);
    try {
      const res = await fetch(
        `${BASE_URL}/admin/annotators/${annotatorId}/languages/${encodeURIComponent(lang)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const json = await res.json();
        setError(json.detail ?? `Error ${res.status}`);
        return;
      }
      // Update local state so dropdown refreshes immediately
      setCurrentLanguages((prev) => prev.filter((l) => l !== lang));
      onSuccess(); // refresh parent table in background
    } catch (err: any) {
      setError(err.message ?? "Failed to remove language.");
    } finally {
      setRemovingLang(null);
    }
  };

  // Add selected languages
  const handleSubmit = async () => {
    if (selected.length === 0) { setError("Please select at least one language."); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators/${annotatorId}/languages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: selected }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.detail ?? `Error ${res.status}`);
        return;
      }
      setSuccess(true);
      onSuccess();
      setTimeout(() => { onClose(); }, 1500);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Languages</h3>
          <button className={styles.closeBtn} onClick={handleClose} disabled={submitting || !!removingLang}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {success ? (
            <div className={styles.successWrap}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: "2rem", color: "#1a7a4a" }} />
              <p className={styles.successText}>Languages updated for {annotatorName}.</p>
            </div>
          ) : (
            <>
              <p className={styles.modalSubtitle}>
                Managing languages for <strong>{annotatorName}</strong>.
              </p>

              {/* Existing languages with removable "-" on hover */}
              <div className={styles.field}>
                <label className={styles.label}>Currently Knows</label>
                {currentLanguages.length === 0 ? (
                  <p className={styles.noLang}>No languages assigned yet.</p>
                ) : (
                  <div className={styles.langTags}>
                    {currentLanguages.map((lang) => (
                      <span
                        key={lang}
                        className={`${styles.langTagRemovable} ${removingLang === lang ? styles.langTagRemoving : ""}`}
                      >
                        <span className={styles.langTagLabel}>{lang}</span>
                        <button
                          type="button"
                          className={styles.langTagMinus}
                          onClick={() => handleRemoveExisting(lang)}
                          disabled={!!removingLang || submitting}
                          tabIndex={-1}
                          title={`Remove ${lang}`}
                        >
                          {removingLang === lang
                            ? <span className={styles.langTagSpinner} />
                            : <i className="bi bi-dash" />
                          }
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new languages dropdown */}
              <div className={styles.field}>
                <label className={styles.label}>Add New Languages</label>
                {selected.length > 0 && (
                  <div className={styles.langTags}>
                    {selected.map((lang) => (
                      <span key={lang} className={styles.langTag}>
                        {lang}
                        <button type="button" className={styles.langTagRemove} onClick={() => removeSelected(lang)} disabled={submitting} tabIndex={-1}>
                          <i className="bi bi-x" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.langDropdownWrap}>
                  <button
                    type="button"
                    className={`${styles.input} ${styles.langTrigger}`}
                    onClick={() => { if (submitting) return; setLangDropdownOpen((v) => !v); setHighlightedIndex(0); }}
                    disabled={submitting}
                  >
                    <span className={styles.langTriggerText}>
                      {selected.length === 0 ? "Select languages…" : `${selected.length} selected`}
                    </span>
                    <i className={`bi ${langDropdownOpen ? "bi-chevron-up" : "bi-chevron-down"} ${styles.langChevron}`} />
                  </button>
                  {langDropdownOpen && (
                    <div className={styles.langDropdown}>
                      <div className={styles.langSearchWrap}>
                        <i className="bi bi-search" />
                        <input
                          className={styles.langSearchInput}
                          type="text"
                          placeholder="Search language…"
                          value={langSearch}
                          onChange={(e) => { setLangSearch(e.target.value); setHighlightedIndex(0); }}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
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
                            const isSelected    = selected.includes(lang);
                            const isHighlighted = idx === highlightedIndex;
                            return (
                              <li
                                key={lang}
                                ref={isHighlighted ? highlightedRef : null}
                                className={[styles.langItem, isSelected ? styles.langItemSelected : "", isHighlighted ? styles.langItemHighlighted : ""].join(" ")}
                                onClick={() => selectFromDropdown(lang)}
                              >
                                <span className={styles.langItemLabel}>{lang}</span>
                                {isSelected && <i className={`bi bi-check2 ${styles.langItemCheck}`} />}
                              </li>
                            );
                          })
                        )}
                      </ul>
                      <div className={styles.langDropdownFooter}>
                        <span className={styles.langFooterHint}>{selected.length} selected · ↑↓ navigate · Enter to pick</span>
                        <button type="button" className={styles.langDoneBtn} onClick={() => { setLangDropdownOpen(false); setLangSearch(""); setHighlightedIndex(0); }}>Done</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <p className={styles.formError}>
                  <i className="bi bi-exclamation-circle" />{" "}{error}
                </p>
              )}
            </>
          )}
        </div>
        {!success && (
          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={handleClose} disabled={submitting || !!removingLang}>Cancel</button>
            <button className={styles.createBtn} onClick={handleSubmit} disabled={submitting || !!removingLang}>
              {submitting ? <><span className={styles.btnSpinner} />{" "}Adding...</> : "Add Languages"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}