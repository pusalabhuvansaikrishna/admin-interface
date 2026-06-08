"use client";

import { usePathname, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { label: "Users",       href: "/dashboard/users",       icon: "bi-people" },
  { label: "Annotators",   href: "/dashboard/annotators",   icon: "bi-pencil-square" },
  { label: "Collections", href: "/dashboard/collections", icon: "bi-collection" },
  { label: "Tasks",       href: "/dashboard/tasks",       icon: "bi-list-task" },
  { label: "Jobs",        href: "/dashboard/jobs",        icon: "bi-briefcase" },
  { label: "Admins",      href: "/dashboard/admins",      icon: "bi-shield-lock" },
  { label: "Tier Change Requests", href: "/dashboard/tier-change-requests", icon: "bi-arrow-up-circle" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              onClick={() => router.push(item.href)}
            >
              <i className={`bi ${item.icon} ${styles.icon}`} />
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}