"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RegradeButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); await fetch(`/api/interviews/${id}/grade`, { method: "POST" }); setTimeout(() => router.refresh(), 1500); }}>
      <RefreshCw className="h-4 w-4" /> Retry grading
    </Button>
  );
}
