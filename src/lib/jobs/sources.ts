/**
 * Normalizes job-board feeds into one listing shape. Pure functions plus a
 * small fetch helper, so parsing is unit-testable without the network.
 */
import { inferRoleCategory, type RoleCategory } from "@/lib/constants";
import type { Board } from "./boards";

export type RawListing = {
  source: "greenhouse" | "lever" | "ashby" | "simplify";
  externalId: string;
  company: string;
  title: string;
  location: string;
  url: string;
  term: string;
  roleCategory: RoleCategory;
  description: string | null;
  postedAt: Date | null;
};

const MAX_DESCRIPTION = 20000;
const INTERN_RE = /\b(intern|interns|internship|internships|co-?op|summer analyst|summer associate)\b/i;

export function isInternship(title: string, employmentType?: string | null) {
  return INTERN_RE.test(title) || /intern/i.test(employmentType ?? "");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: ", ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·" };
function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML (possibly entity-escaped, as Greenhouse sends it) → readable plain text. */
export function htmlToText(html: string) {
  let s = html;
  if (/&lt;[a-z/]/i.test(s)) s = decodeEntities(s); // escaped markup
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<\/li>/gi, "")
    .replace(/<(h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s).replace(/ /g, " ");
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*—\s*/g, ", ") // house style: no em dashes
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

/** "Summer 2027", "Fall 2026", … from explicit terms or the title. */
export function extractTerm(title: string, terms?: string[] | null) {
  const t = (terms ?? []).find((x) => /\b20\d\d\b/.test(x));
  if (t) return t;
  const SEASON = "(summer|fall|autumn|winter|spring)";
  const a = title.match(new RegExp(`\\b${SEASON}[\\s-]*(?:of\\s*)?'?(20\\d\\d|\\d\\d)\\b`, "i")); // "Summer 2027", "Summer '27"
  const b = title.match(new RegExp(`\\b(20\\d\\d)\\s*[-–:]?\\s*${SEASON}\\b`, "i")); // "2027 Summer"
  const [seasonRaw, year] = a ? [a[1], a[2]] : b ? [b[2], b[1]] : [null, null];
  if (!seasonRaw || !year) return "";
  const season = seasonRaw.toLowerCase() === "autumn" ? "Fall" : seasonRaw[0].toUpperCase() + seasonRaw.slice(1).toLowerCase();
  return `${season} ${year.length === 2 ? `20${year}` : year}`;
}

const NON_SOFTWARE_ENGINEERING = /\b(hardware|electrical|mechanical|civil|chemical|manufacturing|aerospace|industrial|asic|fpga|rf|analog|process engineer|materials)\b/i;
const HINTS: Record<string, RoleCategory> = {
  software: "software_engineering", "software engineering": "software_engineering",
  "ai/ml/data": "data_science", "data science, ai & machine learning": "data_science", quant: "data_science",
  product: "product_management", "product management": "product_management",
};

export function categorize(title: string, hint?: string | null): RoleCategory {
  if (NON_SOFTWARE_ENGINEERING.test(title)) return "general";
  const inferred = inferRoleCategory(title);
  if (inferred !== "general") return inferred;
  if (/\bproduct\b/i.test(title) && !/\bdesign/i.test(title)) return "product_management";
  return HINTS[(hint ?? "").toLowerCase()] ?? "general";
}

const date = (v: unknown) => {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const safeUrl = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);
const joinLocations = (xs: (string | null | undefined)[]) => {
  const list = [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))];
  return list.length > 3 ? `${list.slice(0, 3).join("; ")} +${list.length - 3} more` : list.join("; ");
};

type Json = Record<string, unknown>;

export function normalizeGreenhouse(board: Board, json: { jobs?: Json[] }): RawListing[] {
  return (json.jobs ?? []).flatMap((j) => {
    const title = String(j.title ?? "").trim();
    const url = safeUrl(j.absolute_url);
    if (!title || !url || !isInternship(title)) return [];
    return [{
      source: "greenhouse" as const,
      externalId: `${board.slug}:${j.id}`,
      company: board.company,
      title,
      location: String((j.location as Json | undefined)?.name ?? ""),
      url,
      term: extractTerm(title),
      roleCategory: categorize(title),
      description: typeof j.content === "string" ? htmlToText(j.content) : null,
      postedAt: date(j.first_published ?? j.updated_at),
    }];
  });
}

export function normalizeLever(board: Board, json: Json[]): RawListing[] {
  return json.flatMap((j) => {
    const title = String(j.text ?? "").trim();
    const url = safeUrl(j.hostedUrl);
    const cats = (j.categories ?? {}) as Json;
    if (!title || !url || !isInternship(title, String(cats.commitment ?? ""))) return [];
    const lists = ((j.lists ?? []) as Json[]).map((l) => `${l.text ?? ""}\n${htmlToText(String(l.content ?? ""))}`).join("\n\n");
    const description = [j.descriptionPlain, lists, j.additionalPlain].filter((x) => typeof x === "string" && x.trim()).join("\n\n");
    return [{
      source: "lever" as const,
      externalId: `${board.slug}:${j.id}`,
      company: board.company,
      title,
      location: joinLocations([String(cats.location ?? ""), ...(((cats.allLocations ?? []) as string[]))]),
      url,
      term: extractTerm(title),
      roleCategory: categorize(title),
      description: description ? htmlToText(description) : null,
      postedAt: date(j.createdAt),
    }];
  });
}

export function normalizeAshby(board: Board, json: { jobs?: Json[] }): RawListing[] {
  return (json.jobs ?? []).flatMap((j) => {
    const title = String(j.title ?? "").trim();
    const url = safeUrl(j.jobUrl);
    if (!title || !url || j.isListed === false || !isInternship(title, String(j.employmentType ?? ""))) return [];
    const secondary = ((j.secondaryLocations ?? []) as Json[]).map((l) => String(l.location ?? ""));
    return [{
      source: "ashby" as const,
      externalId: `${board.slug}:${j.id}`,
      company: board.company,
      title,
      location: joinLocations([String(j.location ?? ""), ...secondary]),
      url,
      term: extractTerm(title),
      roleCategory: categorize(title),
      description: typeof j.descriptionPlain === "string" ? htmlToText(j.descriptionPlain) : null,
      postedAt: date(j.publishedAt),
    }];
  });
}

export function normalizeCommunity(json: Json[]): RawListing[] {
  return json.flatMap((j) => {
    const title = String(j.title ?? "").trim();
    const company = String(j.company_name ?? "").trim();
    const url = safeUrl(j.url);
    if (!j.active || j.is_visible === false || !title || !company || !url || !j.id) return [];
    return [{
      source: "simplify" as const,
      externalId: String(j.id),
      company,
      title,
      location: joinLocations((j.locations ?? []) as string[]),
      url,
      term: extractTerm(title, j.terms as string[]),
      roleCategory: categorize(title, j.category as string),
      description: null,
      postedAt: date(j.date_posted),
    }];
  });
}

/**
 * Fetch a public web page (a job posting link from the listings feed).
 * Refuses anything that resolves to a private or local address, follows at
 * most 3 redirects with the same check, and caps size and time.
 */
export async function fetchPublicPage(url: string, timeoutMs = 10000): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" || !(await isPublicHost(u.hostname))) return null;
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; InterviewConnect/1.0; +internship listings)", Accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, u).toString();
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > 3_000_000) return null;
    return (await res.text()).slice(0, 3_000_000);
  }
  return null;
}

/** True only for hostnames that resolve exclusively to public internet addresses. */
export async function isPublicHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || /(^|\.)(localhost|local|internal|intranet|corp|home|lan)$/.test(h)) return false;
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(h, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

export function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "InterviewConnect/1.0 (internship listings)", Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${new URL(url).host}`), { status: res.status });
  return (await res.json()) as T; // an outage page (HTML) throws here, which callers treat as temporary
}

export function boardUrl(b: Board) {
  if (b.source === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs`;
  if (b.source === "lever") return `https://api.lever.co/v0/postings/${b.slug}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${b.slug}`;
}

/**
 * Where to fetch the full description for a listing whose feed had none.
 * Only well-known job-board hosts are ever contacted.
 */
export function descriptionLookup(l: { source: string; externalId: string; url: string }):
  | { kind: "greenhouse" | "lever"; api: string }
  | { kind: "ashby"; api: string; id: string }
  | { kind: "workday"; api: string }
  | { kind: "smartrecruiters"; api: string }
  | { kind: "oracle"; api: string }
  | { kind: "page"; url: string }
  | null {
  if (l.source === "greenhouse") {
    const [board, id] = l.externalId.split(":");
    return { kind: "greenhouse", api: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}` };
  }
  const u = l.url;
  let m = u.match(/^https:\/\/(?:job-)?boards(?:\.eu)?\.greenhouse\.io\/([a-z0-9_-]+)\/jobs\/(\d+)/i);
  if (m) return { kind: "greenhouse", api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}` };
  m = u.match(/^https:\/\/jobs\.lever\.co\/([a-z0-9_.-]+)\/([0-9a-f-]{36})/i);
  if (m) return { kind: "lever", api: `https://api.lever.co/v0/postings/${m[1]}/${m[2]}` };
  m = u.match(/^https:\/\/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i);
  if (m) return { kind: "ashby", api: `https://api.ashbyhq.com/posting-api/job-board/${m[1]}`, id: m[2] };
  m = u.match(/^https:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\/([^?#]+)/);
  if (m) return { kind: "workday", api: `https://${m[1]}.${m[2]}.myworkdayjobs.com/wday/cxs/${m[1]}/${m[3]}/job/${m[4]}` };
  m = u.match(/^https:\/\/(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)\/(\d+)/);
  if (m) return { kind: "smartrecruiters", api: `https://api.smartrecruiters.com/v1/companies/${m[1]}/postings/${m[2]}` };
  m = u.match(/^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.oraclecloud\.com)\/hcmUI\/CandidateExperience\/[a-z]{2}(?:-[A-Z]{2})?\/sites\/([A-Za-z0-9_]+)\/(?:job|requisitions\/preview)\/(\d+)/);
  if (m) return { kind: "oracle", api: `https://${m[1]}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${m[3]}%22,siteNumber=${m[2]}` };
  // Anything else: read the posting page itself for standard JobPosting data (schema.org).
  if (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return { kind: "page", url: u };
  return null;
}

/** Pull a schema.org JobPosting description out of a careers page, if it has one. */
export function jobPostingFromHtml(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const items = Array.isArray(data) ? data : ((data as Json)?.["@graph"] as unknown[]) ?? [data];
    for (const it of items as Json[]) {
      if (it && String(it["@type"]).includes("JobPosting") && typeof it.description === "string") return it.description;
    }
  }
  return null;
}

/** Fetch and clean a full description; null when the posting can't be read. */
export async function fetchDescription(l: { source: string; externalId: string; url: string }): Promise<string | null> {
  const lookup = descriptionLookup(l);
  if (!lookup) return null;
  if (lookup.kind === "page") {
    const html = await fetchPublicPage(lookup.url);
    const raw = html ? jobPostingFromHtml(html) : null;
    const text = raw ? htmlToText(raw) : "";
    return text.length >= 80 ? text : null;
  }
  const json = await fetchJson<Json>(lookup.api, 10000);
  let raw: unknown = null;
  if (lookup.kind === "greenhouse") raw = json.content;
  else if (lookup.kind === "lever") raw = [json.descriptionPlain, ...((json.lists ?? []) as Json[]).map((x) => `${x.text}\n${htmlToText(String(x.content ?? ""))}`), json.additionalPlain].filter(Boolean).join("\n\n");
  else if (lookup.kind === "ashby") raw = ((json.jobs ?? []) as Json[]).find((j) => j.id === lookup.id)?.descriptionPlain;
  else if (lookup.kind === "smartrecruiters") raw = Object.values(((json.jobAd as Json | undefined)?.sections ?? {}) as Record<string, Json>).map((sec) => (sec && typeof sec.text === "string" ? `${sec.title ? `<h3>${sec.title}</h3>` : ""}${sec.text}` : "")).join("\n");
  else if (lookup.kind === "oracle") {
    const it = ((json.items ?? []) as Json[])[0] ?? {};
    raw = [it.ExternalDescriptionStr, it.ExternalResponsibilitiesStr, it.ExternalQualificationsStr].filter((x) => typeof x === "string" && x).join("\n");
  } else raw = (json.jobPostingInfo as Json | undefined)?.jobDescription;
  const text = typeof raw === "string" ? htmlToText(raw) : "";
  return text.length >= 80 ? text : null;
}
