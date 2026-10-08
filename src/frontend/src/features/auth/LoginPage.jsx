import React, { useState } from "react";
import { Icon } from "../../components/erp/Icon.jsx";
import { api } from "../../lib/api.js";

const previewCells = Array.from({ length: 28 }, (_, index) => ([2, 5, 8, 9, 13, 16, 18, 21, 24, 25].includes(index) ? "is-on" : index === 11 ? "is-warn" : ""));

export function LoginPage({ onLoggedIn }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const variant = typeof window === "undefined" ? "a" : (new URLSearchParams(window.location.search).get("style") || "a");

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
    <main className={`erp-login erp-login-${variant}`}>
      <aside className="erp-login-hero">
        <div className="erp-login-brand">
          <div className="erp-brand-mark">G</div>
          <div><strong>German</strong><span>Hệ thống sản xuất</span></div>
        </div>
        <div className="erp-login-hero-copy">
          <h2>Sản lượng của cả tuần,<br />trong một bảng nhìn là thấy.</h2>
          <p>Nhập theo ngày và công đoạn, đối chiếu chấm công, xuất báo cáo Excel.</p>
        </div>
        <div className="erp-login-preview" aria-hidden="true">
          <div className="erp-login-preview-head"><span>Tuần 40</span><b>12.480</b></div>
          <div className="erp-login-preview-grid">
            {previewCells.map((state, index) => <i key={index} className={state} />)}
          </div>
          <div className="erp-login-preview-legend"><span><i className="is-on" />Đã nhập</span><span><i className="is-warn" />Chưa chấm công</span></div>
        </div>
      </aside>
      <section className="erp-login-panel">
        <div className="erp-login-card">
          <p className="erp-login-kicker">Chào mừng trở lại</p>
          <h1 className="erp-login-title">Đăng nhập</h1>
          <p className="erp-login-subtitle">Dùng tên tài khoản hoặc mã nhân viên của bạn.</p>
          <form onSubmit={handleSubmit} className="erp-login-form">
            <label className="erp-login-label" htmlFor="identifier">Tên đăng nhập hoặc mã nhân viên</label>
            <div className="erp-login-field">
              <Icon name="employees" size={18} />
              <input id="identifier" className="erp-control" autoComplete="username" autoFocus required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            </div>
            <label className="erp-login-label" htmlFor="password">Mật khẩu</label>
            <div className="erp-login-field">
              <Icon name="lock" size={18} />
              <input id="password" className="erp-control" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={(event) => setCapsLock(event.getModifierState?.("CapsLock") ?? false)} onBlur={() => setCapsLock(false)} />
              <button type="button" className="erp-login-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}><Icon name={showPassword ? "eyeOff" : "eye"} size={18} /></button>
            </div>
            {capsLock && <p className="erp-login-hint" role="status">Caps Lock đang bật.</p>}
            {error && <div role="alert" className="erp-login-error">{error}</div>}
            <button type="submit" disabled={submitting} className="erp-button erp-button-primary erp-login-submit">
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
