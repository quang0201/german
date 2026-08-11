import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { ProductionEntryForm } from "../features/production-entries/ProductionEntryForm.jsx";
import { ManagerApp } from "../features/manager/ManagerApp.jsx";

export function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/api/auth/me")
      .then((value) => active && setSession(value))
      .catch(() => active && setSession(null))
      .finally(() => active && setCheckingSession(false));
    return () => { active = false; };
  }, []);

  async function logout() {
    try { await api.post("/api/auth/logout", {}); }
    finally { setSession(null); }
  }

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-sm font-medium text-slate-300">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (!session) return <LoginPage onLoggedIn={setSession} />;

  const isManager = session.role === "Manager" || session.role === "Admin";
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 ${isManager ? "max-w-7xl" : "max-w-3xl"}`}>
          <div><div className="text-sm font-bold text-slate-950">German Production</div><div className="text-xs text-slate-500">{session.username} · {session.role}</div></div>
          <button type="button" onClick={logout} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đăng xuất</button>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 ${isManager ? "max-w-7xl" : "max-w-3xl"}`}>
        {isManager ? <ManagerApp session={session} /> : <ProductionEntryForm session={session} />}
      </main>
    </div>
  );
}
