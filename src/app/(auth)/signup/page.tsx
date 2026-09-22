import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";
import { isGoogleConfigured } from "@/lib/auth/google";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold text-ink-950">Create your account</h1>
      <p className="mt-2 text-sm text-ink-500">Start practicing in minutes. Free for students.</p>
      <SignupForm initialRole={sp.role === "interviewer" ? "interviewer" : "student"} googleEnabled={isGoogleConfigured()} />
    </>
  );
}
