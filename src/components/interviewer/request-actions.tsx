"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function MatchActions({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(action: "accept" | "decline") {
    setBusy(action);
    try {
      const r = await api<{ interviewId?: string }>(`/api/matches/${matchId}`, { body: { action } });
      toast.success(action === "accept" ? "Accepted! The interview guide is ready to review." : "Declined. We'll find another interviewer.");
      if (r.interviewId) router.push(`/interviews/${r.interviewId}`);
      else router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => act("accept")} loading={busy === "accept"} disabled={Boolean(busy)}>Accept</Button>
      <Button size="sm" variant="ghost" onClick={() => act("decline")} loading={busy === "decline"} disabled={Boolean(busy)}>Decline</Button>
    </div>
  );
}

export function ClaimButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
      setBusy(true);
      try {
        await api(`/api/interviewer/claim/${interviewId}`, { body: {} });
        toast.success("Interview claimed.");
        router.push(`/interviews/${interviewId}`);
      } catch (e) {
        toast.error((e as Error).message);
        router.refresh();
        setBusy(false);
      }
    }}>Take interview</Button>
  );
}

export function AvailableNowToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(on);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await api("/api/interviewer/available-now", { body: { on: !value } });
      setValue(!value);
      toast.success(!value ? "You're available for instant matches." : "Instant matching paused.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" role="switch" aria-checked={value} onClick={toggle} disabled={busy} className="flex items-center gap-3 rounded-full border border-ink-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium shadow-card disabled:opacity-60">
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-olive-600" : "bg-ink-200"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
      {value ? "Available now" : "Not taking instant requests"}
    </button>
  );
}
