"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function InterviewerFeedbackForm({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ strengths: "", improvements: "", notes: "" });
  const [busy, setBusy] = useState<"submit" | "skip" | null>(null);
  async function send(skip: boolean) {
    setBusy(skip ? "skip" : "submit");
    try {
      await api(`/api/interviews/${interviewId}/feedback`, { body: { ...f, skip } });
      toast.success(skip ? "Done — the AI is grading the interview now." : "Feedback submitted. It will be included in the candidate's AI report.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }
  return (
    <div className="space-y-5">
      <Textarea label="What did the candidate do well?" value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} maxLength={3000} placeholder="e.g. Clear structure on the leadership story; stayed calm on the valuation question." />
      <Textarea label="What could they improve?" value={f.improvements} onChange={(e) => setF({ ...f, improvements: e.target.value })} maxLength={3000} placeholder="e.g. Results weren't quantified; rushed through the DCF steps." />
      <Textarea label="Additional notes" optional value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={3000} />
      <p className="text-xs text-ink-500">Detailed feedback (a couple of sentences in each box) earns the Feedback Pro badge over time.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send(false)} loading={busy === "submit"} disabled={!f.strengths.trim() && !f.improvements.trim() && !f.notes.trim()}>Submit feedback</Button>
        <Button variant="ghost" onClick={() => send(true)} loading={busy === "skip"}>Skip</Button>
      </div>
    </div>
  );
}
