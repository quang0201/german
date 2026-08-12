import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Toast } from "./Toast.jsx";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const push = useCallback((variant, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, variant, message }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  const value = useMemo(() => ({
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    info: (message) => push("info", message),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="erp-toast-stack" aria-live="polite">
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
