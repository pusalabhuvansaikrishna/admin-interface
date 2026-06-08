"use client";

import Link from "next/link";
import styles from "./Header.module.css";

interface HeaderProps {
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  return (
    <header className={styles.header}>
      {/* Logo */}
      <div className={styles.logoWrap}>
        <Link href="/dashboard/users">
          <img
            src="/iiit-logo.png"
            alt="IIIT Hyderabad"
            className={styles.logo}
          />
        </Link>
      </div>

      {/* Portal Title */}
      <h1 className={styles.title}>Vishva Setu Admin Portal</h1>

      {/* Logout */}
      <div className={styles.actions}>
        <button className={styles.logoutBtn} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}