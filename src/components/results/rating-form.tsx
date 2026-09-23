"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

const FIELDS = [
  { key: "professionalism", label: "Professionalism" },
  { key: "realism", label: "Realism" },
  { key: "communication", label: "Communication" },
  { key: "feedbackQuality", label: "Feedback quality" },
] as const;

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="rounded p-0.5">
          <Star className={cn("h-5 w-5", n <= value ? "fill-olive-500 text-olive-500" : "text-ink-300")} />
        </button>
      ))}
    </div>
  );
}

export function RatingForm({ interviewId, interviewerName }: { interviewId: string; interviewerName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Record<string, number>>({ professionalism: 0, realism: 0, communication: 0, feedbackQuality: 0 });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const complete = Object.values(v).every((x) => x > 0);
  async function submit() {
    setBusy(true);
    try {
      await api(`/api/interviews/${interviewId}/rating`, { body: { ...v, comment } });
      toast.success("Thanks for rating your interviewer.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">How was your interview with {interviewerName}? Ratings help us match better. They never affect your score.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-3 py-2">
            <span className="text-sm text-ink-700">{f.label}</span>
            <Stars label={f.label} value={v[f.key]} onChange={(n) => setV((p) => ({ ...p, [f.key]: n }))} />
          </div>
        ))}
      </div>
      <Textarea label="Comment" optional value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <Button onClick={submit} loading={busy} disabled={!complete}>Submit rating</Button>
    </div>
  );
}
