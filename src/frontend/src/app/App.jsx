import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { AppShell } from "./AppShell.jsx";
import { matchRoute, getDefaultRoute, canAccessRoute } from "./routes.js";
import { navigate, subscribeToNavigation, resolvePresentation } from "./navigation.js";
import { ToastProvider } from "../components/erp/ToastProvider.jsx";
import { AccessDeniedPage } from "./AccessDeniedPage.jsx";
import { NotFoundPage } from "./NotFoundPage.jsx";

export function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, state: window.history.state }));

  useEffect(() => {
    let active = true;
    api.get("/api/auth/me")
      .then((value) => active && setSession(value))
      .catch(() => active && setSession(null))
      .finally(() => active && setCheckingSession(false));
    return () => { active = false; };
  }, []);

  useEffect(() => subscribeToNavigation(setLocation), []);

  async function logout() {
    try { await api.post("/api/auth/logout", {}); }
    finally { setSession(null); }
  }

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-sm font-medium text-slate-300">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (!session) return <LoginPage onLoggedIn={(value) => { setSession(value); navigate(getDefaultRoute(value.role)); }} />;

  const matched = matchRoute(location.pathname);
  if (!matched) return <ToastProvider><AppShell session={session} pathname={location.pathname} onLogout={logout}><NotFoundPage /></AppShell></ToastProvider>;
  if (!canAccessRoute(matched.route, session.role)) return <ToastProvider><AppShell session={session} pathname={location.pathname} onLogout={logout}><AccessDeniedPage /></AppShell></ToastProvider>;

  const presentation = resolvePresentation(location.pathname, location.state);
  const backgroundMatch = presentation === "panel" ? matchRoute(location.state.backgroundRoute) : null;
  const Page = backgroundMatch?.route.component ?? matched.route.component;
  const breadcrumbs = (backgroundMatch?.route ?? matched.route).breadcrumb(backgroundMatch?.params ?? matched.params);
  const pageProps = backgroundMatch
    ? { session, params: backgroundMatch.params, pathname: location.state.backgroundRoute, panelEntryId: matched.params.id, onPanelClose: () => navigate(location.state.backgroundRoute), presentation }
    : { session, params: matched.params, pathname: location.pathname, presentation };
  return (
    <ToastProvider>
      <AppShell session={session} pathname={location.pathname} breadcrumbs={breadcrumbs} onLogout={logout}>
        <Page {...pageProps} />
      </AppShell>
    </ToastProvider>
  );
}
