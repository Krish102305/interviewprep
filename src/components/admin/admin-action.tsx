"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

/**
 * Admin action with a mandatory confirmation dialog (and optional reason).
 * `noteKey` controls which body field receives the typed text.
 */
export function AdminAction({ url, body = {}, label, title, description, confirmLabel, variant = "secondary", tone = "danger", noteKey = "note", noteLabel = "Note", noteRequired = false, success, checkbox }: {
  url: string;
  body?: Record<string, unknown>;
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "secondary" | "primary" | "danger" | "ghost" | "olive";
  tone?: "danger" | "primary";
  noteKey?: string;
  noteLabel?: string;
  noteRequired?: boolean;
  success: string;
  checkbox?: { key: string; label: string; default: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [check, setCheck] = useState(checkbox?.default ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function go() {
    setBusy(true);
    setError(undefined);
    try {
      await api(url, { body: { ...body, [noteKey]: note, ...(checkbox ? { [checkbox.key]: check } : {}) } });
      toast.success(success);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} size="sm" footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant={tone === "danger" ? "danger" : "primary"} onClick={go} loading={busy} disabled={noteRequired && note.trim().length < 5}>{confirmLabel ?? label}</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Textarea label={noteLabel} optional={!noteRequired} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} hint={noteRequired ? "Required (min 5 characters). Logged in the admin audit trail." : "Logged in the admin audit trail."} />
          {checkbox && (
            <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="h-4 w-4 rounded border-ink-300" />{checkbox.label}</label>
          )}
        </div>
      </Modal>
    </>
  );
}
