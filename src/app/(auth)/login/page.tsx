import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/auth/guards";
import { isGoogleConfigured } from "@/lib/auth/google";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Use email and password.",
  oauth_state: "Your sign-in session expired. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
  oauth_failed: "Google sign-in failed. Please try again.",
  email_unverified: "Your Google email isn't verified.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));
  const sp = await searchParams;
  // Only advertise demo accounts where the demo data is actually loaded (never on a fresh production site).
  const showDemo = Boolean(await db.user.findUnique({ where: { email: "admin@demo.interviewconnect.app" }, select: { id: true } }));
  return (
    <>
      <h1 className="text-3xl font-semibold text-ink-950">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-500">Sign in to continue practicing.</p>
      <LoginForm googleEnabled={isGoogleConfigured()} initialError={sp.error ? ERRORS[sp.error] ?? "Sign-in failed." : undefined} next={sp.next} showDemo={showDemo} />
    </>
  );
}
