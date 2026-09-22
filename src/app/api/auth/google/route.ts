import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/auth/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/login?error=google_not_configured", url));
  const role = url.searchParams.get("role") === "interviewer" ? "interviewer" : "student";
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(state));
  const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("ic_oauth_state", state, cookie);
  res.cookies.set("ic_oauth_role", role, cookie);
  return res;
}
