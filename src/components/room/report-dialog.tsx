"use client";
import { useState } from "react";
import { CONDUCT_REPORT_REASONS } from "@/lib/constants";
import { api } from "@/lib/client-api";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function ReportDialog({ interviewId, open, onClose, subject }: { interviewId: string; open: boolean; onClose: () => void; subject: string }) {
  const toast = useToast();
  const [reason, setReason] = useState("left_interview");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/interviews/${interviewId}/report`, { body: { reason, description } });
      toast.success("Report submitted for review. No action is taken until an admin reviews it.");
      setDescription("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Report conduct: ${subject}`} description="Reports are reviewed by an admin before any strike is issued." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit} loading={busy} disabled={description.trim().length < 20}>Submit report</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {CONDUCT_REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
        <Textarea label="What happened?" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Candidate left the interview room for approximately 8 minutes without explanation and did not return." hint={`${description.trim().length}/20 characters minimum. Be factual, technical problems are not misconduct.`} maxLength={2000} />
      </div>
    </Modal>
  );
}
