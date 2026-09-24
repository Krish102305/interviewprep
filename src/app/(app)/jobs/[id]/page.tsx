import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { roleCategoryLabel } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { ensureDescription } from "@/lib/jobs/sync";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Internship" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser({ roles: ["student", "admin"] });
  const { id } = await params;
  const job = await ensureDescription(id);
  if (!job) notFound();
  const host = new URL(job.url).hostname.replace(/^www\./, "");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> All internships</Link>
      <div className="mt-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-olive-700">{job.company}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-ink-950">{job.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
          {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{job.location}</span>}
          {job.postedAt && <span>Posted {relativeTime(job.postedAt)}</span>}
          {job.term && <Badge tone="olive">{job.term}</Badge>}
          {job.roleCategory !== "general" && <Badge>{roleCategoryLabel(job.roleCategory)}</Badge>}
        </div>
      </div>

      {!job.active && <Alert tone="warning" className="mt-6" title="This internship appears to be closed">It&apos;s no longer on the company&apos;s job board. You can still practice with it.</Alert>}

      <Card className="mt-6 border-olive-200 bg-olive-50/60">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-semibold text-ink-900"><Sparkles className="h-4 w-4 text-olive-600" /> Practice for this exact job</p>
            <p className="mt-1 text-sm text-ink-600">We&apos;ll set up your interview with this role, company and {job.description ? "job description" : "details"} filled in.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/interviews/new?job=${job.id}`} variant="olive">Practice for this job</ButtonLink>
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:border-ink-400">
              Apply on {host} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <h2 className="text-lg font-semibold text-ink-950">Job description</h2>
          {job.description ? (
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-700">{job.description}</div>
          ) : (
            <p className="mt-3 text-sm text-ink-600">
              We couldn&apos;t load the full description from {host}. Open the posting to read it. When you practice, you can paste it into the interview setup so the questions match the job exactly.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
