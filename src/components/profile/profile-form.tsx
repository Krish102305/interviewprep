"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function ProfileForm({ initial }: { initial: { firstName: string; lastName: string; location: string; bio: string; timezone: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api("/api/profile", { method: "PATCH", body: f });
      toast.success("Profile saved.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Location" optional value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <Input label="Time zone" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} hint={<button type="button" className="text-olive-700 hover:underline" onClick={() => setF({ ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>Use this device&apos;s time zone</button>} />
      </div>
      <Textarea label="Bio" optional value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={600} />
      <Button onClick={save} loading={busy}>Save changes</Button>
    </div>
  );
}
