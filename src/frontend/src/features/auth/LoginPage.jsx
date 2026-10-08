import React, { useState } from "react";
import { Icon } from "../../components/erp/Icon.jsx";
import { api } from "../../lib/api.js";

const modules = ["Sản lượng", "Chấm công", "Báo cáo"];

export function LoginPage({ onLoggedIn }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

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
      <section className="erp-login-intro">
        <div className="erp-login-brand">
          <div className="erp-brand-mark">G</div>
          <strong>German</strong>
          <span>Hệ thống sản xuất</span>
        </div>
        <ol className="erp-login-modules">
          {modules.map((name) => <li key={name}>{name}<span>.</span></li>)}
        </ol>
      </section>
      <section className="erp-login-panel">
        <form onSubmit={handleSubmit} className="erp-login-form">
          <header>
            <h1 className="erp-login-title">Đăng nhập</h1>
            <p className="erp-login-subtitle">Bằng tên tài khoản hoặc mã nhân viên.</p>
          </header>
          <label className="erp-login-label" htmlFor="identifier">Tài khoản / Mã NV</label>
          <input id="identifier" className="erp-login-input" autoComplete="username" autoFocus required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          <label className="erp-login-label" htmlFor="password">Mật khẩu</label>
          <div className="erp-login-password">
            <input id="password" className="erp-login-input" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={(event) => setCapsLock(event.getModifierState?.("CapsLock") ?? false)} onBlur={() => setCapsLock(false)} />
            <button type="button" className="erp-login-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}><Icon name={showPassword ? "eyeOff" : "eye"} size={18} /></button>
          </div>
          {capsLock && <p className="erp-login-hint" role="status">Caps Lock đang bật.</p>}
          {error && <div role="alert" className="erp-login-error">{error}</div>}
          <button type="submit" disabled={submitting} className="erp-login-submit">
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}
