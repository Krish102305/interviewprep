"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Accessible modal built on <dialog> (focus trap, Esc to close, inert background). */
export function Modal({ open, onClose, title, description, children, footer, size = "md", dismissible = true }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg"; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      className={cn("w-[calc(100%-2rem)] rounded-2xl border border-ink-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-950/50 backdrop:backdrop-blur-[2px]", { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size])}
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="animate-fade-in">
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
            <div>
              <h2 id="dialog-title" className="text-base font-semibold">{title}</h2>
              {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
            </div>
            {dismissible && (
              <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {children && <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-6 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "danger", loading, children }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; loading?: boolean; children?: ReactNode }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
