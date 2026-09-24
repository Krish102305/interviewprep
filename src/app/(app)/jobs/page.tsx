import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Briefcase, ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { ROLE_CATEGORIES, roleCategoryLabel } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { jobsSyncEnabled, syncJobs, syncState } from "@/lib/jobs/sync";
import { parseFilters, searchJobs, targetCategories, termOptions } from "@/lib/jobs/queries";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { AutoRefresh } from "@/components/interviews/auto-refresh";

export const metadata: Metadata = { title: "Internships" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser({ roles: ["student", "admin"] });
  const [sp, state, forYou] = await Promise.all([searchParams, syncState(), user.role === "student" ? targetCategories(user.id) : Promise.resolve([] as string[])]);

  // Listings refresh themselves: a stale page view kicks off a background sync.
  if (jobsSyncEnabled() && state.stale && !state.running) after(() => syncJobs().catch(() => {}));

  if (state.count === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader eyebrow="Internships" title="Open internships" description="Real, currently open internships from company job boards." />
        {jobsSyncEnabled() ? (
          <div className="flex flex-col items-center rounded-2xl border border-ink-200 bg-white py-16 text-center shadow-card">
            <AutoRefresh every={5000} />
            <Spinner className="text-olive-600" />
            <p className="mt-4 font-medium text-ink-900">Loading the latest internships…</p>
            <p className="mt-1 text-sm text-ink-500">The first load takes about 30 seconds. This page updates on its own.</p>
          </div>
        ) : (
          <EmptyState title="No listings yet" description="Internship listings are turned off on this server." />
        )}
      </div>
    );
  }

  const f = parseFilters(sp, forYou.length > 0);
  const [{ total, jobs, pages }, terms] = await Promise.all([searchJobs(f, forYou), termOptions()]);
  const link = (patch: Partial<typeof f>) => {
    const n = { ...f, ...patch };
    const p = new URLSearchParams();
    if (n.q) p.set("q", n.q);
    p.set("category", n.category);
    if (n.term) p.set("term", n.term);
    if (n.page > 1) p.set("page", String(n.page));
    return `/jobs?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Internships"
        title="Open internships"
        description="Real, currently open internships. Pick one and practice an interview tailored to that exact job."
      />

      <form action="/jobs" method="get" className="grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-card sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input name="q" defaultValue={f.q} placeholder="Company, role or location" className="input-base pl-9" />
        </label>
        <label className="block">
          <span className="sr-only">Role type</span>
          <select name="category" defaultValue={f.category} className="input-base pr-8">
            {forYou.length > 0 && <option value="for_you">For your target roles</option>}
            <option value="all">All role types</option>
            {ROLE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Term</span>
          <select name="term" defaultValue={f.term} className="input-base pr-8">
            <option value="">Any term</option>
            {terms.map((t) => <option key={t.term} value={t.term}>{t.term} ({t.count})</option>)}
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
        <p>
          <strong className="text-ink-900">{total.toLocaleString()}</strong> open internship{total === 1 ? "" : "s"}
          {f.category === "for_you" && forYou.length > 0 && <> for {forYou.map(roleCategoryLabel).join(", ")}</>}
        </p>
        {state.succeededAt && <p className="text-xs">Updated {relativeTime(state.succeededAt)}</p>}
      </div>

      {jobs.length === 0 ? (
        <EmptyState className="mt-6" icon={<Briefcase className="h-5 w-5" />} title="No internships match" description="Try a different search, or widen the role type or term." action={<ButtonLink href="/jobs?category=all" variant="secondary" size="sm">Show all internships</ButtonLink>} />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-col rounded-2xl border border-ink-200 bg-white p-4 shadow-card transition hover:border-ink-300">
              <p className="text-xs font-semibold uppercase tracking-wide text-olive-700">{j.company}</p>
              <Link href={`/jobs/${j.id}`} className="mt-1 font-semibold leading-snug text-ink-950 hover:underline">{j.title}</Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                {j.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{j.location}</span>}
                {j.postedAt && <span>Posted {relativeTime(j.postedAt)}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {j.term && <Badge tone="olive">{j.term}</Badge>}
                {j.roleCategory !== "general" && <Badge>{roleCategoryLabel(j.roleCategory)}</Badge>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 pt-1 sm:mt-auto sm:pt-4">
                <ButtonLink href={`/interviews/new?job=${j.id}`} size="sm" variant="olive">Practice for this job</ButtonLink>
                <ButtonLink href={`/jobs/${j.id}`} size="sm" variant="secondary">Details</ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pages">
          {f.page > 1 ? <ButtonLink href={link({ page: f.page - 1 })} variant="secondary" size="sm"><ChevronLeft className="h-4 w-4" /> Previous</ButtonLink> : <span />}
          <span className="text-ink-500">Page {f.page} of {pages}</span>
          {f.page < pages ? <ButtonLink href={link({ page: f.page + 1 })} variant="secondary" size="sm">Next <ChevronRight className="h-4 w-4" /></ButtonLink> : <span />}
        </nav>
      )}

      <p className="mt-8 text-center text-xs text-ink-400">
        Listings come from company job boards (Greenhouse, Lever, Ashby) and the community-maintained{" "}
        <a href="https://github.com/SimplifyJobs" target="_blank" rel="noopener noreferrer" className="underline">SimplifyJobs</a> internship list, refreshed about twice a day. Always apply on the company&apos;s own site.
      </p>
    </div>
  );
}
