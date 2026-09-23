import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast edge gate: bounce visitors without a session cookie away from app pages.
 * This is only a UX optimisation, every page and API re-validates the session
 * and role on the server (src/lib/auth/guards.ts).
 */
const PROTECTED = ["/dashboard", "/onboarding", "/interviews", "/interviewer", "/admin", "/performance", "/leaderboard", "/notifications", "/profile", "/conduct", "/settings"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get("ic_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon|.*\\..*).*)"] };
