import "server-only";
import { db } from "@/lib/db";
import { BOARDS, COMMUNITY_FEEDS, type Board } from "./boards";
import { boardUrl, fetchDescription, fetchJson, normalizeAshby, normalizeCommunity, normalizeGreenhouse, normalizeLever, type RawListing } from "./sources";

const SYNC_ID = "internships";
/** Bump the suffix when description readers improve so earlier misses get retried. */
const UNAVAILABLE = "unavailable:2";
const REFRESH_HOURS = Number(process.env.JOBS_REFRESH_HOURS) || 12;
const STALE_LOCK_MS = 15 * 60_000;
export const jobsSyncEnabled = () => process.env.JOBS_SYNC !== "off";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const searchTextOf = (l: Pick<RawListing, "company" | "title" | "location">) => `${l.company} ${l.title} ${l.location}`.toLowerCase();

/** Run fn over items with limited concurrency. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

async function fetchBoard(b: Board): Promise<RawListing[]> {
  const json = await fetchJson<never>(boardUrl(b));
  if (b.source === "greenhouse") return normalizeGreenhouse(b, json);
  if (b.source === "lever") return normalizeLever(b, json);
  return normalizeAshby(b, json);
}

export async function syncState() {
  const [state, count] = await Promise.all([db.jobSync.findUnique({ where: { id: SYNC_ID } }), db.jobListing.count({ where: { active: true } })]);
  const running = state?.status === "running" && !!state.startedAt && Date.now() - state.startedAt.getTime() < STALE_LOCK_MS;
  const stale = !state?.succeededAt || Date.now() - state.succeededAt.getTime() > REFRESH_HOURS * 3600_000;
  return { count, running, stale, succeededAt: state?.succeededAt ?? null, lastError: state?.status === "failed" ? state.error : null };
}

/**
 * Pull every source, upsert open internships and retire ones that closed.
 * Safe to call concurrently: only one run holds the lock at a time.
 */
export async function syncJobs() {
  await db.jobSync.upsert({ where: { id: SYNC_ID }, create: { id: SYNC_ID }, update: {} });
  const lock = await db.jobSync.updateMany({
    where: { id: SYNC_ID, OR: [{ status: { not: "running" } }, { startedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } }] },
    data: { status: "running", startedAt: new Date(), error: null },
  });
  if (lock.count !== 1) return { skipped: true as const };

  try {
    // 1. Fetch. A source that fails keeps its existing listings untouched.
    const boardResults = await pool(BOARDS, 6, async (b) => {
      try {
        return { scope: `${b.source}:${b.slug}`, ok: true, listings: await fetchBoard(b) };
      } catch (err) {
        console.warn(`[jobs] ${b.source}/${b.slug} failed:`, (err as Error).message);
        return { scope: `${b.source}:${b.slug}`, ok: false, listings: [] as RawListing[] };
      }
    });
    const feedResults = await pool(COMMUNITY_FEEDS, 2, async (url) => {
      try {
        return { ok: true, listings: normalizeCommunity(await fetchJson<never[]>(url, 45000)) };
      } catch (err) {
        console.warn(`[jobs] community feed failed:`, (err as Error).message);
        return { ok: false, listings: [] as RawListing[] };
      }
    });
    if (!boardResults.some((r) => r.ok) && !feedResults.some((r) => r.ok)) throw new Error("No job source could be reached.");

    // 2. Merge: company boards first (they carry full descriptions), then the
    //    community list minus anything already covered by a board.
    const incoming = new Map<string, RawListing>();
    const covered = new Set<string>();
    for (const r of boardResults) for (const l of r.listings) {
      incoming.set(`${l.source}|${l.externalId}`, l);
      covered.add(`${norm(l.company)}|${norm(l.title)}`);
    }
    for (const r of feedResults) for (const l of r.listings) {
      if (covered.has(`${norm(l.company)}|${norm(l.title)}`)) continue;
      incoming.set(`${l.source}|${l.externalId}`, l);
    }

    // 3. Diff against what we have.
    const existing = await db.jobListing.findMany({ select: { id: true, source: true, externalId: true, company: true, title: true, location: true, url: true, term: true, roleCategory: true, active: true, descriptionStatus: true } });
    const byKey = new Map(existing.map((e) => [`${e.source}|${e.externalId}`, e]));
    const now = new Date();
    const toCreate: RawListing[] = [];
    const seenIds: string[] = [];
    let updated = 0;
    for (const [key, l] of incoming) {
      const e = byKey.get(key);
      if (!e) {
        toCreate.push(l);
        continue;
      }
      seenIds.push(e.id);
      const changed = !e.active || e.company !== l.company || e.title !== l.title || e.location !== l.location || e.url !== l.url || e.term !== l.term || e.roleCategory !== l.roleCategory;
      const newDescription = l.description && e.descriptionStatus !== "ok";
      if (changed || newDescription) {
        updated++;
        await db.jobListing.update({
          where: { id: e.id },
          data: {
            active: true, company: l.company, title: l.title, location: l.location, url: l.url, term: l.term, roleCategory: l.roleCategory, searchText: searchTextOf(l),
            ...(newDescription ? { description: l.description, descriptionStatus: "ok", descriptionAt: now } : {}),
          },
        });
      }
    }
    for (let i = 0; i < toCreate.length; i += 500) {
      await db.jobListing.createMany({
        data: toCreate.slice(i, i + 500).map((l) => ({
          ...l,
          searchText: searchTextOf(l),
          descriptionStatus: l.description ? "ok" : "pending",
          descriptionAt: l.description ? now : null,
          lastSeenAt: now,
        })),
      });
    }
    for (let i = 0; i < seenIds.length; i += 500) await db.jobListing.updateMany({ where: { id: { in: seenIds.slice(i, i + 500) } }, data: { lastSeenAt: now } });

    // 4. Retire listings that disappeared from a source that answered this time.
    const okScopes = new Set(boardResults.filter((r) => r.ok).map((r) => r.scope));
    const communityOk = feedResults.every((r) => r.ok);
    const gone = existing.filter((e) => {
      if (!e.active || incoming.has(`${e.source}|${e.externalId}`)) return false;
      if (e.source === "simplify") return communityOk;
      return okScopes.has(`${e.source}:${e.externalId.split(":")[0]}`);
    }).map((e) => e.id);
    for (let i = 0; i < gone.length; i += 500) await db.jobListing.updateMany({ where: { id: { in: gone.slice(i, i + 500) } }, data: { active: false } });
    await db.jobListing.deleteMany({ where: { active: false, lastSeenAt: { lt: new Date(Date.now() - 60 * 86400_000) } } });

    await db.jobSync.update({ where: { id: SYNC_ID }, data: { status: "idle", finishedAt: new Date(), succeededAt: new Date(), added: toCreate.length, updated, removed: gone.length } });
    console.info(`[jobs] sync done: +${toCreate.length} new, ${updated} updated, ${gone.length} closed`);
    return { skipped: false as const, added: toCreate.length, updated, removed: gone.length };
  } catch (err) {
    console.error("[jobs] sync failed", err);
    await db.jobSync.update({ where: { id: SYNC_ID }, data: { status: "failed", finishedAt: new Date(), error: String((err as Error).message).slice(0, 300) } });
    throw err;
  }
}

/**
 * Make sure a listing has its full description, fetching it from the
 * employer's posting the first time someone opens it.
 */
export async function ensureDescription(id: string) {
  const l = await db.jobListing.findUnique({ where: { id } });
  if (!l || l.descriptionStatus === "ok") return l;
  // Don't hammer postings that failed recently with the current readers.
  // (Older "unavailable" marks are retried once whenever the readers improve.)
  if (l.descriptionStatus === UNAVAILABLE && l.descriptionAt && Date.now() - l.descriptionAt.getTime() < 24 * 3600_000) return l;
  let description: string | null = null;
  try {
    description = await fetchDescription(l);
  } catch (err) {
    const status = (err as { status?: number }).status;
    console.warn(`[jobs] description fetch failed for ${l.id}:`, (err as Error).message);
    // Outages, timeouts and server errors are temporary: try again on the next view.
    // Only a posting that is actually gone counts as unavailable.
    if (status !== 404 && status !== 410) return l;
  }
  return db.jobListing.update({
    where: { id },
    data: description ? { description, descriptionStatus: "ok", descriptionAt: new Date() } : { descriptionStatus: UNAVAILABLE, descriptionAt: new Date() },
  });
}
