"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ResumeUploader } from "@/components/shared/resume-uploader";

type R = { id: string; fileName: string; isDefault: boolean; parsed: boolean };

export function ResumeList({ resumes }: { resumes: R[] }) {
  const router = useRouter();
  const toast = useToast();
  const [del, setDel] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      {resumes.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {resumes.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <FileText className="h-4 w-4 text-ink-500" />
              <a href={`/api/resumes/${r.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline">{r.fileName}</a>
              {!r.parsed && <Badge tone="warning">Not parsed</Badge>}
              {r.isDefault ? <Badge tone="olive">Default</Badge> : <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/resumes/${r.id}`, { method: "PATCH" }); router.refresh(); }}>Make default</Button>}
              <Button size="sm" variant="ghost" aria-label={`Delete ${r.fileName}`} onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <ResumeUploader compact onUploaded={() => router.refresh()} />
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} loading={busy} title="Delete this resume?" description={`${del?.fileName} will be permanently deleted from our storage.`} confirmLabel="Delete" onConfirm={async () => {
        if (!del) return;
        setBusy(true);
        try { await api(`/api/resumes/${del.id}`, { method: "DELETE" }); toast.success("Resume deleted."); setDel(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }} />
    </div>
  );
}
