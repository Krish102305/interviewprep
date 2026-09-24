import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ROLE_CATEGORIES, inferRoleCategory } from "@/lib/constants";
import { parseJsonArray } from "@/lib/json";

export const PAGE_SIZE = 24;
const CATEGORY_VALUES = new Set<string>(ROLE_CATEGORIES.map((c) => c.value));

export type JobFilters = { q: string; category: string; term: string; page: number };

export function parseFilters(sp: Record<string, string | string[] | undefined>, hasTargets: boolean): JobFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const cat = one("category");
  return {
    q: one("q").trim().slice(0, 100),
    // Default to the student's own target roles when they have any.
    category: cat === "all" || cat === "for_you" || CATEGORY_VALUES.has(cat) ? cat : hasTargets ? "for_you" : "all",
    term: one("term").slice(0, 40),
    page: Math.max(1, Math.min(200, Number(one("page")) || 1)),
  };
}

/** Role categories a student is targeting, from their onboarding profile. */
export async function targetCategories(userId: string) {
  const sp = await db.studentProfile.findUnique({ where: { userId }, select: { targetRoles: true, targetIndustry: true } });
  const cats = parseJsonArray<string>(sp?.targetRoles).map((r) => inferRoleCategory(r, sp?.targetIndustry));
  return [...new Set(cats.filter((c) => c !== "general"))];
}

export async function searchJobs(f: JobFilters, forYou: string[]) {
  const where: Prisma.JobListingWhereInput = { active: true };
  const tokens = f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (tokens.length) where.AND = tokens.map((t) => ({ searchText: { contains: t } }));
  if (f.category === "for_you" && forYou.length) where.roleCategory = { in: forYou };
  else if (CATEGORY_VALUES.has(f.category)) where.roleCategory = f.category;
  if (f.term) where.term = f.term;
  const [total, jobs] = await Promise.all([
    db.jobListing.count({ where }),
    db.jobListing.findMany({
      where,
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, company: true, title: true, location: true, term: true, roleCategory: true, postedAt: true, descriptionStatus: true, source: true },
    }),
  ]);
  return { total, jobs, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Terms with enough open listings to be worth a filter option. */
export async function termOptions() {
  const rows = await db.jobListing.groupBy({ by: ["term"], where: { active: true, term: { not: "" } }, _count: { _all: true } });
  const order = (t: string) => {
    const [season, year] = t.split(" ");
    return Number(year) * 10 + (["Winter", "Spring", "Summer", "Fall"].indexOf(season) + 1);
  };
  return rows.filter((r) => r._count._all >= 5).map((r) => ({ term: r.term, count: r._count._all })).sort((a, b) => order(a.term) - order(b.term));
}
