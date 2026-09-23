"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function AppealButton({ strikeId, strikeNumber }: { strikeId: string; strikeNumber: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/appeals", { body: { strikeId, reason, description } });
      toast.success("Appeal submitted. An admin will review it.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Appeal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Appeal strike ${strikeNumber}`} description="Explain why you believe this strike was incorrect. Include any context (e.g. a technical problem) the reviewer should know." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} loading={busy} disabled={!reason.trim() || description.trim().length < 30}>Submit appeal</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. My internet dropped. I didn't leave on purpose" maxLength={160} />
          <Textarea label="Explanation" value={description} onChange={(e) => setDescription(e.target.value)} hint={`${description.trim().length}/30 characters minimum`} maxLength={4000} className="min-h-[140px]" />
        </div>
      </Modal>
    </>
  );
}
