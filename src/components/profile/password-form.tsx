"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try {
      await api("/api/profile/password", { body: { currentPassword: current, newPassword: next } });
      toast.success("Password updated. Other devices have been signed out.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {hasPassword && <Input label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="New password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters, with a letter and a number." value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "Passwords don't match" : undefined} />
      </div>
      <Button type="submit" loading={busy} disabled={!next || mismatch}>{hasPassword ? "Change password" : "Set password"}</Button>
    </form>
  );
}
