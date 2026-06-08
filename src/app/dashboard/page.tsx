// app/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { BASE_URL } from "@/config/api";

export default function DashboardPage() {
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

  const verifySession = async () => {
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
          if (!retry.ok) {
            router.replace("/");
            return;
          }
        } else {
          router.replace("/");
          return;
        }
      }

      // Session valid — redirect to Users by default
      router.replace("/dashboard/users");
    } catch (err) {
      console.error(err);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  return (
    <div className={styles.loadingWrap}>
      <span className={styles.spinner} />
      <p>Loading...</p>
    </div>
  );
}