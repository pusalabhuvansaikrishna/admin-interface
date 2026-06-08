"use client";

import { useState } from "react";
import styles from "./annotator.module.css";
import { BASE_URL } from "@/config/api";

interface Props {
  open: boolean;
  annotatorId: number;
  annotatorName: string;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, annotatorId, annotatorName, onClose }: Props) {
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);

  if (!open) return null;

  const reset = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => { if (submitting) return; reset(); onClose(); };

  const handleSubmit = async () => {
    if (newPassword.length < 8)          { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/admin/annotators/${annotatorId}/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.detail ?? `Error ${res.status}`);
        return;
      }
      setSuccess(true);
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
          <h3 className={styles.modalTitle}>Change Password</h3>
          <button className={styles.closeBtn} onClick={handleClose} disabled={submitting}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {success ? (
            <div className={styles.successWrap}>
              <i className="bi bi-check-circle-fill" style={{ fontSize: "2rem", color: "#1a7a4a" }} />
              <p className={styles.successText}>Password updated for {annotatorName}.</p>
            </div>
          ) : (
            <>
              <p className={styles.modalSubtitle}>
                Setting a new password for <strong>{annotatorName}</strong>.
              </p>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <div className={styles.inputSuffix}>
                  <input
                    className={`${styles.input} ${styles.inputWithSuffix}`}
                    type={showNew ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowNew((v) => !v)} tabIndex={-1}>
                    <i className={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm Password</label>
                <div className={styles.inputSuffix}>
                  <input
                    className={`${styles.input} ${styles.inputWithSuffix}`}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    disabled={submitting}
                    autoComplete="new-password"
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}>
                    <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
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
            <button className={styles.cancelBtn} onClick={handleClose} disabled={submitting}>Cancel</button>
            <button className={styles.createBtn} onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><span className={styles.btnSpinner} />{" "}Updating...</> : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}