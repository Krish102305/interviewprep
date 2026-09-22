"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function CancelInterviewButton({ id, asInterviewer }: { id: string; asInterviewer?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api(`/api/interviews/${id}/cancel`, { body: { reason } });
      toast.success(asInterviewer ? "You've been removed. The candidate will be re-matched." : "Interview cancelled.");
      setOpen(false);
      router.push(asInterviewer ? "/interviewer" : "/dashboard");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{asInterviewer ? "Withdraw" : "Cancel interview"}</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={go}
        loading={busy}
        title={asInterviewer ? "Withdraw from this interview?" : "Cancel this interview?"}
        description={asInterviewer ? "The candidate will be notified and automatically re-matched with another interviewer." : "Your interviewer (if matched) will be notified. Cancelling ahead of time is never a conduct issue."}
        confirmLabel={asInterviewer ? "Withdraw" : "Cancel interview"}
      >
        <Textarea label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </ConfirmDialog>
    </>
  );
}

export function SimplePostButton({ url, label, success, variant = "secondary", redirect, confirm }: { url: string; label: string; success: string; variant?: "secondary" | "primary" | "olive" | "danger"; redirect?: string; confirm?: { title: string; description: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api(url, { body: {} });
      toast.success(success);
      setOpen(false);
      if (redirect) router.push(redirect);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant={variant} loading={busy && !confirm} onClick={() => (confirm ? setOpen(true) : go())}>{label}</Button>
      {confirm && <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={go} loading={busy} title={confirm.title} description={confirm.description} confirmLabel={label} tone="primary" />}
    </>
  );
}
