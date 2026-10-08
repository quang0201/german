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
    <main className="erp-login">
      <div className="erp-login-card">
        <div className="erp-login-brand">
          <div className="erp-brand-mark">G</div>
          <div><strong>German</strong><span>Hệ thống sản xuất</span></div>
        </div>
        <h1 className="erp-login-title">Đăng nhập</h1>
        <p className="erp-login-subtitle">Dùng tên tài khoản hoặc mã nhân viên của bạn.</p>
        <form onSubmit={handleSubmit} className="erp-login-form">
          <label className="erp-login-label" htmlFor="identifier">Tên đăng nhập hoặc mã nhân viên</label>
          <input id="identifier" className="erp-control" autoComplete="username" autoFocus required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          <label className="erp-login-label" htmlFor="password">Mật khẩu</label>
          <input id="password" className="erp-control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <div role="alert" className="erp-login-error">{error}</div>}
          <button type="submit" disabled={submitting} className="erp-button erp-button-primary erp-login-submit">
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}
