import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { exchangeGoogleCode, isGoogleConfigured } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";
import { track } from "@/lib/services/analytics";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, url));
  if (!isGoogleConfigured()) return fail("google_not_configured");
  const jar = await cookies();
  const state = url.searchParams.get("state");
  if (!state || state !== jar.get("ic_oauth_state")?.value) return fail("oauth_state");
  const code = url.searchParams.get("code");
  if (!code) return fail("oauth_cancelled");
  try {
    const g = await exchangeGoogleCode(code);
    if (!g.email_verified) return fail("email_unverified");
    const email = g.email.toLowerCase();
    let user = await db.user.findFirst({ where: { oauthAccounts: { some: { provider: "google", providerAccountId: g.sub } } } });
    if (!user) {
      user = await db.user.findUnique({ where: { email } });
      if (user) {
        await db.oAuthAccount.create({ data: { provider: "google", providerAccountId: g.sub, userId: user.id } });
      } else {
        // New accounts can only be student or interviewer; admin is never assignable here.
        const role = jar.get("ic_oauth_role")?.value === "interviewer" ? "interviewer" : "student";
        user = await db.user.create({
          data: {
            email,
            role,
            oauthAccounts: { create: { provider: "google", providerAccountId: g.sub } },
            profile: { create: { firstName: g.given_name || g.name?.split(" ")[0] || "Member", lastName: g.family_name ?? "" } },
          },
        });
        await track("signup", user.id, { role, method: "google" });
      }
    }
    await createSession(user.id, req.headers.get("user-agent"));
    jar.delete("ic_oauth_state");
    jar.delete("ic_oauth_role");
    return NextResponse.redirect(new URL(homeFor(user), url));
  } catch (err) {
    console.error("[oauth] google callback failed", err);
    return fail("oauth_failed");
  }
}
