import "server-only";

/**
 * Google OAuth 2.0 (authorization code flow). Enabled only when
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 */
export const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const googleRedirectUri = () => `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const tokens = (await res.json()) as { access_token: string };
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!info.ok) throw new Error("Google userinfo failed");
  return (await info.json()) as { sub: string; email: string; email_verified: boolean; given_name?: string; family_name?: string; name?: string };
}
