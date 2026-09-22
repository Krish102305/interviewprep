export function fullName(p?: { firstName: string; lastName?: string | null } | null) {
  if (!p) return "Member";
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

/** "Jordan K." — used wherever a full surname isn't necessary. */
export function shortName(p?: { firstName: string; lastName?: string | null } | null) {
  if (!p) return "Member";
  return p.lastName ? `${p.firstName} ${p.lastName.charAt(0)}.` : p.firstName;
}

export function initials(p?: { firstName: string; lastName?: string | null } | null) {
  if (!p) return "?";
  return `${p.firstName.charAt(0)}${p.lastName?.charAt(0) ?? ""}`.toUpperCase();
}

export function greeting(date = new Date(), timeZone?: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: safeTz(timeZone) }).format(date),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function safeTz(tz?: string | null) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export function formatDate(d: Date | string | null | undefined, timeZone?: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: safeTz(timeZone) }).format(
    new Date(d),
  );
}

export function formatDateTime(d: Date | string | null | undefined, timeZone?: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTz(timeZone),
    timeZoneName: "short",
  }).format(new Date(d));
}

export function relativeTime(d: Date | string, now = new Date()) {
  const diff = (new Date(d).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "neutral" as const;
  if (score >= 85) return "excellent" as const;
  if (score >= 70) return "good" as const;
  if (score >= 55) return "fair" as const;
  return "low" as const;
}

export function scoreLabel(score: number | null | undefined) {
  return { excellent: "Excellent", good: "Strong", fair: "Developing", low: "Needs work", neutral: "—" }[scoreTone(score)];
}

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
