"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Entry = { id: string; speaker: string; kind: string; text: string; source: string };

export function TranscriptView({ entries, interviewerName, candidateName, className, interim }: { entries: Entry[]; interviewerName: string; candidateName: string; className?: string; interim?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries.length, interim]);
  return (
    <div className={cn("space-y-3 overflow-y-auto text-sm", className)} aria-live="polite" aria-label="Interview transcript">
      {entries.length === 0 && <p className="text-ink-400">The transcript will appear here as the interview progresses.</p>}
      {entries.map((e) =>
        e.speaker === "system" ? (
          <p key={e.id} className="text-center text-xs text-ink-400">{e.text}</p>
        ) : (
          <div key={e.id}>
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", e.speaker === "interviewer" ? "text-olive-600" : "text-ink-500")}>
              {e.speaker === "interviewer" ? interviewerName : candidateName}
              {e.kind === "follow_up" && <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400">follow-up</span>}
              {e.source === "speech" && <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400">(speech-to-text)</span>}
            </p>
            <p className="mt-0.5 leading-relaxed text-ink-800">{e.text}</p>
          </div>
        ),
      )}
      {interim && <p className="italic text-ink-400">{interim}…</p>}
      <div ref={end} />
    </div>
  );
}
