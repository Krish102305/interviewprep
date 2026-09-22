"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={async () => { setBusy(true); await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); router.refresh(); setBusy(false); }}>
      Mark all read
    </Button>
  );
}
