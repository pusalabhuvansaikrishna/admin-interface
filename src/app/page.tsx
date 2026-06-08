"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { BASE_URL } from "@/config/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((e: { msg: string }) => e.msg).join(", "));
        } else {
          setError("Invalid credentials. Please try again.");
        }
        return;
      }

      document.cookie = "has_session=true; path=/; SameSite=Lax";
      window.location.href = "/dashboard";
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <Image
            src="/iiit-logo.png"
            alt="IIIT Hyderabad Logo"
            fill
            sizes="(max-width: 380px) 70px, (max-width: 768px) 90px, 120px"
            className={styles.logoImg}
            priority
          />
        </div>
        <h1 className={styles.portalTitle}>VISHVA SETU ADMIN PORTAL</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.illustrationWrap}>
          <Image
            src="/admin.png"
            alt="Admin illustration"
            fill
            sizes="(max-width: 768px) 50vw, 35vw"
            className={styles.illustration}
            priority
          />
        </div>

        <div className={styles.cardWrap}>
          <div className={styles.card}>
            <form onSubmit={handleLogin} noValidate>
              <div className={styles.fieldGroup}>
                <label htmlFor="username" className={styles.label}>
                  username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={styles.input}
                  spellCheck={false}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="password" className={styles.label}>
                  password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.btnWrap}>
                <button
                  type="submit"
                  className={styles.loginBtn}
                  disabled={loading}
                >
                  {loading ? <span className={styles.spinner} /> : "Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}