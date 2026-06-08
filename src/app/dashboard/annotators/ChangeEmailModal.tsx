"use client";

import { useState } from "react";
import styles from "./annotator.module.css";
import { BASE_URL } from "@/config/api";

interface Props {
  open: boolean;
  annotatorId: number;
  annotatorName: string;
  currentEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangeEmailModal({ open, annotatorId, annotatorName, currentEmail, onClose, onSuccess }: Props) {
  const [newEmail, setNewEmail]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  if (!open) return null;

  const reset = () => { setNewEmail(""); setError(null); setSuccess(false); };
  const handleClose = () => { if (submitting) return; reset(); onClose(); };

  const handleSubmit = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setError("Please enter a valid email address."); return;
    }
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError("New email must be different from the current email."); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators/${annotatorId}/email`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: newEmail.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.detail ?? `Error ${res.status}`);
        return;
      }
      setSuccess(true);
      onSuccess();
      setTimeout(() => { reset(); onClose(); }, 1500);
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
          <h3 className={styles.modalTitle}>Change Email</h3>
          <button className={styles.closeBtn} onClick={handleClose} disabled={submitting}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {success ? (
            <div className={styles.successWrap}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: "2rem", color: "#1a7a4a" }} />
              <p className={styles.successText}>Email updated for {annotatorName}.</p>
            </div>
          ) : (
            <>
              <p className={styles.modalSubtitle}>
                Updating email for <strong>{annotatorName}</strong>.
              </p>
              <div className={styles.field}>
                <label className={styles.label}>Current Email</label>
                <input className={styles.input} type="email" value={currentEmail} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>New Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="e.g. newemail@example.com"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setError(null); }}
                  disabled={submitting}
                  autoComplete="off"
                  autoFocus
                />
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
            <button className={styles.cancelBtn} onClick={handleClose} disabled={submitting}>Cancel</button>
            <button className={styles.createBtn} onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><span className={styles.btnSpinner} />{" "}Updating...</> : "Update Email"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}