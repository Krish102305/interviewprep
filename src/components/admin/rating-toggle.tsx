"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";

export function RatingToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant={hidden ? "secondary" : "ghost"} loading={busy} onClick={async () => { setBusy(true); await api(`/api/admin/ratings/${id}`, { body: { status: hidden ? "visible" : "hidden" } }).catch(() => {}); router.refresh(); setBusy(false); }}>
      {hidden ? "Restore" : "Hide"}
    </Button>
  );
}
