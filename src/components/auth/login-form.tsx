"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Divider, GoogleButton } from "./google-button";

const DEMO = [
  { label: "Student", email: "maya@demo.interviewconnect.app" },
  { label: "Interviewer", email: "priya@demo.interviewconnect.app" },
  { label: "Admin", email: "admin@demo.interviewconnect.app" },
];

export function LoginForm({ googleEnabled, initialError, next }: { googleEnabled: boolean; initialError?: string; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const res = await api<{ redirect: string }>("/api/auth/login", { body: { email, password } });
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext ?? res.redirect);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {googleEnabled && (
        <>
          <GoogleButton href="/api/auth/google" />
          <Divider />
        </>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" size="lg" loading={loading}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        New to Interview Connect? <Link href="/signup" className="font-medium text-ink-900 underline-offset-4 hover:underline">Create an account</Link>
      </p>
      <div className="mt-10 rounded-xl border border-dashed border-ink-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Demo accounts</p>
        <p className="mt-1 text-xs text-ink-500">Password for all demo accounts: <code className="rounded bg-ink-100 px-1">demo1234</code></p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword("demo1234"); }} className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-700 hover:border-ink-400">
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
