import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      const timer = timersRef.current.get(id);
      if (timer) window.clearTimeout(timer);
      timersRef.current.delete(id);
    }, 220);
  }, []);

  const addToast = useCallback(
    ({ title, description, type = "success", duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast = { id, title, description, type, leaving: false };

      setToasts((current) => [toast, ...current].slice(0, 4));

      const timer = window.setTimeout(() => dismissToast(id), duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      notifySuccess: (message, description) => addToast({ title: message, description, type: "success" }),
      notifyError: (message, description) => addToast({ title: message, description, type: "error" }),
      dismissToast
    }),
    [addToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const Icon = isError ? XCircle : CheckCircle2;

        return (
          <div className={`toast-card ${isError ? "is-error" : "is-success"} ${toast.leaving ? "is-leaving" : ""}`} key={toast.id}>
            <Icon size={19} />
            <div>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)} type="button">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
