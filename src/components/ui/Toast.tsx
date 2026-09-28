import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { Icon } from "./Icon";
import styles from "./Toast.module.css";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastType, string> = {
  success: "check",
  error: "info",
  info: "info"
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((opts: ToastOptions) => {
    const id = ++counter;
    setItems((prev) => [...prev, { id, type: opts.type ?? "info", title: opts.title, description: opts.description }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, type: "success" }),
      error: (title, description) => push({ title, description, type: "error" }),
      info: (title, description) => push({ title, description, type: "info" })
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={`${styles.toast} ${styles[t.type]}`}
            onOpenChange={(open) => {
              if (!open) remove(t.id);
            }}
          >
            <span className={styles.icon}>
              <Icon name={ICON[t.type]} size={15} />
            </span>
            <div className={styles.main}>
              <RadixToast.Title className={styles.title}>{t.title}</RadixToast.Title>
              {t.description && <RadixToast.Description className={styles.desc}>{t.description}</RadixToast.Description>}
            </div>
            <RadixToast.Close className={styles.close} aria-label="Tutup">
              <Icon name="x" size={14} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
