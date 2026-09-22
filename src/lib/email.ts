/**
 * Email delivery. In-app notifications are the source of truth; email is an
 * optional extra channel via Resend (RESEND_API_KEY). Without a key we log that
 * email is not configured — we never pretend an email was sent.
 */
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "development") console.info(`[email] not configured — skipped "${subject}" to ${to}`);
    return { sent: false as const, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Interview Connect <noreply@example.com>", to, subject, text }),
    });
    if (!res.ok) {
      console.error("[email] resend error", res.status, await res.text());
      return { sent: false as const, reason: "provider_error" };
    }
    return { sent: true as const };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false as const, reason: "network_error" };
  }
}
