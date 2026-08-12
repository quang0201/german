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
    <main className="min-h-screen bg-slate-950 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">German · Hệ thống sản xuất</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Nhập sản lượng</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Đăng nhập bằng tên tài khoản hoặc mã nhân viên.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/20">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="identifier">
            Tên đăng nhập hoặc mã nhân viên
          </label>
          <input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          />

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
