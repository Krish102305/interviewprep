"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { ChoiceCard, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Divider, GoogleButton } from "./google-button";

export function SignupForm({ initialRole, googleEnabled }: { initialRole: "student" | "interviewer"; googleEnabled: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const res = await api<{ redirect: string }>("/api/auth/signup", { body: { ...form, role } });
      router.push(res.redirect);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <div role="radiogroup" aria-label="I'm joining as" className="grid grid-cols-2 gap-3">
        <ChoiceCard name="role" selected={role === "student"} onSelect={() => setRole("student")} icon={<GraduationCap className="h-5 w-5" />} title="Student" description="Practice interviews and get AI feedback." />
        <ChoiceCard name="role" selected={role === "interviewer"} onSelect={() => setRole("interviewer")} icon={<Users className="h-5 w-5" />} title="Interviewer" description="Conduct interviews for students." />
      </div>
      {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
      {googleEnabled && (
        <>
          <div className="mt-6"><GoogleButton href={`/api/auth/google?role=${role}`} label={`Sign up with Google as ${role === "student" ? "a student" : "an interviewer"}`} /></div>
          <Divider />
        </>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" required value={form.firstName} onChange={set("firstName")} />
          <Input label="Last name" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
        </div>
        <Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        <Input label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} hint="At least 8 characters, with a letter and a number." />
        <Button type="submit" className="w-full" size="lg" loading={loading}>Create {role} account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account? <Link href="/login" className="font-medium text-ink-900 underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
