"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({ name, email, initials, roleLabel, compact }: { name: string; email: string; initials: string; roleLabel: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  if (compact)
    return (
      <button onClick={logout} disabled={busy} className="rounded-lg p-2 text-ink-600 hover:bg-ink-100" aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    );
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className="truncate text-xs text-ink-500" title={email}>{roleLabel} · {email}</p>
      </div>
      <button onClick={logout} disabled={busy} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Sign out" title="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
