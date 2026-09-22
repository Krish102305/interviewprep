"use client";
import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export type ResumeSummary = { id: string; fileName: string; parsed: boolean; isDefault?: boolean };

export function ResumeUploader({ onUploaded, compact }: { onUploaded: (r: ResumeSummary) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("Files must be 5 MB or smaller.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ resume: ResumeSummary }>("/api/resumes", { form });
      toast.success(res.resume.parsed ? "Resume uploaded and parsed." : "Resume uploaded. We couldn't extract text, so questions won't reference it.");
      onUploaded(res.resume);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      className={cn("flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white text-center transition", drag ? "border-olive-500 bg-olive-50" : "border-ink-200", compact ? "px-4 py-5" : "px-6 py-10")}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-olive-50 text-olive-700">{busy ? <Spinner /> : <Upload className="h-5 w-5" />}</span>
      <p className="mt-3 text-sm font-medium text-ink-900">{busy ? "Uploading and parsing…" : "Drop your resume here"}</p>
      <p className="mt-1 text-xs text-ink-500">PDF, DOCX or TXT · up to 5 MB · stored privately</p>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium hover:bg-ink-50 disabled:opacity-50">
        <FileText className="h-4 w-4" /> Choose file
      </button>
      <input ref={input} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" aria-label="Upload resume" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}
