"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * "Interview Conduct Warning". Acknowledging clears it. If it goes unanswered for
 * 90 seconds we log a `no_response` signal (repeated ones are escalated to a
 * pending report for human review, never an automatic strike).
 */
export function ConductWarningModal({ interviewId, warning, onResolved }: { interviewId: string; warning: { id: string; details: string | null; source: string } | null; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => {
      if (reported.current === warning.id) return;
      reported.current = warning.id;
      fetch(`/api/interviews/${interviewId}/conduct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "no_response", details: "Conduct warning not acknowledged within 90 seconds" }) }).catch(() => {});
    }, 90_000);
    return () => clearTimeout(t);
  }, [warning, interviewId]);

  async function ack() {
    setBusy(true);
    await fetch(`/api/interviews/${interviewId}/conduct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "warning_acknowledged" }) }).catch(() => {});
    setBusy(false);
    onResolved();
  }

  return (
    <Modal open={Boolean(warning)} onClose={() => {}} dismissible={false} title="Interview Conduct Warning" size="sm" footer={<Button onClick={ack} loading={busy}>I&apos;m here. Continue interview</Button>}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><ShieldAlert className="h-5 w-5" /></span>
        <div className="space-y-2 text-sm text-ink-700">
          <p className="font-medium text-ink-900">{warning?.source === "interviewer" ? "Your interviewer sent a conduct warning." : "You appear to be inactive."}</p>
          <p>{warning?.details || "Please return your attention to the interview. Continued inactivity may result in a conduct strike."}</p>
          <p className="text-xs text-ink-500">A warning is not a strike. Taking time to think, nerves, or connection problems are never counted as misconduct.</p>
        </div>
      </div>
    </Modal>
  );
}
