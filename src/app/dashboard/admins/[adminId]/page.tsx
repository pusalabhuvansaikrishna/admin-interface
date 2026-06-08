"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./adminDetail.module.css";
import { BASE_URL } from "@/config/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentBrief {
  document_id: number;
  file_name: string;
  file_type: string | null;
  status: string;
}

interface UserBrief {
  user_id: string;
  name: string;
  email: string;
  tier: string;
}

interface AnnotatorBrief {
  annotator_id: number;
  name: string;
  username: string;
}

interface JobBrief {
  job_id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

interface ReviewTaskDetail {
  task_id: number;
  status: string;
  user_reason: string;
  annotator_reason: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  document: DocumentBrief | null;
  requestor: UserBrief | null;
  annotator: AnnotatorBrief | null;
  job: JobBrief | null;
}

interface TierUpgradeRequestDetail {
  request_id: number;
  current_tier: string;
  requested_tier: string;
  user_reason: string;
  admin_note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  user: UserBrief;
}

interface AdminDetail {
  admin_id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tasks: ReviewTaskDetail[];
  tier_upgrade_requests: TierUpgradeRequestDetail[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const TASK_STATUS_CLASS: Record<string, string> = {
  Pending:    "statusPending",
  Assigned:   "statusAssigned",
  InReview:   "statusInReview",
  Completed:  "statusCompleted",
  Rejected:   "statusRejected",
};

const TIER_STATUS_CLASS: Record<string, string> = {
  Pending:  "statusPending",
  Approved: "statusCompleted",
  Rejected: "statusRejected",
};

const TIER_CLASS: Record<string, string> = {
  Basic:   "tierBasic",
  Pro:     "tierPro",
  Premium: "tierPremium",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDetailPage() {
  const { adminId } = useParams<{ adminId: string }>();
  const router      = useRouter();

  const [admin, setAdmin]     = useState<AdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [tab, setTab] = useState<"tasks" | "upgrades">("tasks");

  // Shared routing interceptor for Ctrl/Cmd clicks
  const handleNavigation = (e: React.MouseEvent, url: string) => {
    if (e.ctrlKey || e.metaKey) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  useEffect(() => {
    const fetchAdmin = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_URL}/admin/admins/${adminId}`, {
          credentials: "include",
        });
        if (res.status === 404) throw new Error("Admin not found.");
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        setAdmin(await res.json());
      } catch (err: any) {
        setError(err.message ?? "Failed to load admin.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
  }, [adminId]);

  if (loading) return (
    <div className={styles.centeredState}>
      <span className={styles.spinner} />
      <p>Loading admin details...</p>
    </div>
  );

  if (error || !admin) return (
    <div className={styles.centeredState}>
      <i className="bi bi-exclamation-circle" style={{ fontSize: "2rem", color: "#c0392b" }} />
      <p className={styles.errorText}>{error ?? "Admin not found."}</p>
      <button className={styles.backBtn} onClick={() => router.back()}>
        <i className="bi bi-arrow-left" /> Go Back
      </button>
    </div>
  );

  // Sort tasks by created_at descending (latest first)
  const sortedTasks = [...admin.tasks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Sort upgrades by created_at descending (latest first)
  const sortedUpgrades = [...admin.tier_upgrade_requests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className={styles.page}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backLink} onClick={() => router.back()}>
          <i className="bi bi-arrow-left" />
          Admins
        </button>
      </div>

      {/* ── Profile Card (single horizontal row) ──────────────────────────── */}
      <div className={styles.profileCard}>

        {/* Avatar + name/username/email */}
        <div className={styles.profileLeft}>
          <div className={styles.profileAvatar}>
            {admin.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <h1 className={styles.profileName}>{admin.name}</h1>
              <span className={`${styles.statusPill} ${admin.is_active ? styles.pillActive : styles.pillInactive}`}>
                {admin.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className={styles.profileUsername}>@{admin.username}</p>
            <p className={styles.profileEmail}>
              <i className="bi bi-envelope" /> {admin.email}
            </p>
          </div>
        </div>

        <div className={styles.profileDivider} />

        {/* Meta: ID / Joined / Updated */}
        <div className={styles.profileMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Admin ID</span>
            <span className={styles.metaValue}>#{admin.admin_id}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Joined</span>
            <span className={styles.metaValue}>{fmtDate(admin.created_at)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Last Updated</span>
            <span className={styles.metaValue}>{fmtDate(admin.updated_at)}</span>
          </div>
        </div>

        <div className={styles.profileDivider} />

        {/* Stats pushed to the right */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statNumber}>{admin.tasks.length}</span>
            <span className={styles.statLabel}>Review Tasks</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNumber}>
              {admin.tasks.filter(t => t.status === "Completed").length}
            </span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNumber}>{admin.tier_upgrade_requests.length}</span>
            <span className={styles.statLabel}>Tier Requests</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNumber}>
              {admin.tier_upgrade_requests.filter(r => r.status === "Pending").length}
            </span>
            <span className={styles.statLabel}>Pending</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "tasks" ? styles.tabActive : ""}`}
          onClick={() => setTab("tasks")}
        >
          <i className="bi bi-clipboard-check" />
          Review Tasks
          <span className={styles.tabCount}>{admin.tasks.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === "upgrades" ? styles.tabActive : ""}`}
          onClick={() => setTab("upgrades")}
        >
          <i className="bi bi-arrow-up-circle" />
          Tier Upgrade Requests
          <span className={styles.tabCount}>{admin.tier_upgrade_requests.length}</span>
        </button>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div className={styles.tabContent}>

        {/* ── Review Tasks ──────────────────────────────────────────────── */}
        {tab === "tasks" && (
          sortedTasks.length === 0 ? (
            <div className={styles.emptyState}>
              <i className="bi bi-clipboard-x" />
              <p>No review tasks assigned yet.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Document</th>
                    <th>Annotator</th>
                    <th>Job</th>
                    <th>Created</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => (
                    <tr
                      key={task.task_id}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => handleNavigation(e, `/dashboard/tasks/${task.task_id}`)}
                    >
                      <td className={styles.idCell}>#{task.task_id}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[TASK_STATUS_CLASS[task.status] ?? ""]}`}>
                          {task.status}
                        </span>
                      </td>
                      <td>
                        {task.requestor ? (
                          <div className={styles.userCell}>
                            <div className={styles.miniAvatar}>
                              {task.requestor.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className={styles.cellName}>{task.requestor.name}</div>
                              <div className={styles.cellSub}>{task.requestor.email}</div>
                            </div>
                          </div>
                        ) : <span className={styles.nil}>—</span>}
                      </td>
                      <td>
                        {task.document ? (
                          <div>
                            <div className={styles.cellName}>{task.document.file_name}</div>
                            <div className={styles.cellSub}>{task.document.file_type ?? "—"} · {task.document.status}</div>
                          </div>
                        ) : <span className={styles.nil}>—</span>}
                      </td>
                      <td>
                        {task.annotator ? (
                          <div className={styles.cellName}>@{task.annotator.username}</div>
                        ) : <span className={styles.nil}>—</span>}
                      </td>
                      <td>
                        {task.job ? (
                          <div>
                            <div className={styles.cellName}>#{task.job.job_id}</div>
                            <div className={styles.cellSub}>
                              {task.job.completed_tasks}/{task.job.total_tasks} done
                            </div>
                          </div>
                        ) : <span className={styles.nil}>—</span>}
                      </td>
                      <td className={styles.dateCell}>{fmtDate(task.created_at)}</td>
                      <td className={styles.dateCell}>{fmtDateTime(task.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Tier Upgrade Requests ────────────────────────────────────── */}
        {tab === "upgrades" && (
          sortedUpgrades.length === 0 ? (
            <div className={styles.emptyState}>
              <i className="bi bi-arrow-up-circle" />
              <p>No tier upgrade requests handled yet.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>User</th>
                    <th>Tier Change</th>
                    <th>Status</th>
                    <th>User Reason</th>
                    <th>Admin Note</th>
                    <th>Requested</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUpgrades.map((req) => (
                    <tr key={req.request_id}>
                      <td className={styles.idCell}>#{req.request_id}</td>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.miniAvatar}>
                            {req.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.cellName}>{req.user.name}</div>
                            <div className={styles.cellSub}>{req.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.tierChange}>
                          <span className={`${styles.tierBadge} ${styles[TIER_CLASS[req.current_tier] ?? ""]}`}>
                            {req.current_tier}
                          </span>
                          <i className="bi bi-arrow-right" style={{ color: "#9aa3bb", fontSize: "0.7rem" }} />
                          <span className={`${styles.tierBadge} ${styles[TIER_CLASS[req.requested_tier] ?? ""]}`}>
                            {req.requested_tier}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[TIER_STATUS_CLASS[req.status] ?? ""]}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className={styles.reasonCell}>{req.user_reason}</td>
                      <td className={styles.reasonCell}>{req.admin_note ?? <span className={styles.nil}>—</span>}</td>
                      <td className={styles.dateCell}>{fmtDate(req.created_at)}</td>
                      <td className={styles.dateCell}>{fmtDate(req.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}