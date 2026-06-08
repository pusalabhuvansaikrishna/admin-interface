// app/dashboard/layout.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import styles from "./layout.module.css";
import { BASE_URL } from "@/config/api";

interface AdminInfo {
  admin_id: number;
  name: string;
  username: string;
  is_active: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const tryRefresh = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const fetchAdmin = async () => {
    try {
      const response = await fetch(`${BASE_URL}/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await tryRefresh();
          if (!refreshed) {
            router.replace("/");
            return;
          }
          const retry = await fetch(`${BASE_URL}/me`, {
            credentials: "include",
          });
          if (retry.ok) {
            setAdmin(await retry.json());
          } else {
            router.replace("/");
          }
        } else {
          router.replace("/");
        }
      } else {
        setAdmin(await response.json());
      }
    } catch (err) {
      console.error(err);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      document.cookie =
        "has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0";
      window.location.href = "/";
    }
  };

  useEffect(() => {
    fetchAdmin();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <span className={styles.spinner} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className={styles.loadingWrap}>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.right}>
        <Header onLogout={handleLogout} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}