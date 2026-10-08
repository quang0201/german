import React, { useState } from "react";
import { api } from "../../lib/api.js";

export function LoginPage({ onLoggedIn }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const session = await api.post("/api/auth/login", { identifier, password });
      onLoggedIn(session);
    } catch (requestError) {
      setError(requestError.message ?? "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-primary-strong)] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9fded4]">German · Hệ thống sản xuất</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Nhập sản lượng</h1>
          <p className="mt-2 text-sm leading-6 text-[#cfe5e1]">Đăng nhập bằng tên tài khoản hoặc mã nhân viên.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[var(--radius-md)] bg-white p-6 shadow-2xl shadow-black/20">
          <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor="identifier">
            Tên đăng nhập hoặc mã nhân viên
          </label>
          <input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
          />

          <label className="mt-5 block text-sm font-semibold text-[var(--color-text)]" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
          />

          {error && (
            <div role="alert" className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 min-h-12 w-full rounded-xl bg-[var(--color-primary-strong)] px-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
